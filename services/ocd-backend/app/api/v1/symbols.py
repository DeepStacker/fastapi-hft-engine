"""
Symbols API Router

Provides dynamic symbol list from database instead of hardcoded configuration.
"""
from fastapi import APIRouter, Depends
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.config.database import get_db
from core.database.models import InstrumentDB

router = APIRouter(prefix="/symbols", tags=["symbols"])


@router.get("")
async def get_symbols(
    active_only: bool = True,
    segment_id: int = None,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get trading symbols from database.
    
    Args:
        active_only: If true, return only active instruments (default: true)
        segment_id: Filter by segment (0=Indices, 1=Equity, 5=Commodities)
    
    Returns:
        Dict with symbols list and metadata
    """
    query = select(InstrumentDB)
    
    if active_only:
        query = query.where(InstrumentDB.is_active == True)
    
    if segment_id is not None:
        query = query.where(InstrumentDB.segment_id == segment_id)
    
    query = query.order_by(InstrumentDB.symbol)
    
    result = await db.execute(query)
    instruments = result.scalars().all()
    
    # Group by segment for frontend convenience
    indices = []
    equities = []
    commodities = []
    
    for inst in instruments:
        symbol_data = {
            "symbol": inst.symbol,
            "symbol_id": inst.symbol_id,
            "segment_id": inst.segment_id,
            "is_active": inst.is_active,
            "display_name": inst.symbol  # Use symbol as display name
        }
        
        if inst.segment_id == 0:
            indices.append(symbol_data)
        elif inst.segment_id == 5:
            commodities.append(symbol_data)
        else:
            equities.append(symbol_data)
    
    return {
        "symbols": [inst.symbol for inst in instruments],
        "total": len(instruments),
        "by_segment": {
            "indices": indices,
            "equities": equities,
            "commodities": commodities
        },
        "segment_counts": {
            "indices": len(indices),
            "equities": len(equities),
            "commodities": len(commodities)
        }
    }


@router.get("/simple")
async def get_symbols_simple(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
) -> List[str]:
    """
    Get simple list of symbol names only.
    
    Lightweight endpoint for dropdown menus.
    """
    query = select(InstrumentDB.symbol)
    
    if active_only:
        query = query.where(InstrumentDB.is_active == True)
    
    query = query.order_by(InstrumentDB.symbol)
    
    result = await db.execute(query)
    symbols = result.scalars().all()
    
    return list(symbols)
