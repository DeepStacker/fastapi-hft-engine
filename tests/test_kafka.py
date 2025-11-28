import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from core.messaging.producer import KafkaProducerClient
from core.messaging.consumer import KafkaConsumerClient
import json

@pytest.mark.asyncio
async def test_kafka_producer_send():
    """Test Kafka producer can send messages"""
    producer = KafkaProducerClient()
    
    # Mock the actual Kafka producer
    producer.producer = AsyncMock()
    producer.producer.send_and_wait = AsyncMock()
    
    # Send a test message
    test_message = {"symbol_id": 13, "data": "test"}
    await producer.send("test.topic", test_message)
    
    # Verify send_and_wait was called
    producer.producer.send_and_wait.assert_called_once()

@pytest.mark.asyncio
async def test_kafka_consumer_consume():
    """Test Kafka consumer can consume messages"""
    consumer = KafkaConsumerClient(topic="test.topic", group_id="test-group")
    
    # Mock the consumer
    consumer.consumer = AsyncMock()
    
    # Create mock messages
    mock_message = MagicMock()
    mock_message.value = {"symbol_id": 13, "data": "test"}
    
    async def mock_iterator():
        yield mock_message
    
    consumer.consumer.__aiter__ = lambda x: mock_iterator()
    
    # Track callback invocations
    callback_called = False
    async def test_callback(msg):
        nonlocal callback_called
        callback_called = True
        assert msg == {"symbol_id": 13, "data": "test"}
    
    # Note: This will run forever, so we need to cancel it
    consume_task = asyncio.create_task(consumer.consume(test_callback))
    await asyncio.sleep(0.1)  # Give it time to process
    consume_task.cancel()
    
    try:
        await consume_task
    except asyncio.CancelledError:
        pass
    
    assert callback_called

@pytest.mark.asyncio
async def test_kafka_producer_error_handling():
    """Test Kafka producer handles errors gracefully"""
    producer = KafkaProducerClient()
    
    # Mock the producer to raise an error
    producer.producer = AsyncMock()
    producer.producer.send_and_wait = AsyncMock(side_effect=Exception("Kafka error"))
    
    # Should raise the exception
    with pytest.raises(Exception):
        await producer.send("test.topic", {"data": "test"})
