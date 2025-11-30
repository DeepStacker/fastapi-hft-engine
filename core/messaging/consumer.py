from aiokafka import AIOKafkaConsumer
import json
from typing import Callable, Awaitable
from core.config.settings import get_settings
from core.logging.logger import get_logger

settings = get_settings()
logger = get_logger(__name__)

class KafkaConsumerClient:
    def __init__(self, topic: str, group_id: str):
        self.topic = topic
        self.group_id = group_id
        self.consumer = None

    async def start(self, max_retries: int = 10, initial_delay: float = 2.0):
        """Start consumer with retry logic for connection failures"""
        retry_count = 0
        delay = initial_delay
        
        while retry_count < max_retries:
            try:
                self.consumer = AIOKafkaConsumer(
                    self.topic,
                    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                    group_id=self.group_id,
                    value_deserializer=lambda x: json.loads(x.decode("utf-8")),
                    auto_offset_reset="latest",
                    # Increased timeouts to handle coordinator issues
                    request_timeout_ms=60000,
                    session_timeout_ms=30000,
                    heartbeat_interval_ms=10000,
                    # Enable auto-creation of topics and consumer groups
                    enable_auto_commit=True,
                    auto_commit_interval_ms=5000,
                    # Retry settings for transient failures
                    metadata_max_age_ms=30000,
                    # HIGH-PERFORMANCE: Throughput optimizations
                    # Fetch more data per request (default: 1MB)
                    fetch_max_bytes=5242880,  # 5MB - fetch up to 5MB total per request
                    max_partition_fetch_bytes=2097152,  # 2MB - max per partition
                    # Prefetch batches for better throughput
                    fetch_min_bytes=1024,  # Wait for at least 1KB before returning
                    fetch_max_wait_ms=500,  # Max wait time for fetch_min_bytes
                    # Increase buffer for better batching
                    max_poll_records=500,  # Process up to 500 records per poll
                )
                await self.consumer.start()
                logger.info(f"Kafka Consumer started for topic {self.topic}")
                return
                
            except Exception as e:
                retry_count += 1
                if retry_count >= max_retries:
                    logger.error(f"Failed to start Kafka consumer after {max_retries} retries: {e}")
                    raise
                
                logger.warning(
                    f"Kafka connection failed (attempt {retry_count}/{max_retries}): {e}. "
                    f"Retrying in {delay:.1f}s..."
                )
                
                # Use asyncio.sleep if available
                import asyncio
                await asyncio.sleep(delay)
                
                # Exponential backoff with cap at 30 seconds
                delay = min(delay * 1.5, 30.0)

    async def stop(self):
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka Consumer stopped")

    async def consume(self, callback: Callable[[dict], Awaitable[None]]):
        """Consume messages with concurrent batch processing for high throughput"""
        if not self.consumer:
            raise RuntimeError("Consumer not started")
        try:
            import asyncio
            # Limit concurrent processing to prevent overwhelming the system
            semaphore = asyncio.Semaphore(10)  # Process up to 10 messages concurrently
            
            async def process_message(msg_value):
                """Process a single message with semaphore control"""
                async with semaphore:
                    try:
                        await callback(msg_value)
                    except Exception as e:
                        logger.error(f"Error processing message: {e}")
            
            # Batch collection for concurrent processing
            batch = []
            batch_size = 10  # Process in batches of 10
            
            async for msg in self.consumer:
                # Add message to batch
                batch.append(process_message(msg.value))
                
                # Process batch when full
                if len(batch) >= batch_size:
                    await asyncio.gather(*batch, return_exceptions=True)
                    batch = []
            
            # Process remaining messages
            if batch:
                await asyncio.gather(*batch, return_exceptions=True)
                
        except Exception as e:
            logger.error(f"Consumer error: {e}")
            raise
