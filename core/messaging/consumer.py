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

    async def start(self):
        self.consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=self.group_id,
            value_deserializer=lambda x: json.loads(x.decode("utf-8")),
            auto_offset_reset="latest"
        )
        await self.consumer.start()
        logger.info(f"Kafka Consumer started for topic {self.topic}")

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
