"""
Kafka Consumer for Raw Market Data

Consumes from: market_data_raw
"""
import json
import asyncio
from typing import Callable, Optional
from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError
from core.config.settings import get_settings
from core.logging.logger import get_logger

logger = get_logger("kafka-consumer")
settings = get_settings()


class MarketDataConsumer:
    """
    Async Kafka consumer for raw market data
    """
    
    def __init__(
        self,
        message_processor: Callable,
        group_id: str = "processor-service",
        auto_offset_reset: str = "latest"
    ):
        """
        Initialize consumer
        
        Args:
            message_processor: Async function to process each message
            group_id: Consumer group ID
            auto_offset_reset: 'earliest' or 'latest'
        """
        self.message_processor = message_processor
        self.group_id = group_id
        self.auto_offset_reset = auto_offset_reset
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.running = False
    
    async def start(self):
        """Start the consumer"""
        logger.info(
            f"Starting Kafka consumer: "
            f"topic={settings.KAFKA_TOPIC_MARKET_RAW}, "
            f"group={self.group_id}"
        )
        
        self.consumer = AIOKafkaConsumer(
            settings.KAFKA_TOPIC_MARKET_RAW,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            group_id=self.group_id,
            auto_offset_reset=self.auto_offset_reset,
            enable_auto_commit=True,
            value_deserializer=lambda m: json.loads(m.decode('utf-8'))
        )
        
        await self.consumer.start()
        logger.info("Kafka consumer started successfully")
    
    async def consume(self):
        """
        Main consumption loop
        """
        if not self.consumer:
            raise RuntimeError("Consumer not started. Call start() first.")
        
        self.running = True
        logger.info("Starting message consumption...")
        
        try:
            async for msg in self.consumer:
                if not self.running:
                    break
                
                try:
                    # Process message
                    await self.message_processor(msg.value)
                    
                except Exception as e:
                    logger.error(
                        f"Error processing message from partition {msg.partition}, "
                        f"offset {msg.offset}: {e}",
                        exc_info=True
                    )
                    # Continue processing other messages
                    
        except KafkaError as e:
            logger.error(f"Kafka error: {e}", exc_info=True)
            raise
        finally:
            logger.info("Message consumption loop ended")
    
    async def stop(self):
        """Stop the consumer"""
        logger.info("Stopping Kafka consumer...")
        self.running = False
        
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.stop()
