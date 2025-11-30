"""
Instruments Management Router

Handles instrument CRUD operations and activation for ingestion.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy import select, update, delete
from services.api_gateway.auth import get_current_admin_user
from services.admin.models import Instrument, InstrumentCreate, InstrumentUpdate
from core.database.db import async_session_factory
from core.database.models import InstrumentDB
from services.admin.services.cache import cache_service
import logging
import json

logger = logging.getLogger("stockify.admin.instruments")
router = APIRouter(prefix="/instruments", tags=["instruments"])

async def notify_instrument_update():
    """Notify other services about instrument updates"""
    # 1. Invalidate Ingestion Service L2 Cache
    # Key format from core.utils.caching: prefix + ":" + key
    await cache_service.delete("instrument:active_list")
    
    # 2. Publish Event for L1 Cache Invalidation
    if not cache_service.redis:
        await cache_service.connect()
    
    await cache_service.redis.publish("events:instrument_update", "update")
    logger.info("Published instrument update event")


@router.get("", response_model=List[Instrument])
async def list_instruments(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = False,
    admin = Depends(get_current_admin_user)
):
    """List all instruments with pagination"""
    # Try cache first
    cache_key = f"instruments:list:{active_only}:{skip}:{limit}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return [Instrument(**item) for item in cached_data]

    async with async_session_factory() as session:
        query = select(InstrumentDB)
        
        if active_only:
            query = query.where(InstrumentDB.is_active == True)
        
        query = query.offset(skip).limit(limit)
        result = await session.execute(query)
        instruments = result.scalars().all()
        
        response_data = [
            Instrument(
                id=inst.id,
                symbol_id=inst.symbol_id,
                symbol=inst.symbol,
                segment_id=inst.segment_id,
                is_active=inst.is_active,
                created_at=inst.created_at,
                updated_at=inst.updated_at
            )
            for inst in instruments
        ]
        
        # Cache the result (serialize to dict)
        await cache_service.set(
            cache_key, 
            [inst.dict() for inst in response_data], 
            ttl=3600
        )
        
        return response_data


@router.get("/{instrument_id}", response_model=Instrument)
async def get_instrument(
    instrument_id: int,
    admin = Depends(get_current_admin_user)
):
    """Get a specific instrument by ID"""
    # Try cache first
    cache_key = f"instruments:detail:{instrument_id}"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return Instrument(**cached_data)

    async with async_session_factory() as session:
        result = await session.execute(
            select(InstrumentDB).where(InstrumentDB.id == instrument_id)
        )
        instrument = result.scalar_one_or_none()
        
        if not instrument:
            raise HTTPException(status_code=404, detail="Instrument not found")
        
        response_data = Instrument(
            id=instrument.id,
            symbol_id=instrument.symbol_id,
            symbol=instrument.symbol,
            segment_id=instrument.segment_id,
            is_active=instrument.is_active,
            created_at=instrument.created_at,
            updated_at=instrument.updated_at
        )
        
        # Cache the result
        await cache_service.set(cache_key, response_data.dict(), ttl=3600)
        
        return response_data


@router.post("", response_model=Instrument)
async def create_instrument(
    instrument: InstrumentCreate,
    admin = Depends(get_current_admin_user)
):
    """Create a new instrument"""
    async with async_session_factory() as session:
        # Check if symbol_id already exists
        existing = await session.execute(
            select(InstrumentDB).where(InstrumentDB.symbol_id == instrument.symbol_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=400,
                detail=f"Instrument with symbol_id {instrument.symbol_id} already exists"
            )
        
        new_instrument = InstrumentDB(
            symbol_id=instrument.symbol_id,
            symbol=instrument.symbol,
            segment_id=instrument.segment_id,
            is_active=instrument.is_active
        )
        
        session.add(new_instrument)
        await session.commit()
        await session.refresh(new_instrument)
        
        logger.info(f"Created instrument: {instrument.symbol} (ID: {new_instrument.id})")
        
        # Invalidate list caches
        await cache_service.invalidate_pattern("instruments:list:*")
        await notify_instrument_update()
        
        return Instrument(
            id=new_instrument.id,
            symbol_id=new_instrument.symbol_id,
            symbol=new_instrument.symbol,
            segment_id=new_instrument.segment_id,
            is_active=new_instrument.is_active,
            created_at=new_instrument.created_at,
            updated_at=new_instrument.updated_at
        )


@router.put("/{instrument_id}", response_model=Instrument)
async def update_instrument(
    instrument_id: int,
    instrument: InstrumentUpdate,
    admin = Depends(get_current_admin_user)
):
    """Update an instrument"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(InstrumentDB).where(InstrumentDB.id == instrument_id)
        )
        db_instrument = result.scalar_one_or_none()
        
        if not db_instrument:
            raise HTTPException(status_code=404, detail="Instrument not found")
        
        # Update fields
        if instrument.symbol is not None:
            db_instrument.symbol = instrument.symbol
        if instrument.is_active is not None:
            db_instrument.is_active = instrument.is_active
        
        await session.commit()
        await session.refresh(db_instrument)
        
        logger.info(f"Updated instrument ID: {instrument_id}")
        
        # Invalidate caches
        await cache_service.delete(f"instruments:detail:{instrument_id}")
        await cache_service.invalidate_pattern("instruments:list:*")
        await notify_instrument_update()
        
        return Instrument(
            id=db_instrument.id,
            symbol_id=db_instrument.symbol_id,
            symbol=db_instrument.symbol,
            segment_id=db_instrument.segment_id,
            is_active=db_instrument.is_active,
            created_at=db_instrument.created_at,
            updated_at=db_instrument.updated_at
        )


