"""
Real-time Analytics Calculator

Background service that continuously calculates and publishes:
- Market Mood Index
- PCR values
- Support/Resistance levels
- Overall metrics

Runs every minute during market hours.
"""

import asyncio
from datetime import datetime, timedelta
import structlog
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from core.database.connection import get_async_session
from core.database.models import OptionContractDB, InstrumentDB, MarketSnapshotDB
from services.analytics.market_mood import MarketMoodCalculator
from services.analytics.pcr_calculator import PCRCalculator
from services.analytics.support_resistance import SupportResistanceDetector
import redis.asyncio as redis
from core.config.settings import get_settings
import json

logger = structlog.get_logger("realtime-analytics")
settings = get_settings()

# Redis client for publishing
redis_client = None


async def get_active_symbols(db: AsyncSession) -> list:
    """Get all active trading symbols"""
    stmt = select(InstrumentDB).where(InstrumentDB.is_active == True)
    result = await db.execute(stmt)
    instruments = result.scalars().all()
    return instruments


async def get_latest_expiry(db: AsyncSession, symbol_id: int) -> str:
    """Get the nearest expiry for a symbol"""
    stmt = select(OptionContractDB.expiry).where(
        OptionContractDB.symbol_id == symbol_id
    ).distinct().order_by(OptionContractDB.expiry).limit(1)
    
    result = await db.execute(stmt)
    expiry = result.scalar_one_or_none()
    return expiry


async def calculate_and_publish_analytics(db: AsyncSession):
    """Main analytics calculation loop"""
    global redis_client
    
    try:
        # Get active symbols
        instruments = await get_active_symbols(db)
        
        for instrument in instruments:
            symbol_id = instrument.symbol_id
            
            # Get latest expiry
            expiry = await get_latest_expiry(db, symbol_id)
            if not expiry:
                logger.warning(f"No expiry found for symbol_id={symbol_id}")
                continue
            
            logger.info(f"Calculating analytics for {instrument.symbol} (ID: {symbol_id})")
            
            # 1. Calculate Market Mood
            try:
                mood_calc = MarketMoodCalculator(db)
                mood_data = await mood_calc.calculate_market_mood(
                    symbol_id=symbol_id,
                    expiry=expiry,
                    save_to_db=True
                )
                
                # Publish to Redis
                await redis_client.publish(
                    f"live:market_mood:{symbol_id}",
                    json.dumps({
                        "symbol_id": symbol_id,
                        "timestamp": mood_data["timestamp"].isoformat(),
                        "mood_score": mood_data["mood_score"],
                        "sentiment": mood_data["sentiment"],
                        "components": mood_data["components"]
                    })
                )
                logger.info(f"Market mood published: {mood_data['sentiment']}")
                
            except Exception as e:
                logger.error(f"Error calculating market mood: {e}")
            
            # 2. Calculate PCR
            try:
                pcr_calc = PCRCalculator(db)
                pcr_data = await pcr_calc.calculate_pcr(
                    symbol_id=symbol_id,
                    expiry=expiry,
                    save_to_db=True
                )
                
                # Publish to Redis
                await redis_client.publish(
                    f"live:pcr:{symbol_id}",
                    json.dumps({
                        "symbol_id": symbol_id,
                        "expiry": expiry,
                        "timestamp": pcr_data["timestamp"].isoformat(),
                        "pcr_oi": pcr_data["pcr_oi"],
                        "pcr_volume": pcr_data["pcr_volume"],
                        "max_pain_strike": pcr_data.get("max_pain_strike")
                    })
                )
                logger.info(f"PCR published: OI={pcr_data['pcr_oi']}, Vol={pcr_data['pcr_volume']}")
                
            except Exception as e:
                logger.error(f"Error calculating PCR: {e}")
            
            # 3. Detect S/R Levels
            try:
                sr_detector = SupportResistanceDetector(db)
                levels = await sr_detector.detect_levels(
                    symbol_id=symbol_id,
                    expiry=expiry,
                    save_to_db=True
                )
                
                # Publish to Redis
                await redis_client.publish(
                    f"live:sr_levels:{symbol_id}",
                    json.dumps({
                        "symbol_id": symbol_id,
                        "expiry": expiry,
                        "timestamp": datetime.utcnow().isoformat(),
                        "levels": levels[:10]  # Top 10 levels
                    })
                )
                logger.info(f"S/R levels published: {len(levels)} levels detected")
                
            except Exception as e:
                logger.error(f"Error detecting S/R levels: {e}")
            
            # 4. Calculate Overall Metrics
            try:
                stmt = select(
                    func.sum(func.case((OptionContractDB.option_type == 'CE', OptionContractDB.oi), else_=0)).label('call_oi'),
                    func.sum(func.case((OptionContractDB.option_type == 'PE', OptionContractDB.oi), else_=0)).label('put_oi'),
                    func.sum(func.case((OptionContractDB.option_type == 'CE', OptionContractDB.volume), else_=0)).label('call_vol'),
                    func.sum(func.case((OptionContractDB.option_type == 'PE', OptionContractDB.volume), else_=0)).label('put_vol')
                ).where(
                    OptionContractDB.symbol_id == symbol_id,
                    OptionContractDB.expiry == expiry
                ).order_by(OptionContractDB.timestamp.desc()).limit(1)
                
                result = await db.execute(stmt)
                metrics = result.one_or_none()
                
                if metrics:
                    await redis_client.publish(
                        f"live:overall_metrics:{symbol_id}",
                        json.dumps({
                            "symbol_id": symbol_id,
                            "timestamp": datetime.utcnow().isoformat(),
                            "total_call_oi": int(metrics.call_oi or 0),
                            "total_put_oi": int(metrics.put_oi or 0),
                            "total_call_volume": int(metrics.call_vol or 0),
                            "total_put_volume": int(metrics.put_vol or 0)
                        })
                    )
                    logger.info("Overall metrics published")
                
            except Exception as e:
                logger.error(f"Error calculating overall metrics: {e}")
        
        logger.info("Analytics calculation cycle completed")
        
    except Exception as e:
        logger.error(f"Error in analytics loop: {e}", exc_info=True)


async def analytics_service():
    """Main service loop"""
    global redis_client
    
    # Initialize Redis
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    logger.info("Redis client initialized")
    
    while True:
        try:
            # Check if it's market hours (9:15 AM - 3:30 PM IST)
            now = datetime.now()
            market_start = now.replace(hour=9, minute=15, second=0)
            market_end = now.replace(hour=15, minute=30, second=0)
            
            if market_start <= now <= market_end:
                # Get database session
                async for db in get_async_session():
                    await calculate_and_publish_analytics(db)
                    break
                
                # Wait 1 minute before next calculation
                await asyncio.sleep(60)
            else:
                # Outside market hours, check every 5 minutes
                logger.info("Outside market hours, sleeping...")
                await asyncio.sleep(300)
        
        except Exception as e:
            logger.error(f"Error in analytics service: {e}", exc_info=True)
            await asyncio.sleep(60)  # Wait 1 minute before retry


if __name__ == "__main__":
    asyncio.run(analytics_service())
