"""
Robust Kafka Consumer with Retry Logic

Implements exponential backoff, dead letter queue, and error handling
for production-grade message processing.
"""

import asyncio
from typing import Callable, Optional
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)
import structlog

logger = structlog.get_logger("kafka-consumer")


class RobustKafkaConsumer:
    """
    Kafka consumer with built-in retry logic and DLQ support.
    """
    
    def __init__(
        self,
        topic: str,
        group_id: str,
        bootstrap_servers: str,
        process_func: Callable,
        dlq_topic: Optional[str] = None,
        max_retries: int = 3
    ):
        self.topic = topic
        self.group_id = group_id
        self.bootstrap_servers = bootstrap_servers
        self.process_func = process_func
        self.dlq_topic = dlq_topic or f"{topic}.dlq"
        self.max_retries = max_retries
        
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.dlq_producer: Optional[AIOKafkaProducer] = None
        self.running = False
        
        # Metrics
        self.messages_processed = 0
        self.messages_failed = 0
        self.messages_sent_to_dlq = 0
    
    async def start(self):
        """Start consumer and DLQ producer"""
        self.consumer = AIOKafkaConsumer(
            self.topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            auto_offset_reset='latest',
            enable_auto_commit=False,  # Manual commit for reliability
            max_poll_records=100,
            session_timeout_ms=30000,
            heartbeat_interval_ms=10000
        )
        
        self.dlq_producer = AIOKafkaProducer(
            bootstrap_servers=self.bootstrap_servers,
            compression_type='gzip'
        )
        
        await self.consumer.start()
        await self.dlq_producer.start()
        
        self.running = True
        logger.info(
            "Robust Kafka consumer started",
            topic=self.topic,
            group_id=self.group_id,
            max_retries=self.max_retries
        )
    
    async def stop(self):
        """Stop consumer and producer"""
        self.running = False
        
        if self.consumer:
            await self.consumer.stop()
        
        if self.dlq_producer:
            await self.dlq_producer.stop()
        
        logger.info(
            "Robust Kafka consumer stopped",
            processed=self.messages_processed,
            failed=self.messages_failed,
            dlq=self.messages_sent_to_dlq
        )
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type(Exception)
    )
    async def _process_with_retry(self, message):
        """Process message with automatic retry"""
        try:
            await self.process_func(message)
            self.messages_processed += 1
            
        except Exception as e:
            self.messages_failed += 1
            logger.error(
                "Message processing failed",
                topic=self.topic,
                offset=message.offset,
                error=str(e),
                exc_info=True
            )
            raise  # Let tenacity handle retry
    
    async def send_to_dlq(self, message, error: str):
        """Send failed message to dead letter queue"""
        try:
            # Enrich with error metadata
            dlq_payload = {
                "original_topic": self.topic,
                "original_partition": message.partition,
                "original_offset": message.offset,
                "error": error,
                "timestamp": message.timestamp,
                "key": message.key.decode('utf-8') if message.key else None,
                "value": message.value.decode('utf-8') if message.value else None
            }
            
            import json
            await self.dlq_producer.send(
                self.dlq_topic,
                value=json.dumps(dlq_payload).encode('utf-8')
            )
            
            self.messages_sent_to_dlq += 1
            
            logger.warning(
                "Message sent to DLQ",
                dlq_topic=self.dlq_topic,
                original_offset=message.offset,
                error=error
            )
            
        except Exception as e:
            logger.error(f"Failed to send message to DLQ: {e}", exc_info=True)
    
    async def consume(self):
        """Main consumption loop with retry and DLQ"""
        try:
            async for message in self.consumer:
                if not self.running:
                    break
                
                try:
                    # Attempt processing with retries
                    await self._process_with_retry(message)
                    
                    # Commit offset on success
                    await self.consumer.commit()
                    
                except Exception as e:
                    # After max retries, send to DLQ
                    await self.send_to_dlq(
                        message,
                        error=f"Max retries exceeded: {str(e)}"
                    )
                    
                    # Still commit to move forward
                    await self.consumer.commit()
                    
        except Exception as e:
            logger.error(f"Consumer loop error: {e}", exc_info=True)
            raise


# Utility: Batch Processing with Size Limits
class BatchProcessor:
    """Process messages in batches with size limits"""
    
    def __init__(self, max_batch_size: int = 1000):
        self.max_batch_size = max_batch_size
        self.batch = []
    
    def add(self, item):
        """Add item to batch"""
        self.batch.append(item)
        
        # Auto-flush if batch full
        if len(self.batch) >= self.max_batch_size:
            return True  # Signal flush needed
        return False
    
    def get_batch(self):
        """Get current batch and reset"""
        batch = self.batch
        self.batch = []
        return batch
    
    def size(self):
        """Current batch size"""
        return len(self.batch)
