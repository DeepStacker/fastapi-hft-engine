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
                    metadata_max_age_ms=30000
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
        if not self.consumer:
            raise RuntimeError("Consumer not started")
        try:
            async for msg in self.consumer:
                await callback(msg.value)
        except Exception as e:
            logger.error(f"Consumer error: {e}")
            raise
