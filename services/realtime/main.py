import asyncio
import signal
import json
import time
import os
import redis.asyncio as redis
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME
from core.config.dynamic_config import get_config_manager

# Avro deserialization for enriched data from processor
from aiokafka import AIOKafkaConsumer
from core.serialization.avro_serializer import avro_deserializer

# Configure logging
configure_logger()
logger = get_logger("realtime-service")
settings = get_settings()

# Redis connection pool for high concurrency
redis_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    max_connections=50,
    decode_responses=True
)
redis_client = redis.Redis(connection_pool=redis_pool)

# Dynamic configuration manager
config_manager = None
message_buffer = []
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))  # Reduced for lower latency (was 50)

async def process_message(msg: dict):
    """
    Buffer messages and publish in batches using Redis pipeline.
    """
    global message_buffer
    
    message_buffer.append(msg)
    
    # Process batch when buffer is full
    if len(message_buffer) >= BATCH_SIZE:
        await process_batch()

async def process_batch():
    """
    Process buffered messages in a single Redis pipeline operation.
    
    OPTIMIZED:
    - Serialize JSON once per message (not twice)
    - Uses connection pool for high concurrency
    - Prefixes configurable via environment
    """
    global message_buffer
    
    if not message_buffer:
        return
    
    start_time = time.time()
    batch = message_buffer.copy()
    message_buffer.clear()
    
    # Get prefixes from environment (set in docker-compose)
    cache_prefix = os.getenv("REDIS_KEY_PREFIX", "latest:")
    channel_prefix = os.getenv("REDIS_CHANNEL_PREFIX", "live:option_chain:")
    
    try:
        # Use pipeline for atomic batch operations
        pipeline = redis_client.pipeline()
        
        for msg in batch:
            symbol_id = msg.get('symbol_id')
            if not symbol_id:
                logger.warning("Message missing symbol_id, skipping")
                continue
            
            # OPTIMIZATION: Serialize once, use for both SET and PUBLISH
            json_data = json.dumps(msg)
            
            # Store as JSON string
            cache_key = f"{cache_prefix}{symbol_id}"
            pipeline.set(cache_key, json_data)
            
            # Publish to pub/sub channel (same data)
            channel = f"{channel_prefix}{symbol_id}"
            pipeline.publish(channel, json_data)
        
        await pipeline.execute()
        
        MESSAGES_PROCESSED.labels(service="realtime", status="success").inc(len(batch))
        logger.debug(f"Processed batch of {len(batch)} messages to Redis")
        
    except Exception as e:
        MESSAGES_PROCESSED.labels(service="realtime", status="error").inc(len(batch))
        logger.error(f"Batch processing failed: {e}")
    finally:
        PROCESSING_TIME.labels(service="realtime").observe(time.time() - start_time)

async def realtime_loop():
    global config_manager
    
    # Initialize ConfigManager
    config_manager = await get_config_manager()
    logger.info("ConfigManager initialized")
    
    # Log configuration
    logger.info(f"✓ Redis connection pool: {redis_pool.max_connections} max connections")
    logger.info(f"✓ Batch size: {BATCH_SIZE} messages")
    
    start_metrics_server(8000)
    
    # BREAKING CHANGE: Use Avro deserialization for enriched data
    consumer = AIOKafkaConsumer(
        settings.KAFKA_TOPIC_ENRICHED,  # "market.enriched"
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        group_id="realtime-group",
        value_deserializer=avro_deserializer(settings.KAFKA_TOPIC_ENRICHED),
        auto_offset_reset="latest",
        enable_auto_commit=True,
        # Performance tuning
        fetch_max_wait_ms=10,
        fetch_min_bytes=1,
    )
    await consumer.start()
    
    logger.info("Kafka Consumer started for topic market.enriched (Low Latency Mode)")
    
    # Periodic batch flushing task
    async def flush_batches():
        """Flush remaining messages every 20ms (was 100ms)"""
        while True:
            await asyncio.sleep(0.02)
            if message_buffer:
                await process_batch()
    
    flush_task = asyncio.create_task(flush_batches())
    
    logger.info("Starting realtime loop with batch processing...")
    try:
        async for msg in consumer:
            try:
                data = msg.value
                if data:
                    await process_message(data)
            except Exception as e:
                logger.error(f"Error processing message: {e}")
    except asyncio.CancelledError:
        logger.info("Realtime loop cancelled")
        flush_task.cancel()
    finally:
        # Flush any remaining messages
        if message_buffer:
            await process_batch()
        await consumer.stop()
        await redis_client.close()
        await config_manager.close()


def main():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    task = loop.create_task(realtime_loop())
    
    def shutdown():
        logger.info("Shutting down...")
        task.cancel()
    
    loop.add_signal_handler(signal.SIGTERM, shutdown)
    loop.add_signal_handler(signal.SIGINT, shutdown)
    
    try:
        loop.run_until_complete(task)
    except asyncio.CancelledError:
        pass
    finally:
        loop.close()

if __name__ == "__main__":
    main()
