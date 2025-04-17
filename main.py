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
from fastapi.middleware.cors import CORSMiddleware
from db import get_db
from schemas import SnapshotIn, HistoricalResponse, HistoricalPoint
from models import MarketSnapshot, FutureContract, OptionContract, OptionSnapshot
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

# Allow requests from your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For development only. Use specific origins in production.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    day_end = time(23, 31)

    if (morning_start <= now <= morning_end) or (day_start <= now <= day_end):
        asyncio.create_task(ingest_loop())
        print("✅ Ingest loop started: within trading windows.")
    else:
        print("⏸️ Ingest loop not started: outside trading time.")

    asyncio.create_task(redis_subscriber())


@app.websocket("/ws/{inst_id}")
async def ws_endpoint(inst_id: str, ws: WebSocket):
    await manager.connect(inst_id, ws)
    last_sent_data = None  # Keep track of data sent to this client
    try:
        # Send initial data immediately upon connection
        initial_data = await get_latest(inst_id)
        if initial_data:
            await ws.send_json(initial_data)
            last_sent_data = initial_data
        else:
            # Optionally send a message if no data is available yet
            await ws.send_json(
                {"message": f"Waiting for initial data for instrument {inst_id}..."}
            )

        # Continuously check for and send updates every second
        while True:
            current_data = await get_latest(inst_id)
            # Send data only if it's new and different from the last sent data
            if current_data and current_data != last_sent_data:
                await ws.send_json(current_data)
                last_sent_data = current_data
            # Wait for 1 second before checking again
            await asyncio.sleep(1)

    except WebSocketDisconnect:
        print(f"WebSocket disconnected for {inst_id}")  # Added log
        manager.disconnect(inst_id, ws)
    except Exception as e:
        print(f"Error in WebSocket connection for {inst_id}: {e}")
        manager.disconnect(inst_id, ws)


@app.get("/live/{inst_id}")
async def get_live(inst_id: str):
    data = await get_latest(inst_id)
    if not data:
        raise HTTPException(404, "No live data")
    return data


@app.get("/historical/{sid}/{exp}/{timestamp}", response_model=HistoricalResponse)
async def historical(
    sid: int,
    exp: int,
    timestamp: datetime,
    db=Depends(get_db),
    start: Optional[datetime] = None,
    end: Optional[datetime] = None,
):
    """Get historical option data"""
    # Convert inst_id to integer since that's how it's stored in the database
    try:
        symbol_id = int(sid)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid instrument ID")

    # Convert string dates to datetime if provided
    start_date = start if start else datetime.min
    end_date = end if end else datetime.max

    # Try to find an exact match
    exact_match_stmt = (
        select(OptionContract)
        .where(OptionContract.symbol_id == symbol_id)
        .where(OptionContract.exp == exp)
        .where(OptionContract.timestamp == timestamp)
    )
    exact_match_result = await db.execute(exact_match_stmt)
    exact_match_rows = exact_match_result.scalars().all()

    if exact_match_rows:
        rows = exact_match_rows
    else:
        # If no exact match, find the nearest timestamp
        nearest_stmt = (
            select(OptionContract)
            .where(OptionContract.symbol_id == symbol_id)
            .where(OptionContract.exp == exp)
            .order_by(func.abs(OptionContract.timestamp - timestamp))
        )
        nearest_result = await db.execute(nearest_stmt)
        nearest_rows = nearest_result.scalars().all()
        if nearest_rows:
            rows = nearest_rows
        else:
            rows = []


    # Transform the data into the response format
    points = []
    for option in rows:

        points.append(
            HistoricalPoint(
                timestamp=option.timestamp,
                value={
                    "strike_price": option.strike_price,
                    "ce_ltp": option.ce_ltp,
                    "pe_ltp": option.pe_ltp,
                    "ce_open_interest": option.ce_open_interest,
                    "pe_open_interest": option.pe_open_interest,
                    "ce_implied_volatility": option.ce_implied_volatility,
                    "pe_implied_volatility": option.pe_implied_volatility,
                    "ce_delta": option.ce_delta,
                    "pe_delta": option.pe_delta,
                    "ce_theta": option.ce_theta,
                    "pe_theta": option.pe_theta,
                    "ce_gamma": option.ce_gamma,
                    "pe_gamma": option.pe_gamma,
                    "ce_rho": option.ce_rho,
                    "pe_rho": option.pe_rho,
                    "ce_vega": option.ce_vega,
                    "pe_vega": option.pe_vega,
                    "ce_theoretical_price": option.ce_theoretical_price,
                    "pe_theoretical_price": option.pe_theoretical_price,
                    "ce_vol_pcr": option.ce_vol_pcr,
                    "pe_vol_pcr": option.pe_vol_pcr,
                    "ce_oi_pcr": option.ce_oi_pcr,
                    "pe_oi_pcr": option.pe_oi_pcr,
                    "ce_max_pain_loss": option.ce_max_pain_loss,
                    "pe_max_pain_loss": option.pe_max_pain_loss,
                    "ce_price_change": option.ce_price_change,
                    "pe_price_change": option.pe_price_change,
                    "ce_price_change_percent": option.ce_price_change_percent,
                    "pe_price_change_percent": option.pe_price_change_percent,
                    "ce_volume": option.ce_volume,
                    "pe_volume": option.pe_volume,
                    "ce_volume_change": option.ce_volume_change,
                    "pe_volume_change": option.pe_volume_change,
                    "ce_volume_change_percent": option.ce_volume_change_percent,
                    "pe_volume_change_percent": option.pe_volume_change_percent,
                },
            )
        )

    return HistoricalResponse(
        sid=sid,
        exp=str(exp),
        timestamp=timestamp,
        points=points,
        actual_timestamps=[str(option.timestamp) for option in rows],
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
async def get_oidata(
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
        "data": filter_data(options),
    }
