import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio
from services.processor.main import process_message
from core.utils.transform import normalize_dhan_data

@pytest.mark.asyncio
async def test_processor_process_message_success():
    """Test successful message processing"""
    message = {
        "symbol_id": 13,
        "payload": {
            "data": {
                "s_sid": 13,
                "sltp": 15000.0,
                "explst": [1700000000],
                "oc": {}
            }
        },
        "timestamp": "2023-11-14T10:30:00"
    }
    
    # Mock Kafka producer
    with patch('services.processor.main.kafka_producer') as mock_producer:
        mock_producer.send = AsyncMock()
        
        await process_message(message)
        
        # Verify producer was called
        mock_producer.send.assert_called_once()

@pytest.mark.asyncio
async def test_processor_handles_empty_payload():
    """Test handling of empty payload"""
    message = {
        "symbol_id": 13,
        "payload": {},
        "timestamp": "2023-11-14T10:30:00"
    }
    
    with patch('services.processor.main.kafka_producer') as mock_producer:
        mock_producer.send = AsyncMock()
        
        await process_message(message)
        
        # Should still attempt to send (even if empty)
        assert mock_producer.send.called

@pytest.mark.asyncio
async def test_processor_error_handling():
    """Test error handling in processor"""
    message = None  # Invalid message
    
    with patch('services.processor.main.kafka_producer') as mock_producer:
        mock_producer.send = AsyncMock()
        
        # Should not raise exception
        await process_message(message)

def test_normalize_data_integration():
    """Test integration with transform module"""
    raw_payload = {
        "data": {
            "s_sid": 13,
            "OIC": 1000,
            "sltp": 15000.0
        }
    }
    
    result = normalize_dhan_data(raw_payload)
    assert "market_snapshot" in result
    assert result["market_snapshot"]["symbol_id"] == 13
