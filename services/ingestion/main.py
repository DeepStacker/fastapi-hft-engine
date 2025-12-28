"""
Ingestion Service - Main Entry Point

Fetches real-time market data from Dhan API and publishes to Kafka.

BREAKING CHANGES:
- Symbol partitioning for horizontal scaling
- Circuit breaker for API resilience
- Retry mechanism with exponential backoff
- Kafka cluster integration
- Avro binary serialization
- Distributed tracing with OpenTelemetry
"""
import asyncio
import signal
import time
import os
import json
from datetime import datetime, time as dt_time
from typing import List, Dict
from contextlib import asynccontextmanager
import pytz

from fastapi import FastAPI
from aiokafka import AIOKafkaProducer

from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.monitoring.metrics import (
    start_metrics_server,
    MESSAGES_PROCESSED,
    PROCESSING_TIME,
    INGESTION_COUNT,
    INGESTION_ERRORS
)
from core.config.dynamic_config import get_config_manager
from core.utils.caching import instrument_multi_cache, expiry_multi_cache, cached, get_redis_client
from core.utils.token_cache import TokenCacheManager
from services.ingestion.dhan_client import DhanApiClient

# BREAKING CHANGE: Distributed tracing
from core.observability.tracing import (
    distributed_tracer,
    instrument_fastapi,
    create_kafka_headers_with_trace,
    traced
)

# Symbol partitioner for horizontal scaling
from services.ingestion.partitioner import SymbolPartitioner

# BREAKING CHANGE: Circuit breaker and retry for resilience
from core.resilience.circuit_breaker import CircuitBreaker
from core.resilience.retry import retry, exponential_with_jitter

# BREAKING CHANGE: Avro serialization
from core.serialization.avro_serializer import avro_serializer

# Database pool for instrument queries
from core.database.pool import db_pool

# Configure logging
configure_logger()
logger = get_logger("ingestion-service")
settings = get_settings()

# Global config manager
config_manager = None


