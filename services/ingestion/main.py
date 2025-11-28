import asyncio
import signal
import time
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.messaging.producer import kafka_producer
from services.ingestion.dhan_client import DhanApiClient
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME

# Configure logging
configure_logger()
logger = get_logger("ingestion-service")
settings = get_settings()

async def get_active_instruments():
    """Fetch active instruments from DB."""
    from core.database.db import async_session_factory
    from core.database.models import InstrumentDB
    from sqlalchemy import select

    async with async_session_factory() as session:
        result = await session.execute(select(InstrumentDB).where(InstrumentDB.is_active == 1))
        return [row.symbol_id for row in result.scalars().all()]

def is_trading_hours():
    """Check if current time is within NSE trading hours (09:15 - 15:30 IST)."""
    from datetime import datetime, time
    import pytz
    
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    current_time = now.time()
    
    # Weekends check
    if now.weekday() >= 5:
        return False

    start_time = time(9, 15)
    end_time = time(15, 30)
    
    return start_time <= current_time <= end_time

async def fetch_and_publish(client: DhanApiClient, symbol_id: int, max_retries: int = 3):
    """
    Fetch data from Dhan API and publish to Kafka with retry logic.
    """
    for attempt in range(max_retries):
        try:
            # Fetch option chain data
            response = await client.fetch_option_chain(symbol_id)
            
            if not response:
                logger.warning(f"Empty response for symbol_id {symbol_id}")
                return
            
            # Wrap in envelope for Kafka
            message = {
                "symbol_id": symbol_id,
                "payload": response,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            # Publish to Kafka
            await kafka_producer.send("market.raw", message)
            MESSAGES_PROCESSED.labels(service="ingestion", status="success").inc()
            
            logger.debug(f"Published data for symbol_id {symbol_id}")
            return
            
        except Exception as e:
            logger.error(f"Failed to fetch/publish symbol_id {symbol_id} (attempt {attempt + 1}/{max_retries}): {e}")
            MESSAGES_PROCESSED.labels(service="ingestion", status="error").inc()
            
            if attempt < max_retries - 1:
                await asyncio.sleep(2 ** attempt)  # Exponential backoff
            else:
                logger.error(f"Max retries reached for symbol_id {symbol_id}")

async def ingestion_loop():
    # Start metrics server
    start_metrics_server(8000)
    
    client = DhanApiClient()
    await kafka_producer.start()
    
    logger.info("Starting ingestion loop...")
    
    # Initial fallback if DB is empty
    instruments = [13, 25, 27, 442] 
    last_instrument_refresh = time.time()
    
    try:
        while True:
            # Refresh instruments list every 60 seconds
            if time.time() - last_instrument_refresh > 60:
                try:
                    db_instruments = await get_active_instruments()
                    if db_instruments:
                        instruments = db_instruments
                        logger.info(f"Refreshed instruments list: {len(instruments)} active instruments")
                    last_instrument_refresh = time.time()
                except Exception as e:
                    logger.error(f"Failed to refresh instruments: {e}")
            
            if is_trading_hours():
                if instruments:
                    tasks = [fetch_and_publish(client, sid) for sid in instruments]
                    await asyncio.gather(*tasks, return_exceptions=True)
                else:
                    logger.warning("No active instruments found.")
            else:
                logger.info("Outside trading hours. Sleeping...")
                await asyncio.sleep(60) # Sleep longer outside hours
                continue

            await asyncio.sleep(1) # Fetch interval
    except asyncio.CancelledError:
        logger.info("Ingestion loop cancelled")
    finally:
        await kafka_producer.stop()

def main():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    ingest_task = loop.create_task(ingestion_loop())
    
    # Graceful Shutdown
    def shutdown():
        logger.info("Shutting down...")
        ingest_task.cancel()
    
    loop.add_signal_handler(signal.SIGTERM, shutdown)
    loop.add_signal_handler(signal.SIGINT, shutdown)
    
    try:
        loop.run_until_complete(ingest_task)
    except asyncio.CancelledError:
        pass
    finally:
        loop.close()

if __name__ == "__main__":
    main()
