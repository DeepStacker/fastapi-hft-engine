import asyncio
import signal
import json
import time
import redis.asyncio as redis
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.messaging.consumer import KafkaConsumerClient
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME

# Configure logging
configure_logger()
logger = get_logger("realtime-service")
settings = get_settings()

redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

async def process_message(msg: dict):
    """
    Publish enriched data to Redis Pub/Sub.
    """
    start_time = time.time()
    try:
        symbol_id = msg.get("symbol_id")
        if symbol_id:
            # Publish to Redis channel
            await redis_client.publish(f"live:{symbol_id}", json.dumps(msg))
            
            # Cache latest state with TTL (1 hour expiration to prevent memory leak)
            await redis_client.set(f"latest:{symbol_id}", json.dumps(msg), ex=3600)
            
            MESSAGES_PROCESSED.labels(service="realtime", status="success").inc()
            
    except Exception as e:
        MESSAGES_PROCESSED.labels(service="realtime", status="error").inc()
        logger.error(f"Realtime processing failed: {e}")
    finally:
        PROCESSING_TIME.labels(service="realtime").observe(time.time() - start_time)

async def realtime_loop():
    start_metrics_server(8000)
    
    consumer = KafkaConsumerClient(topic="market.enriched", group_id="realtime-group")
    await consumer.start()
    
    logger.info("Starting realtime loop...")
    try:
        await consumer.consume(process_message)
    except asyncio.CancelledError:
        logger.info("Realtime loop cancelled")
    finally:
        await consumer.stop()
        await redis_client.close()

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
