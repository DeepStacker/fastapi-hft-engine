"""
Kafka Manager Service

Manages Kafka topics, consumer groups, and provides lag monitoring.
"""
import logging
from typing import List, Dict, Optional
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from aiokafka.structs import TopicPartition
from core.config.settings import get_settings

logger = logging.getLogger("stockify.admin.kafka")
settings = get_settings()


class KafkaManager:
    """Manages Kafka operations for admin panel"""
    
    def __init__(self):
        self.bootstrap_servers = settings.KAFKA_BOOTSTRAP_SERVERS
        self.admin_client: Optional[AIOKafkaAdminClient] = None
        
    async def connect(self):
        """Initialize Kafka admin client"""
        if not self.admin_client:
            self.admin_client = AIOKafkaAdminClient(
                bootstrap_servers=self.bootstrap_servers
            )
            import asyncio
            # Add timeout to prevent hanging indefinitely
            await asyncio.wait_for(self.admin_client.start(), timeout=5.0)
    
    async def close(self):
        """Close Kafka admin client"""
        if self.admin_client:
            await self.admin_client.close()
            self.admin_client = None
    
    async def list_topics(self) -> List[Dict]:
        """List all Kafka topics with metadata"""
        await self.connect()
        
        try:
            topics = await self.admin_client.list_topics()
            topic_metadata = []
            
            for topic in topics:
                if not topic.startswith("__"):  # Skip internal topics
                    metadata = await self.admin_client.describe_topics([topic])
                    topic_info = metadata[0]
                    
                    topic_metadata.append({
                        "name": topic,
                        "partitions": len(topic_info["partitions"]),
                        "replication_factor": len(topic_info["partitions"][0]["replicas"]) if topic_info["partitions"] else 0,
                        "config": {}
                    })
            
            return topic_metadata
        except Exception as e:
            logger.error(f"Failed to list topics: {e}")
            return []
    
    async def create_topic(self, name: str, partitions: int = 3, replication_factor: int = 1) -> bool:
        """Create a new Kafka topic"""
        await self.connect()
        
        try:
            new_topic = NewTopic(
                name=name,
                num_partitions=partitions,
                replication_factor=replication_factor
            )
            await self.admin_client.create_topics([new_topic])
            logger.info(f"Created topic: {name}")
            return True
        except Exception as e:
            logger.error(f"Failed to create topic {name}: {e}")
            return False
    
    async def delete_topic(self, name: str) -> bool:
        """Delete a Kafka topic"""
        await self.connect()
        
        try:
            await self.admin_client.delete_topics([name])
            logger.info(f"Deleted topic: {name}")
            return True
        except Exception as e:
            logger.error(f"Failed to delete topic {name}: {e}")
            return False
    
    async def get_consumer_groups(self) -> List[Dict]:
        """List all consumer groups with lag info"""
        await self.connect()
        
        try:
            # List all consumer groups
            groups = await self.admin_client.list_consumer_groups()
            group_ids = [g.group_id for g in groups]
            
            consumer_groups = []
            
            for group_id in group_ids:
                # Skip internal or system groups if needed
                if group_id.startswith("_"):
                    continue
                    
                # Get group description to find members and topics
                # Note: aiokafka admin client might not support describe_consumer_groups fully in all versions
                # We'll use a simplified approach: get lag for known topics or discover from committed offsets
                
                total_lag = await self._get_group_lag(group_id)
                
                # For this implementation, we'll try to infer topics/members or use defaults
                # A full implementation would require describing the group state
                
                consumer_groups.append({
                    "group_id": group_id,
                    "topics": ["*"], # Placeholder as it's hard to get subscribed topics without describing
                    "total_lag": total_lag,
                    "members": 1 # Placeholder
                })
            
            return consumer_groups
        except Exception as e:
            logger.error(f"Failed to get consumer groups: {e}")
            return []
    
    async def _get_group_lag(self, group_id: str) -> int:
        """Calculate total lag for a consumer group across all topics"""
        try:
            consumer = AIOKafkaConsumer(
                bootstrap_servers=self.bootstrap_servers,
                group_id=group_id,
                enable_auto_commit=False
            )
            await consumer.start()
            
            try:
                # Get all topics the consumer group has committed offsets for
                # This is a bit tricky with aiokafka, so we'll iterate over known topics
                # In a real production app, we'd query the coordinator
                
                topics = await consumer.topics()
                total_lag = 0
                
                for topic in topics:
                    if topic.startswith("__"):
                        continue
                        
                    partitions = await consumer.partitions_for_topic(topic)
                    if not partitions:
                        continue
                        
                    tps = [TopicPartition(topic, p) for p in partitions]
                    
                    # Get committed and end offsets
                    committed = await consumer.committed_partitions(tps)
                    end_offsets = await consumer.end_offsets(tps)
                    
                    for tp in tps:
                        if committed.get(tp) is not None:
                            lag = end_offsets[tp] - committed[tp]
                            total_lag += max(0, lag)
                            
                return total_lag
            finally:
                await consumer.stop()
                
        except Exception as e:
            # logger.error(f"Failed to get lag for {group_id}: {e}")
            # Don't log error for every group as some might be inactive/empty
            return 0


# Global instance
kafka_manager = KafkaManager()
