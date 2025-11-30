import asyncio
import signal
import json
import time
import redis.asyncio as redis
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.messaging.consumer import KafkaConsumerClient
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME
from core.config.dynamic_config import get_config_manager
from core.utils.redis_pipeline import RedisPipeline

# Configure logging
configure_logger()
logger = get_logger("realtime-service")
settings = get_settings()

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

# Dynamic configuration manager
config_manager = None

# Redis pipeline for batch operations
redis_pipeline = None
message_buffer = []
BATCH_SIZE = 50  # Process messages in batches of 50

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
    """
    global message_buffer
    
    if not message_buffer:
        return
    
    start_time = time.time()
    batch = message_buffer.copy()
    message_buffer.clear()
    
    try:
        # Use pipeline for atomic batch operations
        await redis_pipeline.cache_update_and_publish(
            updates=batch,
            cache_key_prefix="latest:",
            channel_prefix="live:"
        )
        
        MESSAGES_PROCESSED.labels(service="realtime", status="success").inc(len(batch))
        logger.debug(f"Processed batch of {len(batch)} messages")
        
    except Exception as e:
        MESSAGES_PROCESSED.labels(service="realtime", status="error").inc(len(batch))
        logger.error(f"Batch processing failed: {e}")
    finally:
        PROCESSING_TIME.labels(service="realtime").observe(time.time() - start_time)

async def realtime_loop():
    global config_manager, redis_pipeline
    
    # Initialize ConfigManager
    config_manager = await get_config_manager()
    logger.info("ConfigManager initialized")
    
    # Initialize Redis pipeline
    redis_pipeline = RedisPipeline(redis_client)
    logger.info("Redis pipeline initialized")
    
    start_metrics_server(8000)
    
    consumer = KafkaConsumerClient(topic="market.enriched", group_id="realtime-group")
    await consumer.start()
    
    # Periodic batch flushing task
    async def flush_batches():
        """Flush remaining messages every second"""
        while True:
            await asyncio.sleep(1)
            if message_buffer:
                await process_batch()
    
    flush_task = asyncio.create_task(flush_batches())
    
    logger.info("Starting realtime loop with batch processing...")
    try:
        await consumer.consume(process_message)
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
