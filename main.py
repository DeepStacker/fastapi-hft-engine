import asyncio
import sys
from fastapi import (
    FastAPI,
    WebSocket,
    Depends,
    HTTPException,
    WebSocketDisconnect,
    Query,
)
from db import get_db
from schemas import SnapshotIn, HistoricalResponse, HistoricalPoint
from models import (
    MarketSnapshot,
    FutureContract,
    OptionContract,
    OptionSnapshot,
    IOdata,
)
from utils import filter_data
from sqlalchemy.future import select
from sqlalchemy import func, desc
from ingest import ingest_loop
from websocket import manager, redis_subscriber
from redis_cache import get_latest
from datetime import datetime
from typing import List, Optional, Dict

from datetime import datetime, time
import pytz

# Windows-specific event loop policy
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

app = FastAPI()


@app.on_event("startup")
async def startup():
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    # Define IST timezone
    ist = pytz.timezone("Asia/Kolkata")
    now = datetime.now(ist).time()

    # Define allowed time windows
    morning_start = time(9, 0)
    morning_end = time(9, 7)

    day_start = time(9, 14)
    day_end = time(15, 31)

    if (morning_start <= now <= morning_end) or (day_start <= now <= day_end):
        asyncio.create_task(ingest_loop())
        print("✅ Ingest loop started: within trading windows.")
    else:
        print("⏸️ Ingest loop not started: outside trading time.")

    asyncio.create_task(redis_subscriber())


