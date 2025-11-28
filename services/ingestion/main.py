import asyncio
import signal
import time
from datetime import datetime
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.messaging.producer import kafka_producer
from services.ingestion.dhan_client import DhanApiClient
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME
from core.config.dynamic_config import get_config_manager

# Configure logging
configure_logger()
logger = get_logger("ingestion-service")
settings = get_settings()

# Dynamic configuration manager
config_manager = None

async def get_active_instruments():
    """Fetch active instruments from DB."""
    from core.database.db import async_session_factory
    from core.database.models import InstrumentDB
    from sqlalchemy import select

    async with async_session_factory() as session:
        result = await session.execute(select(InstrumentDB).where(InstrumentDB.is_active == True))
        return [row.symbol_id for row in result.scalars().all()]

def is_trading_hours():
    """Check if current time is within trading hours (dynamic config)."""
    from datetime import time as dt_time
    import pytz
    
    ist = pytz.timezone('Asia/Kolkata')
    now = datetime.now(ist)
    current_time = now.time()
    
    # Weekends check
    if now.weekday() >= 5:
        return False

    # Get trading hours from config (default to 09:15 - 15:30)
    start_str = config_manager.get("trading_start_time", "09:15")
    end_str = config_manager.get("trading_end_time", "15:30")
    
    # Parse time strings (HH:MM)
    try:
        start_hour, start_min = map(int, start_str.split(":"))
        end_hour, end_min = map(int, end_str.split(":"))
        start_time = dt_time(start_hour, start_min)
        end_time = dt_time(end_hour, end_min)
    except (ValueError, AttributeError):
        # Fallback to defaults if parsing fails
        start_time = dt_time(9, 15)
        end_time = dt_time(15, 30)
    
    return start_time <= current_time <= end_time

async def fetch_and_publish(client: DhanApiClient, symbol_id: int):
    """
    Fetch data from Dhan API and publish to Kafka with retry logic (dynamic retries).
    """
    max_retries = config_manager.get_int("api_max_retries", 3)
    
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
    global config_manager
    
    # Initialize ConfigManager
    config_manager = await get_config_manager()
    logger.info("ConfigManager initialized")
    
    # Subscribe to config changes
    async def on_config_change(key: str, new_value):
        logger.info(f"Config updated: {key} = {new_value}")
    
    await config_manager.subscribe_to_changes(on_config_change)
    
    # Start metrics server
    start_metrics_server(8000)
    
    client = DhanApiClient()
    await kafka_producer.start()
    
    logger.info("Starting ingestion loop...")
    
    # Get dynamic configs
    fallback_symbols = config_manager.get_list("fallback_symbols", [13, 25, 27, 442])
    instruments = fallback_symbols
    last_instrument_refresh = time.time()
    
    try:
        while True:
            # Get dynamic refresh interval
            refresh_interval = config_manager.get_int("instrument_refresh_interval", 60)
            
            # Refresh instruments list periodically
            if time.time() - last_instrument_refresh > refresh_interval:
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
                sleep_duration = config_manager.get_int("sleep_outside_hours", 60)
                await asyncio.sleep(sleep_duration)
                continue

            # Get dynamic fetch interval
            fetch_interval = config_manager.get_int("fetch_interval", 1)
            await asyncio.sleep(fetch_interval)
    except asyncio.CancelledError:
        logger.info("Ingestion loop cancelled")
    finally:
        await kafka_producer.stop()
        await config_manager.close()

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
