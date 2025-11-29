"""
Save raw ingestion data to JSON files for verification

Consumes from market.raw topic and saves each message to a JSON file
"""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from core.messaging.consumer import KafkaConsumerClient
from core.config.settings import get_settings
from core.logging.logger import get_logger, configure_logger

configure_logger()
logger = get_logger("json-saver")
settings = get_settings()

# Create output directory
OUTPUT_DIR = Path("/app/data/enriched_ingestion")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

messages_saved = 0


async def save_message(message: dict):
    """Save a single message to JSON file"""
    global messages_saved
    
    try:
        # Extract metadata
        symbol = message.get('symbol', 'UNKNOWN')
        timestamp = message.get('timestamp', datetime.utcnow().isoformat())
        
        # Create filename with timestamp
        filename = f"{symbol}_{timestamp.replace(':', '-').replace('.', '_')}.json"
        filepath = OUTPUT_DIR / filename
        
        # Save to file
        with open(filepath, 'w') as f:
            json.dump(message, f, indent=2)
        
        messages_saved += 1
        logger.info(f"Saved enriched message {messages_saved}: {filepath.name}")
        
        # Log summary every 10 messages
        if messages_saved % 10 == 0:
            logger.info(f"Total messages saved: {messages_saved}")
            
    except Exception as e:
        logger.error(f"Failed to save message: {e}", exc_info=True)


async def main():
    """Main entry point"""
    logger.info(f"Starting JSON saver - output dir: {OUTPUT_DIR}")
    logger.info(f"Consuming from topic: {settings.KAFKA_TOPIC_ENRICHED}")
    
    # Create consumer
    consumer = KafkaConsumerClient(
        topic=settings.KAFKA_TOPIC_ENRICHED,
        group_id="json-saver-enriched"
    )
    
    try:
        await consumer.start()
        logger.info("Consumer started, waiting for messages...")
        
        # Consume messages
        await consumer.consume(save_message)
        
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
    finally:
        await consumer.stop()
        logger.info(f"Stopped. Total messages saved: {messages_saved}")


if __name__ == "__main__":
    asyncio.run(main())
