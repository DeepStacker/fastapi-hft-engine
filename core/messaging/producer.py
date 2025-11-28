from aiokafka import AIOKafkaProducer
from core.config.settings import get_settings
import json
from core.logging.logger import get_logger

settings = get_settings()
logger = get_logger("kafka_producer")


class KafkaProducerClient:
    """Kafka producer with compression enabled"""
    
    def __init__(self):
        self.producer = None
        self.bootstrap_servers = settings.KAFKA_BOOTSTRAP_SERVERS
        
    async def start(self):
        """Initialize Kafka producer with lz4 compression"""
        self.producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            compression_type=settings.KAFKA_COMPRESSION_TYPE,  # Enable compression
            acks='all'  # Wait for all replicas to acknowledge
        )
        await self.producer.start()
        logger.info(f"Kafka producer started with {settings.KAFKA_COMPRESSION_TYPE} compression")
    
    async def send(self, topic: str, message: dict):
        """Send message to Kafka topic"""
        if not self.producer:
            await self.start()
        
        try:
            await self.producer.send_and_wait(topic, message)
        except Exception as e:
            logger.error(f"Failed to send message to {topic}: {e}")
            raise
    
    async def stop(self):
        """Stop Kafka producer"""
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")


# Global producer instance
kafka_producer = KafkaProducerClient()
