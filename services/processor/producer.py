"""
Kafka Producer for Enriched Market Data

Produces to: market_data_enriched
"""
import json
from typing import Optional
from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError
from core.config.settings import get_settings
from core.logging.logger import get_logger

logger = get_logger("kafka-producer")
settings = get_settings()


class EnrichedDataProducer:
    """
    Async Kafka producer for enriched market data
    """
    
    def __init__(self):
        """Initialize producer"""
        self.producer: Optional[AIOKafkaProducer] = None
        self.topic = settings.KAFKA_TOPIC_ENRICHED
    
    async def start(self):
        """Start the producer"""
        logger.info(
            f"Starting Kafka producer: "
            f"topic={self.topic}, "
            f"servers={settings.KAFKA_BOOTSTRAP_SERVERS}"
        )
        
        self.producer = AIOKafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            compression_type='gzip',  # Compress for efficiency
            acks='all'  # Wait for all replicas (reliability)
        )
        
        await self.producer.start()
        logger.info("Kafka producer started successfully")
    
    async def send(self, enriched_data: dict):
        """
        Send enriched data to Kafka
        
        Args:
            enriched_data: Enriched market data dict
        """
        if not self.producer:
            raise RuntimeError("Producer not started. Call start() first.")
        
        try:
            # Use symbol as key for partitioning
            key = enriched_data.get('symbol', 'UNKNOWN').encode('utf-8')
            
            # Send message
            await self.producer.send_and_wait(
                self.topic,
                value=enriched_data,
                key=key
            )
            
            logger.debug(
                f"Sent enriched data for {enriched_data.get('symbol')} "
                f"({len(enriched_data.get('options', []))} options)"
            )
            
        except KafkaError as e:
            logger.error(f"Failed to send message: {e}", exc_info=True)
            raise
        except Exception as e:
            logger.error(f"Unexpected error sending message: {e}", exc_info=True)
            raise
    
    async def stop(self):
        """Stop the producer"""
        logger.info("Stopping Kafka producer...")
        
        if self.producer:
            await self.producer.stop()
            logger.info("Kafka producer stopped")
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self.start()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.stop()
