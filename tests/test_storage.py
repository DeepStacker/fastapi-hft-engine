import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.storage.main import process_message, flush_buffer
from datetime import datetime

@pytest.mark.asyncio
async def test_storage_process_message():
    """Test processing and buffering messages"""
    message = {
        "symbol_id": 13,
        "timestamp": "2023-11-14T10:30:00",
        "market_snapshot": {
            "symbol_id": 13,
            "exchange": "NSE",
            "segment": "EQ",
            "ltp": 15000.0,
            "volume": 1000,
            "total_oi_calls": 500,
            "total_oi_puts": 500
        }
    }
    
    # Mock buffer
    with patch('services.storage.main.buffer', []):
        await process_message(message)
        
        # Buffer should have one record
        from services.storage.main import buffer
        assert len(buffer) == 1

@pytest.mark.asyncio
async def test_storage_missing_fields():
    """Test handling of missing required fields"""
    message = {
        # Missing symbol_id
        "timestamp": "2023-11-14T10:30:00"
    }
    
    with patch('services.storage.main.buffer', []):
        await process_message(message)
        
        from services.storage.main import buffer
        # Should not add to buffer if required fields missing
        assert len(buffer) == 0

@pytest.mark.asyncio
async def test_storage_flush_buffer_success():
    """Test successful buffer flush to database"""
    # Mock database session
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock()
    mock_session.commit = AsyncMock()
    
    with patch('services.storage.main.async_session_factory') as mock_factory:
        mock_factory.return_value.__aenter__.return_value = mock_session
        with patch('services.storage.main.buffer', [{"timestamp": datetime.utcnow(), "symbol_id": 13}]):
            await flush_buffer()
            
            # Verify database operations called
            assert mock_session.execute.called
            assert mock_session.commit.called

@pytest.mark.asyncio
async def test_storage_flush_buffer_error_handling():
    """Test error handling during flush"""
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(side_effect=Exception("DB Error"))
    mock_session.rollback = AsyncMock()
    
    with patch('services.storage.main.async_session_factory') as mock_factory:
        mock_factory.return_value.__aenter__.return_value = mock_session
        with patch('services.storage.main.buffer', [{"timestamp": datetime.utcnow()}]):
            await flush_buffer()
            
            # Should call rollback on error
            assert mock_session.rollback.called

@pytest.mark.asyncio
async def test_storage_timestamp_parsing():
    """Test timestamp parsing in various formats"""
    message = {
        "symbol_id": 13,
        "timestamp": 1700000000,  # Unix timestamp
        "market_snapshot": {
            "symbol_id": 13,
            "exchange": "NSE",
            "segment": "EQ",
            "ltp": 15000.0,
            "volume": 1000,
            "total_oi_calls": 500,
            "total_oi_puts": 500
        }
    }
    
    with patch('services.storage.main.buffer', []):
        await process_message(message)
        
        from services.storage.main import buffer
        assert len(buffer) == 1