@router.delete("/{instrument_id}")
async def delete_instrument(
    instrument_id: int,
    admin = Depends(get_current_admin_user)
):
    """Delete an instrument"""
    async with async_session_factory() as session:
        result = await session.execute(
            select(InstrumentDB).where(InstrumentDB.id == instrument_id)
        )
        instrument = result.scalar_one_or_none()
        
        if not instrument:
            raise HTTPException(status_code=404, detail="Instrument not found")
        
        await session.execute(
            delete(InstrumentDB).where(InstrumentDB.id == instrument_id)
        )
        await session.commit()
        
        logger.info(f"Deleted instrument ID: {instrument_id}")
        
        # Invalidate caches
        await cache_service.delete(f"instruments:detail:{instrument_id}")
        await cache_service.invalidate_pattern("instruments:list:*")
        await notify_instrument_update()
        
        return {"message": f"Instrument {instrument_id} deleted successfully"}


@router.post("/{instrument_id}/activate")
async def activate_instrument(
    instrument_id: int,
    admin = Depends(get_current_admin_user)
):
    """Activate an instrument for ingestion"""
    async with async_session_factory() as session:
        await session.execute(
            update(InstrumentDB)
            .where(InstrumentDB.id == instrument_id)
            .values(is_active=True)
        )
        await session.commit()
        
        logger.info(f"Activated instrument ID: {instrument_id}")
        
        # Invalidate caches
        await cache_service.delete(f"instruments:detail:{instrument_id}")
        await cache_service.invalidate_pattern("instruments:list:*")
        await notify_instrument_update()
        
        return {"message": f"Instrument {instrument_id} activated"}


@router.post("/{instrument_id}/deactivate")
async def deactivate_instrument(
    instrument_id: int,
    admin = Depends(get_current_admin_user)
):
    """Deactivate an instrument"""
    async with async_session_factory() as session:
        await session.execute(
            update(InstrumentDB)
            .where(InstrumentDB.id == instrument_id)
            .values(is_active=False)
        )
        await session.commit()
        
        logger.info(f"Deactivated instrument ID: {instrument_id}")
        
        # Invalidate caches
        await cache_service.delete(f"instruments:detail:{instrument_id}")
        await cache_service.invalidate_pattern("instruments:list:*")
        await notify_instrument_update()
        
        return {"message": f"Instrument {instrument_id} deactivated"}


# WebSocket for real-time Instrument updates
from fastapi import WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
import asyncio
from core.config.settings import get_settings

@router.websocket("/ws")
async def websocket_instruments(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    Real-time instrument status updates via WebSocket
    """
    settings = get_settings()
    
    # Validate token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    
    try:
        while True:
            try:
                # Use cache for WebSocket updates too!
                cache_key = "instruments:list:False:0:1000" # Assume default large limit for WS
                cached_data = await cache_service.get(cache_key)
                
                if cached_data:
                     await websocket.send_json({
                        "type": "instruments_update",
                        "data": cached_data
                    })
                else:
                    # Fallback to DB if cache miss (and populate it)
                    async with async_session_factory() as session:
                        result = await session.execute(select(InstrumentDB))
                        instruments = result.scalars().all()
                        
                        data = [
                            {
                                "id": inst.id,
                                "symbol_id": inst.symbol_id,
                                "symbol": inst.symbol,
                                "segment_id": inst.segment_id,
                                "is_active": inst.is_active,
                                "updated_at": inst.updated_at.isoformat() if inst.updated_at else None
                            }
                            for inst in instruments
                        ]
                        
                        # Cache it
                        await cache_service.set(cache_key, data, ttl=3600)
                        
                        await websocket.send_json({
                            "type": "instruments_update",
                            "data": data
                        })
            except (WebSocketDisconnect, RuntimeError):
                logger.info("WebSocket disconnected")
                break
            except Exception as e:
                logger.error(f"Error fetching instruments: {e}")
                # Don't break loop on transient errors, but sleep to avoid spam
                await asyncio.sleep(5)
            
            # Poll every 2 seconds
            await asyncio.sleep(2)
            
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"WebSocket error in instruments: {e}")