@app.websocket("/ws/{inst_id}")
async def ws_endpoint(inst_id: str, ws: WebSocket):
    await manager.connect(inst_id, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(inst_id, ws)


@app.get("/live/{inst_id}")
async def get_live(inst_id: str):
    data = await get_latest(inst_id)
    if not data:
        raise HTTPException(404, "No live data")
    return data


@app.get("/historical/{inst_id}/{otype}", response_model=HistoricalResponse)
async def historical(
    inst_id: str,
    otype: str,
    db=Depends(get_db),
    strike: Optional[float] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    """Get historical option data"""
    # Convert inst_id to integer since that's how it's stored in the database
    try:
        symbol_id = int(inst_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid instrument ID")

    # Convert string dates to datetime if provided
    start_date = datetime.fromisoformat(start) if start else datetime.min
    end_date = datetime.fromisoformat(end) if end else datetime.max

    # Query option contracts
    if not start or not end:
        raise HTTPException(status_code=400, detail="'start' and 'end' datetime values are required.")

    # Optional: Debug logging
    print(f"[DEBUG] start: {start}, end: {end}, strike: {strike}, otype: {otype}, symbol_id: {symbol_id}")

    # SQLAlchemy query
    stmt = (
        select(OptionContract)
        .where(OptionContract.symbol_id == symbol_id)
        .where(OptionContract.timestamp.between(start_date, end_date))
        .where(OptionContract.strike_price == strike)
        .where(OptionContract.option_type == otype.upper())
        .order_by(OptionContract.timestamp)
    )

    result = await db.execute(stmt)
    rows = result.scalars().all()

    # Transform the data into the response format
    points = []
    for option in rows:
        point_data = {
            "ltp": option.ltp,
            "volume": option.volume,
            "oi": option.open_interest,
            "iv": option.implied_volatility,
            "delta": option.delta,
            "theta": option.theta,
            "gamma": option.gamma,
            "vega": option.vega,
            "rho": option.rho,
            "price_change": option.price_change,
            "price_change_percent": option.price_change_percent,
            "volume_change": option.volume_change,
            "volume_change_percent": option.volume_change_percent,
            "oi_change": option.oi_change,
            "oi_change_percent": option.oi_change_percent,
        }
        points.append(HistoricalPoint(timestamp=option.timestamp, value=point_data))

    return HistoricalResponse(
        instrument_id=inst_id,
        strike_price=strike,
        option_type=otype.upper(),
        points=points,
    )


@app.get("/market-snapshot/{inst_id}")
async def get_market_snapshot(
    inst_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db=Depends(get_db),
):
    stmt = select(MarketSnapshot)
    if start:
        stmt = stmt.where(MarketSnapshot.timestamp >= start)
    if end:
        stmt = stmt.where(MarketSnapshot.timestamp <= end)
    stmt = stmt.order_by(MarketSnapshot.timestamp.desc())

    result = await db.execute(stmt)
    snapshots = result.scalars().all()
    return {"snapshots": snapshots}


@app.get("/futures/{inst_id}")
async def get_futures_data(
    inst_id: str,
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
    db=Depends(get_db),
):
    stmt = select(FutureContract).where(FutureContract.symbol_id == inst_id)
    if start:
        stmt = stmt.where(FutureContract.timestamp >= start)
    if end:
        stmt = stmt.where(FutureContract.timestamp <= end)
    stmt = stmt.order_by(FutureContract.timestamp.desc())

    result = await db.execute(stmt)
    futures = result.scalars().all()
    return {"futures": futures}


@app.get("/stats")
async def get_data_statistics(db=Depends(get_db)):
    """Get statistics about the data in the database"""
    # Get counts and time ranges for each table
    stats = {}

    # Option contracts stats
    async with db as session:
        # Get option stats
        option_count = await session.execute(
            select(func.count()).select_from(OptionContract)
        )
        stats["options_count"] = option_count.scalar()

        option_time_range = await session.execute(
            select(
                func.min(OptionContract.timestamp).label("min_time"),
                func.max(OptionContract.timestamp).label("max_time"),
            )
        )
        time_range = option_time_range.first()
        stats["options"] = {
            "count": stats["options_count"],
            "time_range": {
                "first_entry": time_range[0] if time_range else None,
                "last_entry": time_range[1] if time_range else None,
            },
        }

        # Get futures stats
        future_count = await session.execute(
            select(func.count()).select_from(FutureContract)
        )
        stats["futures_count"] = future_count.scalar()

        future_time_range = await session.execute(
            select(
                func.min(FutureContract.timestamp).label("min_time"),
                func.max(FutureContract.timestamp).label("max_time"),
            )
        )
        time_range = future_time_range.first()
        stats["futures"] = {
            "count": stats["futures_count"],
            "time_range": {
                "first_entry": time_range[0] if time_range else None,
                "last_entry": time_range[1] if time_range else None,
            },
        }

        # Get market stats
        market_count = await session.execute(
            select(func.count()).select_from(MarketSnapshot)
        )
        stats["market_count"] = market_count.scalar()

        market_time_range = await session.execute(
            select(
                func.min(MarketSnapshot.timestamp).label("min_time"),
                func.max(MarketSnapshot.timestamp).label("max_time"),
            )
        )
        time_range = market_time_range.first()
        stats["market"] = {
            "count": stats["market_count"],
            "time_range": {
                "first_entry": time_range[0] if time_range else None,
                "last_entry": time_range[1] if time_range else None,
            },
        }

        # Clean up counts
        del stats["options_count"]
        del stats["futures_count"]
        del stats["market_count"]

        return stats


@app.get("/options")
async def get_options(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    symbol_id: Optional[int] = None,
    strike_price: Optional[float] = None,
    option_type: Optional[str] = None,
    db=Depends(get_db),
):
    """Get option chain data with pagination and filtering"""
    query = select(OptionContract)

    # Apply filters
    if start_time:
        query = query.where(OptionContract.timestamp >= start_time)
    if end_time:
        query = query.where(OptionContract.timestamp <= end_time)
    if symbol_id:
        query = query.where(OptionContract.symbol_id == symbol_id)
    if strike_price:
        query = query.where(OptionContract.strike_price == strike_price)
    if option_type:
        query = query.where(OptionContract.option_type == option_type.upper())

    # Add pagination
    query = query.order_by(desc(OptionContract.timestamp)).offset(skip).limit(limit)

    # Execute query
    result = await db.execute(query)
    options = result.scalars().all()

    # Get total count
    count_query = select(func.count()).select_from(OptionContract)
    if start_time:
        count_query = count_query.where(OptionContract.timestamp >= start_time)
    if end_time:
        count_query = count_query.where(OptionContract.timestamp <= end_time)
    if symbol_id:
        count_query = count_query.where(OptionContract.symbol_id == symbol_id)
    if strike_price:
        count_query = count_query.where(OptionContract.strike_price == strike_price)
    if option_type:
        count_query = count_query.where(
            OptionContract.option_type == option_type.upper()
        )

    total_count = await db.execute(count_query)

    return {
        "total": total_count.scalar(),
        "skip": skip,
        "limit": limit,
        "data": options,
    }


@app.get("/io-data")
async def get_options(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, le=1000),
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    symbol_id: Optional[int] = None,
    strike_price: Optional[float] = None,
    option_type: Optional[str] = None,
    db=Depends(get_db),
):
    """Get option chain data with pagination and filtering"""
    query = select(IOdata)

    # Apply filters
    if start_time:
        query = query.where(IOdata.timestamp >= start_time)
    if end_time:
        query = query.where(IOdata.timestamp <= end_time)
    if symbol_id:
        query = query.where(IOdata.symbol_id == symbol_id)
    if strike_price:
        query = query.where(IOdata.strike_price == strike_price)
    if option_type:
        query = query.where(IOdata.option_type == option_type.upper())

    # Add pagination
    query = query.order_by(desc(IOdata.timestamp)).offset(skip).limit(limit)

    # Execute query
    result = await db.execute(query)
    options = result.scalars().all()

    # Get total count
    count_query = select(func.count()).select_from(IOdata)
    if start_time:
        count_query = count_query.where(IOdata.timestamp >= start_time)
    if end_time:
        count_query = count_query.where(IOdata.timestamp <= end_time)
    if symbol_id:
        count_query = count_query.where(IOdata.symbol_id == symbol_id)
    if strike_price:
        count_query = count_query.where(IOdata.strike_price == strike_price)
    if option_type:
        count_query = count_query.where(IOdata.option_type == option_type.upper())

    total_count = await db.execute(count_query)

    return {
        "total": total_count.scalar(),
        "skip": skip,
        "limit": limit,
        "data": filter_data(options),
    }
