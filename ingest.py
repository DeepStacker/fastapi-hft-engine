import asyncio
import logging
from sqlalchemy import insert
from sqlalchemy.exc import SQLAlchemyError
import httpx
import sys
from datetime import datetime

from config import INSTRUMENTS, FETCH_INTERVAL, INSTRUMENTS_SEG
from db import init_db, get_session
from models import MarketSnapshot, FutureContract, OptionContract
from utils import flatten_option_chain
from redis_cache import cache_latest, publish_live
from metrics import FETCH_TIME, INSERT_COUNT, ERROR_COUNT
from Get_oc_data import get_oc_data

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

logger = logging.getLogger(__name__)

MAX_CONCURRENCY = 60
RETRY_DELAY = 0.5
MAX_RETRIES = 3


def serialize_datetime(obj):
    """Helper function to serialize datetime objects"""
    if isinstance(obj, datetime):
        return obj.isoformat()
    return obj


def prepare_cache_data(data_dict):
    """Prepare data for caching by handling datetime serialization"""
    market_data = {
        k: serialize_datetime(v) for k, v in data_dict["market_snapshot"].items()
    }
    futures_data = []
    for future in data_dict["futures"]:
        futures_data.append({k: serialize_datetime(v) for k, v in future.items()})
    options_data = []
    for option in data_dict["options"]:
        options_data.append({k: serialize_datetime(v) for k, v in option.items()})

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "market": market_data,
        "futures": futures_data,
        "options": options_data,
    }


async def safe_fetch(inst, seg, session):
    """Fetch with retry, backoff and error metrics."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await get_oc_data(
                session=session, symbol_seg=seg, symbol_sid=inst, symbol_exp=None
            )
        except Exception as e:
            ERROR_COUNT.inc()
            logger.warning(f"[{inst}] Fetch failed (attempt {attempt}): {e}")
            if attempt < MAX_RETRIES:
                await asyncio.sleep(RETRY_DELAY * attempt)
    return None


async def save_to_db(session, data_dict):
    """Save structured data to appropriate database tables"""
    try:
        # Insert market snapshot
        market_stmt = insert(MarketSnapshot).values(**data_dict["market_snapshot"])
        await session.execute(market_stmt)

        # Insert futures data
        if data_dict["futures"]:
            futures_stmt = insert(FutureContract).values(data_dict["futures"])
            await session.execute(futures_stmt)

        # Insert options data
        if data_dict["options"]:
            options_stmt = insert(OptionContract).values(data_dict["options"])
            await session.execute(options_stmt)
            # io_data_stmt = insert(IOdata).values(data_dict["options"])
            # await session.execute(io_data_stmt)

        await session.commit()
        INSERT_COUNT.inc(1 + len(data_dict["futures"]) + len(data_dict["options"]))

    except SQLAlchemyError as e:
        ERROR_COUNT.inc()
        logger.error(f"DB insert failed: {e}")
        await session.rollback()
        raise


async def ingest_loop():
    # Initialize database first
    try:
        await init_db()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return

    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

    while True:
        async with httpx.AsyncClient(timeout=5) as session:
            with FETCH_TIME.time():

                async def fetch_with_semaphore(inst, seg):
                    async with semaphore:
                        return inst, await safe_fetch(inst, seg, session)

                tasks = [
                    fetch_with_semaphore(inst, seg)
                    for inst, seg in zip(INSTRUMENTS, INSTRUMENTS_SEG)
                ]
                responses = await asyncio.gather(*tasks)

        # Process each instrument's data
        async with await get_session() as db_session:
            for inst, data in responses:
                if not data:
                    continue
                try:
                    structured_data = flatten_option_chain(data, inst)
                    await save_to_db(db_session, structured_data)

                    # Cache and publish latest snapshot
                    try:
                        cache_data = prepare_cache_data(structured_data)
                        await cache_latest(inst, cache_data)
                        await publish_live(inst, cache_data)
                    except Exception as e:
                        ERROR_COUNT.inc()
                        logger.warning(f"[{inst}] Cache/Publish failed: {str(e)}")

                except Exception as e:
                    ERROR_COUNT.inc()
                    logger.error(f"[{inst}] Processing failed: {str(e)}")

        await asyncio.sleep(FETCH_INTERVAL)


if __name__ == "__main__":
    try:
        asyncio.run(ingest_loop())
    except KeyboardInterrupt:
        logger.info("Ingestion stopped by user")
    except Exception as e:
        logger.error(f"Ingestion stopped due to error: {e}", exc_info=True)
