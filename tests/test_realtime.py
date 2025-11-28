import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.realtime.main import process_message
import json

@pytest.mark.asyncio
async def test_realtime_process_message_success():
    """Test successful real-time message processing"""
    message = {
        "symbol_id": 13,
        "market_snapshot": {"ltp": 15000.0},
        "timestamp": "2023-11-14T10:30:00"
    }
    
    # Mock Redis client
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_redis.set = AsyncMock()
    
    with patch('services.realtime.main.redis_client', mock_redis):
        await process_message(message)
        
        # Verify Redis operations
        mock_redis.publish.assert_called_once_with("live:13", json.dumps(message))
        mock_redis.set.assert_called_once()
        
        # Verify TTL was set
        call_args = mock_redis.set.call_args
        assert call_args[1]['ex'] == 3600  # 1 hour TTL

@pytest.mark.asyncio
async def test_realtime_missing_symbol_id():
    """Test handling of missing symbol_id"""
    message = {
        # No symbol_id
        "market_snapshot": {"ltp": 15000.0}
    }
    
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    
    with patch('services.realtime.main.redis_client', mock_redis):
        await process_message(message)
        
        # Should not publish if no symbol_id
        mock_redis.publish.assert_not_called()

@pytest.mark.asyncio
async def test_realtime_redis_error_handling():
    """Test handling of Redis errors"""
    message = {
        "symbol_id": 13,
        "market_snapshot": {"ltp": 15000.0}
    }
    
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock(side_effect=Exception("Redis error"))
    
    with patch('services.realtime.main.redis_client', mock_redis):
        # Should not raise exception
        await process_message(message)

@pytest.mark.asyncio
async def test_realtime_json_serialization():
    """Test JSON serialization of messages"""
    message = {
        "symbol_id": 13,
        "market_snapshot": {
            "ltp": 15000.0,
            "volume": 1000
        },
        "options": []
    }
    
    mock_redis = AsyncMock()
    mock_redis.publish = AsyncMock()
    mock_redis.set = AsyncMock()
    
    with patch('services.realtime.main.redis_client', mock_redis):
        await process_message(message)
        
        # Verify message was JSON serialized
        call_args = mock_redis.publish.call_args[0]
        published_data = call_args[1]
        
        # Should be valid JSON
        parsed = json.loads(published_data)
        assert parsed["symbol_id"] == 13
