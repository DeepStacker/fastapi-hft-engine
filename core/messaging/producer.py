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
        """Initialize Kafka producer with high-performance settings"""
        self.producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            compression_type=settings.KAFKA_COMPRESSION_TYPE,  # Enable compression
            acks='all',  # Wait for all replicas to acknowledge
            # HIGH-PERFORMANCE: Batching and throughput optimizations
            batch_size=32768,  # 32KB - batch messages for efficiency
            linger_ms=10,  # Wait up to 10ms to batch more messages
            buffer_memory=67108864,  # 64MB - total memory for buffering
            max_request_size=1048576,  # 1MB - max size per request
            # Connection pool for better concurrency
            max_in_flight_requests_per_connection=5,
            # Retry settings for reliability
            retries=3,
            retry_backoff_ms=100,
        )
        await self.producer.start()
        logger.info(f"Kafka producer started with {settings.KAFKA_COMPRESSION_TYPE} compression (batching enabled)")
    
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
