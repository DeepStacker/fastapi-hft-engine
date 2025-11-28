import asyncio
import signal
import time
from datetime import datetime
from core.config.settings import get_settings
from core.logging.logger import configure_logger, get_logger
from core.messaging.consumer import KafkaConsumerClient
from core.messaging.producer import kafka_producer
from core.utils.transform import normalize_dhan_data
from core.monitoring.metrics import start_metrics_server, MESSAGES_PROCESSED, PROCESSING_TIME

# Configure logging
configure_logger()
logger = get_logger("stream-processor")
settings = get_settings()

async def process_message(raw_msg: dict):
    """
    Normalize and enrich raw market data.
    """
    start_time = time.time()
    try:
        symbol_id = raw_msg.get("symbol_id")
        payload = raw_msg.get("payload", {})
        
        # --- Transformation Logic ---
        normalized_data = normalize_dhan_data(payload)
        
        if not normalized_data:
            MESSAGES_PROCESSED.labels(service="processor", status="empty").inc()
            return

        enriched_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "symbol_id": symbol_id,
            "market_snapshot": normalized_data.get("market_snapshot"),
            "options": normalized_data.get("options")
        }
        
        # --- Publish Enriched Data ---
        await kafka_producer.send("market.enriched", enriched_data)
        MESSAGES_PROCESSED.labels(service="processor", status="success").inc()

    except Exception as e:
        MESSAGES_PROCESSED.labels(service="processor", status="error").inc()
        logger.error(f"Processing failed: {e}")
    finally:
        PROCESSING_TIME.labels(service="processor").observe(time.time() - start_time)

async def processor_loop():
    start_metrics_server(8000)
    
    consumer = KafkaConsumerClient(topic="market.raw", group_id="processor-group")
    
    await kafka_producer.start()
    await consumer.start()
    
    logger.info("Starting processor loop...")
    try:
        await consumer.consume(process_message)
    except asyncio.CancelledError:
        logger.info("Processor loop cancelled")
    finally:
        await consumer.stop()
        await kafka_producer.stop()

def main():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    task = loop.create_task(processor_loop())
    
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
