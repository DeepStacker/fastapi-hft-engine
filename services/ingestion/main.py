import asyncio
import signal
import time
import json
from datetime import datetime, time as dt_time
import pytz
from aiokafka import AIOKafkaProducer
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.messaging.producer import kafka_producer
from services.ingestion.dhan_client import DhanApiClient
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME, INGESTION_COUNT, INGESTION_ERRORS
from core.config.dynamic_config import get_config_manager
from core.utils.caching import instrument_multi_cache, expiry_multi_cache, cached

# Configure logging
configure_logger()
logger = get_logger("ingestion-service")
settings = get_settings()

# Dynamic configuration manager
config_manager = None

@cached(instrument_multi_cache, key_func=lambda: "active_list")
async def get_active_instruments_cached():
    """Fetch active instruments from DB with caching."""
    from core.database.db import async_session_factory
    from core.database.models import InstrumentDB
    from sqlalchemy import select

    async with async_session_factory() as session:
        result = await session.execute(
            select(InstrumentDB).where(InstrumentDB.is_active == True)
        )
        instruments = result.scalars().all()
        
        # Serialize for cache
        return [
            {
                "symbol": i.symbol,
                "symbol_id": i.symbol_id,
                "segment_id": i.segment_id
            }
            for i in instruments
        ]

async def get_expiry_dates_cached(client: DhanApiClient, symbol_id: int, segment_id: int):
    """Get expiry dates with caching (manual check to allow client usage)."""
    key = str(symbol_id)
    
    # Try cache
    cached_expiries = await expiry_multi_cache.get(key)
    if cached_expiries:
        return cached_expiries
        
    # Fetch from API
    expiries = await client.fetch_expiry_dates(symbol_id, segment_id)
    
    # Update cache
    if expiries:
        await expiry_multi_cache.set(key, expiries)
        
    return expiries

def is_market_open(segment_id: int) -> bool:
    """
    Check if market is open for a specific segment.
    
    Segments:
    0 = Indices (Equity)
    1 = Equity (Stocks)
    5 = Commodities
    """
    if not config_manager:
        return False
        
    # 1. Check Bypass (Testing Mode)
    if config_manager.get("bypass_trading_hours", False):
        return True
        
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    current_time = now.time()
    today_str = now.strftime("%Y-%m-%d")
    
    # 2. Check Holidays
    holidays = config_manager.get("holidays", [])
    if isinstance(holidays, str):
        try:
            holidays = json.loads(holidays)
        except Exception:
            holidays = []
            
    if today_str in holidays:
        return False
    
    # 3. Check Weekends
    if now.weekday() >= 5:
        if not config_manager.get("enable_weekend_trading", False):
            return False

    # 4. Check Time based on Segment
    if segment_id == 5: # Commodity
        start_str = config_manager.get("commodity_trading_start_time", "09:00")
        end_str = config_manager.get("commodity_trading_end_time", "23:55")
    else: # Equity / Indices
        start_str = config_manager.get("trading_start_time", "09:15")
        end_str = config_manager.get("trading_end_time", "15:30")
    
    try:
        start_hour, start_min = map(int, start_str.split(":"))
        end_hour, end_min = map(int, end_str.split(":"))
        
        start_time = dt_time(start_hour, start_min)
        end_time = dt_time(end_hour, end_min)
        
        return start_time <= current_time <= end_time
    except Exception:
        # Fallback defaults
        if segment_id == 5:
            return dt_time(9, 0) <= current_time <= dt_time(23, 55)
        return dt_time(9, 15) <= current_time <= dt_time(15, 30)

