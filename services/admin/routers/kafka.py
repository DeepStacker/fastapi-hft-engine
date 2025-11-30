"""
Kafka Management Router

Handles Kafka topic and consumer group management.
"""
from fastapi import APIRouter, Depends, HTTPException
from typing import List
from services.api_gateway.auth import get_current_admin_user
from services.admin.models import KafkaTopic, KafkaConsumerGroup, KafkaTopicCreate
from services.admin.services.kafka_manager import kafka_manager
from services.admin.services.cache import cache_service
import logging

logger = logging.getLogger("stockify.admin.kafka")
router = APIRouter(prefix="/kafka", tags=["kafka"])


@router.get("/topics", response_model=List[KafkaTopic])
async def list_topics(admin = Depends(get_current_admin_user)):
    """List all Kafka topics"""
    # Try cache first
    cache_key = "kafka:topics"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return [KafkaTopic(**item) for item in cached_data]

    try:
        topics = await kafka_manager.list_topics()
        
        # Cache result (5s TTL)
        await cache_service.set(
            cache_key, 
            topics, 
            ttl=5
        )
        
        return topics
    except Exception as e:
        logger.error(f"Failed to list topics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/topics", response_model=dict)
async def create_topic(
    topic: KafkaTopicCreate,
    admin = Depends(get_current_admin_user)
):
    """Create a new Kafka topic"""
    try:
        success = await kafka_manager.create_topic(
            name=topic.name,
            partitions=topic.partitions,
            replication_factor=topic.replication_factor
        )
        
        if success:
            # Invalidate cache
            await cache_service.delete("kafka:topics")
            return {"message": f"Topic '{topic.name}' created successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to create topic")
            
    except Exception as e:
        logger.error(f"Failed to create topic: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/topics/{topic_name}")
async def delete_topic(
    topic_name: str,
    admin = Depends(get_current_admin_user)
):
    """Delete a Kafka topic"""
    try:
        success = await kafka_manager.delete_topic(topic_name)
        
        if success:
            # Invalidate cache
            await cache_service.delete("kafka:topics")
            return {"message": f"Topic '{topic_name}' deleted successfully"}
        else:
            raise HTTPException(status_code=400, detail="Failed to delete topic")
            
    except Exception as e:
        logger.error(f"Failed to delete topic: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/consumer-groups", response_model=List[KafkaConsumerGroup])
async def list_consumer_groups(admin = Depends(get_current_admin_user)):
    """List all consumer groups with lag information"""
    # Try cache first
    cache_key = "kafka:groups"
    cached_data = await cache_service.get(cache_key)
    if cached_data:
        return [KafkaConsumerGroup(**item) for item in cached_data]

    try:
        groups = await kafka_manager.get_consumer_groups()
        
        # Cache result (5s TTL)
        await cache_service.set(
            cache_key, 
            groups, 
            ttl=5
        )
        
        return groups
    except Exception as e:
        logger.error(f"Failed to list consumer groups: {e}")
        raise HTTPException(status_code=500, detail=str(e))


    except Exception as e:
        return {"status": "unhealthy", "connected": False, "error": str(e)}


# WebSocket for real-time Kafka updates
from fastapi import WebSocket, WebSocketDisconnect, Query, status
from jose import jwt, JWTError
import asyncio
from core.config.settings import get_settings

@router.websocket("/ws")
async def websocket_kafka(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    Real-time Kafka status updates via WebSocket
    """
    settings = get_settings()
    
    # Validate token
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("sub") is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except JWTError:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()
    
    try:
        while True:
            # Fetch real-time data
            try:
                topics = await kafka_manager.list_topics()
                groups = await kafka_manager.get_consumer_groups()
                
                await websocket.send_json({
                    "type": "kafka_update",
                    "data": {
                    "data": {
                        "topics": topics,
                        "groups": groups
                    }
                    }
                })
            except Exception as e:
                logger.error(f"Error fetching Kafka metrics: {e}")
            
            # Poll every 5 seconds (Kafka operations can be heavy)
            await asyncio.sleep(5)
            
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error in Kafka: {e}")