# BREAKING CHANGE: Lifespan context manager for proper startup/shutdown
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    BREAKING CHANGE: Initializes distributed tracing on startup
    """
    # Startup
    logger.info("Starting Ingestion Service...")
    
    # BREAKING CHANGE: Initialize distributed tracing
    distributed_tracer.initialize(
        service_name="ingestion-service",
        jaeger_host=os.getenv("JAEGER_HOST", "jaeger"),
        jaeger_port=int(os.getenv("JAEGER_PORT", "6831"))
    )
    logger.info("✓ Distributed tracing initialized (Jaeger)")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Ingestion Service...")


# Create FastAPI app with tracing
app = FastAPI(
    title="Ingestion Service",
    version="5.0.0",
    lifespan=lifespan
)

# BREAKING CHANGE: Auto-instrument FastAPI for tracing
instrument_fastapi(app)
logger.info("✓ FastAPI instrumented for distributed tracing")


@cached(instrument_multi_cache, key_func=lambda: "active_list")
async def get_active_instruments_cached():
    """Fetch active instruments from DB with caching."""
    from core.database.pool import read_session
    from core.database.models import InstrumentDB
    from sqlalchemy import select

    async with read_session() as session:
        result = await session.execute(
            select(InstrumentDB).where(InstrumentDB.is_active == True)
        )
        instruments = result.scalars().all()
        
        # Serialize for cache - include both symbol_id and security_id for compatibility
        return [
            {
                "symbol": i.symbol,
                "symbol_id": i.symbol_id,
                "security_id": i.symbol_id,  # Alias for partitioner compatibility
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
    if segment_id == 5:  # Commodity
        start_str = config_manager.get("commodity_trading_start_time", "09:00")
        end_str = config_manager.get("commodity_trading_end_time", "23:55")
    else:  # Equity / Indices
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


@traced("process_instrument")
async def process_instrument_with_resilience(
    instrument: dict,
    dhan_client: DhanApiClient,
    producer: AIOKafkaProducer,
    semaphore: asyncio.Semaphore,
    circuit_breaker: CircuitBreaker
):
    """
    Process instrument with circuit breaker and retry logic
    
    BREAKING CHANGE: Includes distributed tracing via @traced decorator
    """
    symbol = instrument['symbol']
    symbol_id = instrument['symbol_id']
    segment_id = instrument['segment_id']
    
    async with semaphore:
        # Note: Market hours check is already done in the main loop
        # Removed redundant check here that was causing race conditions
        
        logger.debug(f"Starting processing for {symbol} (ID: {symbol_id})")
        
        @retry(max_attempts=3, backoff=exponential_with_jitter, base_delay=0.5)
        async def fetch_with_retry():
            """Fetch data with automatic retry"""
            # Wrap in circuit breaker
            if not circuit_breaker.allow_request():
                raise Exception("Circuit breaker is OPEN - too many failures")
            
            try:
                # Get tracer for manual spans
                tracer = distributed_tracer.get_tracer()
                
                # 1. Fetch Expiry Dates (Cached)
                logger.debug(f"Fetching expiry dates for {symbol}")
                with tracer.start_as_current_span("fetch_expiry_dates") as span:
                    span.set_attribute("symbol_id", symbol_id)
                    expiries = await get_expiry_dates_cached(dhan_client, symbol_id, segment_id)
                
                if not expiries:
                    logger.warning(f"No expiries found for {symbol}")
                    return None
                
                # Filter to future expiries only and use nearest
                import time
                current_ts = int(time.time())
                future_expiries = [e for e in expiries if e > current_ts]
                
                if not future_expiries:
                    # Calculate dynamic expiry based on current date
                    # Weekly expiry is typically Thursday in India
                    from datetime import datetime, timedelta
                    now = datetime.now()
                    
                    # Find next Thursday (weekday 3)
                    days_until_thursday = (3 - now.weekday()) % 7
                    if days_until_thursday == 0 and now.hour >= 15:  # Past 3:30 PM on Thursday
                        days_until_thursday = 7
                    
                    next_expiry_date = now + timedelta(days=days_until_thursday)
                    # Set to 3:30 PM IST (10:00 UTC) for expiry time
                    next_expiry_date = next_expiry_date.replace(hour=15, minute=30, second=0, microsecond=0)
                    target_expiry = int(next_expiry_date.timestamp())
                    
                    logger.info(f"No future expiries from cache for {symbol}, using dynamic expiry: {next_expiry_date.strftime('%Y-%m-%d')}")
                else:
                    target_expiry = future_expiries[0]  # Nearest future expiry
                    logger.debug(f"Got expiry for {symbol}: {target_expiry} (from {len(future_expiries)} future expiries)")
                
                # 2. Fetch Option Chain with circuit breaker protection
                with tracer.start_as_current_span("fetch_option_chain") as span:
                    span.set_attribute("symbol", symbol)
                    span.set_attribute("expiry", target_expiry)
                    
                    chain_response = await dhan_client.fetch_option_chain(
                        symbol_id,
                        target_expiry,
                        segment_id
                    )
                    
                    circuit_breaker.record_success()
                    span.set_attribute("success", True)
                
                logger.debug(f"Got option chain response for {symbol}: {bool(chain_response)}")
                return chain_response, target_expiry
                
            except Exception as e:
                circuit_breaker.record_failure()
                logger.error(f"API call failed for symbol {symbol}: {e}")
                distributed_tracer.record_exception(e)
                raise
        
        try:
            result = await fetch_with_retry()
            
            if result is None:
                return
            
            chain_response, target_expiry = result
            
            if chain_response and 'data' in chain_response:
                data = chain_response['data']
                chain_data = data.get('oc', {})
                
                if chain_data:
                    # Convert expiry from Unix timestamp to ISO date string
                    expiry_date = datetime.fromtimestamp(target_expiry)
                    expiry_str = expiry_date.strftime("%Y-%m-%d")
                    
                    # Serialize map values to JSON strings for Avro map<string> compliance
                    option_chain_serialized = {
                        str(k): json.dumps(v) if not isinstance(v, str) else v 
                        for k, v in chain_data.items()
                    }
                    futures_list_raw = data.get('fl', {})
                    futures_list_serialized = {
                        str(k): json.dumps(v) if not isinstance(v, str) else v 
                        for k, v in futures_list_raw.items()
                    }
                    
                    # Construct message payload
                    message = {
                        "symbol": symbol,
                        "symbol_id": symbol_id,
                        "segment_id": segment_id,
                        "expiry": expiry_str,  # ISO date string for Avro
                        "timestamp": datetime.utcnow().isoformat(),
                        "option_chain": option_chain_serialized,
                        "futures_list": futures_list_serialized,
                        "global_context": {
                            "spot_ltp": data.get('sltp'),
                            "spot_volume": data.get('svol'),
                            "spot_change": data.get('SChng'),
                            "spot_pct_change": data.get('SPerChng'),
                            "atm_iv": data.get('atmiv'),
                            "atm_iv_pct_change": data.get('aivperchng'),
                            "total_call_oi": data.get('OIC'),
                            "total_put_oi": data.get('OIP'),
                            "pcr_ratio": data.get('Rto'),
                            "option_lot_size": data.get('olot'),
                            "days_to_expiry": data.get('dte'),
                            "max_pain_strike": data.get('mxpn_strk')
                        }
                    }
                    
                    # Send to Kafka with trace context
                    with distributed_tracer.get_tracer().start_as_current_span("send_to_kafka") as span:
                        # BREAKING CHANGE: Inject trace context into Kafka headers
                        headers = create_kafka_headers_with_trace()
                        
                        await producer.send_and_wait(
                            settings.KAFKA_TOPIC_MARKET_RAW,
                            value=message,
                            key=str(symbol_id).encode('utf-8'),
                            headers=headers
                        )
                        
                        span.set_attribute("topic", settings.KAFKA_TOPIC_MARKET_RAW)
                        span.set_attribute("symbol_id", symbol_id)
                    
                    INGESTION_COUNT.labels(source=symbol).inc()
                    logger.debug(f"Published data for {symbol} ({target_expiry})")
                    
        except Exception as e:
            INGESTION_ERRORS.labels(error_type="fetch_error").inc()
            logger.error(f"Error processing {symbol} after retries: {e}")
            distributed_tracer.record_exception(e)


async def main():
    """Main ingestion loop with horizontal scaling support"""
    logger.info("Starting Ingestion Service")
    
    # Get instance configuration from environment
    instance_id = int(os.getenv("INSTANCE_ID", "1"))
    total_instances = int(os.getenv("TOTAL_INSTANCES", "1"))
    
    logger.info(f"Instance {instance_id}/{total_instances} starting")
    
    # Initialize distributed tracing (bypasses FastAPI lifespan when running main() directly)
    distributed_tracer.initialize(
        service_name="ingestion-service",
        jaeger_host=os.getenv("JAEGER_HOST", "jaeger"),
        jaeger_port=int(os.getenv("JAEGER_PORT", "6831"))
    )
    
    global config_manager
    config_manager = await get_config_manager()
    
    # Initialize database pool for instrument queries
    await db_pool.initialize()
    logger.info("Database pool initialized")
    
    # Initialize TokenCacheManager for ultra-fast token access
    token_cache = TokenCacheManager(config_manager)
    await token_cache.initialize()
    logger.info("TokenCacheManager initialized with cached tokens")
    
    # Initialize Kafka producer with CLUSTER configuration
    # BREAKING CHANGE: Now uses Avro binary serialization
    producer = AIOKafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS.split(","),
        value_serializer=avro_serializer(settings.KAFKA_TOPIC_MARKET_RAW),
        compression_type='snappy',
        acks='all',
        max_batch_size=32768,
        linger_ms=10,
    )
    await producer.start()
    logger.info(f"Kafka producer started (Avro format): {settings.KAFKA_BOOTSTRAP_SERVERS}")
    logger.info("✓ Using Avro binary serialization (70% smaller, 3x faster than JSON)")
    
    # Initialize Symbol Partitioner for horizontal scaling
    partitioner = SymbolPartitioner(instance_id=instance_id, total_instances=total_instances)
    logger.info(f"Symbol partitioner initialized for instance {instance_id}/{total_instances}")
    
    # Initialize Circuit Breaker for API protection
    api_circuit_breaker = CircuitBreaker(
        failure_threshold=5,
        timeout=60
    )
    
    dhan_client = DhanApiClient(token_cache)
    await dhan_client.initialize()
    
    # Reduced concurrency with circuit breaker
    semaphore = asyncio.Semaphore(5)
    logger.info("Circuit breaker initialized for API protection")
    
    # Event to interrupt sleep on config change
    config_updated_event = asyncio.Event()
    
    async def on_config_update(key, value):
        logger.info(f"Config updated: {key} = {value}")
        config_updated_event.set()
        
    await config_manager.subscribe_to_changes(on_config_update)
    
    # Subscribe to Instrument Updates (Redis Pub/Sub)
    async def listen_for_updates():
        try:
            redis = await get_redis_client()
            pubsub = redis.pubsub()
            await pubsub.subscribe("events:instrument_update")
            
            logger.info("Listening for instrument updates...")
            async for message in pubsub.listen():
                if message['type'] == 'message':
                    logger.info("Received instrument update event - clearing L1 cache")
                    instrument_multi_cache.l1_cache.clear()
                    config_updated_event.set()
        except Exception as e:
            logger.error(f"Error in update listener: {e}")

    # Start listener in background
    asyncio.create_task(listen_for_updates())
    
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
            
            # BREAKING CHANGE: Filter to assigned symbols only
            assigned_instruments = partitioner.get_assigned_symbols(instruments)
            
            # Log distribution on first iteration
            if not hasattr(main, '_logged_distribution'):
                partitioner.log_distribution(instruments)
                main._logged_distribution = True
                logger.info(f"Processing {len(assigned_instruments)} out of {len(instruments)} total symbols")
            
            # Filter by market hours
            instruments_to_process = [
                i for i in assigned_instruments
                if is_market_open(i['segment_id'])
            ]
            
            if not instruments_to_process:
                logger.info("Markets closed or no assigned symbols, sleeping...")
                await interruptible_sleep(60)
                continue
                
            logger.info(f"Processing {len(instruments_to_process)} instruments (instance {instance_id}/{total_instances})")
            
            # Process all assigned instruments concurrently
            start_time = datetime.now()
            
            tasks = [
                process_instrument_with_resilience(
                    instrument,
                    dhan_client,
                    producer,
                    semaphore,
                    api_circuit_breaker
                )
                for instrument in instruments_to_process
            ]
            
            logger.info(f"Created {len(tasks)} tasks, starting gather...")
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Log any exceptions from tasks
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(f"Task {i} failed with exception: {result}")
            
            elapsed = (datetime.now() - start_time).total_seconds()
            logger.info(f"Cycle completed in {elapsed:.2f}s")
            
            # Dynamic sleep based on config
            sleep_time = config_manager.get("fetch_interval", 1.0)
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