async def process_instrument(instrument: dict, dhan_client: DhanApiClient, producer: AIOKafkaProducer, semaphore: asyncio.Semaphore):
    """Process a single instrument: fetch data and publish to Kafka."""
    symbol = instrument['symbol']
    symbol_id = instrument['symbol_id']
    segment_id = instrument['segment_id']
    
    async with semaphore:
        # FAST CHECK: Is market still open?
        # This handles the case where config changed while this task was waiting in the queue
        if not is_market_open(segment_id):
            return

        try:
            # 1. Fetch Expiry Dates (Cached)
            expiries = await get_expiry_dates_cached(dhan_client, symbol_id, segment_id)
            
            if not expiries:
                logger.warning(f"No expiries found for {symbol}")
                return
                
            # For now, just fetch the nearest expiry (first one)
            target_expiry = expiries[0]
            
            # 2. Fetch Option Chain (Direct API - Realtime)
            # This response contains both Option Chain ('oc') and Spot Data ('sltp')
            chain_response = await dhan_client.fetch_option_chain(
                symbol_id, 
                target_expiry, 
                segment_id
            )
            
            if chain_response and 'data' in chain_response:
                data = chain_response['data']
                chain_data = data.get('oc', {})
                
                if chain_data:
                    # Construct COMPLETE message payload with ALL API fields
                    message = {
                        "symbol": symbol,
                        "symbol_id": symbol_id,
                        "segment_id": segment_id,
                        "expiry": target_expiry,
                        "timestamp": datetime.utcnow().isoformat(),
                        
                        # Option chain data
                        "option_chain": chain_data,
                        
                        # Futures data (CRITICAL for Futures-Spot Basis analysis)
                        "futures_list": data.get('fl', {}),
                        
                        # Global context & summary metrics
                        "global_context": {
                            # Spot data
                            "spot_ltp": data.get('sltp'),
                            "spot_volume": data.get('svol'),
                            "spot_change": data.get('SChng'),
                            "spot_pct_change": data.get('SPerChng'),
                            "spot_exchange": data.get('s_xch'),
                            "spot_segment": data.get('s_seg'),
                            "spot_sid": data.get('s_sid'),
                            
                            # IV Metrics (CRITICAL for VIX-IV Divergence)
                            "atm_iv": data.get('atmiv'),
                            "atm_iv_pct_change": data.get('aivperchng'),
                            
                            # OI & PCR Metrics
                            "total_call_oi": data.get('OIC'),
                            "total_put_oi": data.get('OIP'),
                            "pcr_ratio": data.get('Rto'),
                            
                            # Contract Specifications
                            "option_lot_size": data.get('olot'),
                            "option_tick_size": data.get('otick'),
                            "option_multiplier": data.get('omulti'),
                            
                            # Instrument Details
                            "futures_inst": data.get('finst'),
                            "options_inst": data.get('oinst'),
                            "spot_inst": data.get('sinst'),
                            "exchange": data.get('exch'),
                            "segment": data.get('seg'),
                            "underlying_id": data.get('u_id'),
                            
                            # Expiry & Timing
                            "days_to_expiry": data.get('dte'),
                            "expiry_list": data.get('explst', []),
                            
                            # Additional Analytics
                            "max_pain_strike": data.get('mxpn_strk')
                        }
                    }
                    
                    # Publish to Kafka
                    await producer.send_and_wait(
                        settings.KAFKA_TOPIC_MARKET_RAW,
                        message
                    )
                    
                    INGESTION_COUNT.labels(symbol=symbol).inc()
                    logger.debug(f"Published data for {symbol} ({target_expiry})")
            
        except Exception as e:
            INGESTION_ERRORS.labels(type="fetch_error").inc()
            logger.error(f"Error processing {symbol}: {e}")

async def main():
    """Main ingestion loop"""
    logger.info("Starting Ingestion Service")
    
    global config_manager
    config_manager = await get_config_manager()
    
    # Initialize Kafka producer
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )
    await producer.start()
    
    dhan_client = DhanApiClient()
    
    # Limit concurrent API calls to prevent circuit breaker tripping
    # Dhan API likely has rate limits (e.g., 10 req/sec)
    semaphore = asyncio.Semaphore(5)
    
    # Event to interrupt sleep on config change
    config_updated_event = asyncio.Event()
    
    async def on_config_update(key, value):
        logger.info(f"Config updated: {key} = {value}")
        config_updated_event.set()
        
    await config_manager.subscribe_to_changes(on_config_update)
    
    # Helper for interruptible sleep
    async def interruptible_sleep(seconds: float):
        try:
            await asyncio.wait_for(config_updated_event.wait(), timeout=seconds)
            config_updated_event.clear()
            logger.info("Sleep interrupted by config change")
        except asyncio.TimeoutError:
            pass
    
    try:
        while True:
            # Get active instruments (Cached)
            instruments = await get_active_instruments_cached()
            
            if not instruments:
                logger.warning("No active instruments found")
                await interruptible_sleep(10)
                continue
                
            # Filter instruments based on market hours
            instruments_to_process = [
                i for i in instruments 
                if is_market_open(i['segment_id'])
            ]
            
            if not instruments_to_process:
                logger.info("Markets closed for all active instruments, sleeping...")
                await interruptible_sleep(60)
                continue
                
            logger.info(f"Processing {len(instruments_to_process)} active instruments concurrently (limit: 5)")
            
            # Process all instruments concurrently with semaphore
            start_time = datetime.now()
            
            tasks = [
                process_instrument(instrument, dhan_client, producer, semaphore)
                for instrument in instruments_to_process
            ]
            await asyncio.gather(*tasks)
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"Cycle completed in {elapsed:.2f}s")
            
            # Dynamic sleep based on config
            sleep_time = config_manager.get("fetch_interval", 1.0)
            
            # Adjust sleep time to maintain fixed interval if possible
            actual_sleep = max(0, sleep_time - elapsed)
            if actual_sleep > 0:
                await interruptible_sleep(actual_sleep)
            
    except Exception as e:
        logger.critical(f"Critical error in ingestion service: {e}")
    finally:
        await producer.stop()
        if config_manager:
            await config_manager.close()

if __name__ == "__main__":
    # Start metrics server
    start_metrics_server(8000)
    
    # Run main loop
    asyncio.run(main())
