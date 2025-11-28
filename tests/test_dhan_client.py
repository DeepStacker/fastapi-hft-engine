import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from services.ingestion.dhan_client import DhanApiClient
import httpx

@pytest.mark.asyncio
async def test_dhan_client_fetch_option_chain_success():
    """Test successful option chain fetch"""
    client = DhanApiClient()
    
    # Mock httpx response
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "data": {
            "s_sid": 13,
            "oc": {}
        }
    }
    
    with patch.object(httpx.AsyncClient, 'get', return_value=mock_response):
        result = await client.fetch_option_chain(13)
        
        assert result is not None
        assert "data" in result

@pytest.mark.asyncio
async def test_dhan_client_timeout():
    """Test handling of timeout"""
    client = DhanApiClient()
    
    with patch.object(httpx.AsyncClient, 'get', side_effect=httpx.TimeoutException("Timeout")):
        result = await client.fetch_option_chain(13)
        assert result is None

@pytest.mark.asyncio
async def test_dhan_client_http_error():
    """Test handling of HTTP errors"""
    client = DhanApiClient()
    
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Server Error", request=MagicMock(), response=mock_response
    )
    
    with patch.object(httpx.AsyncClient, 'get', return_value=mock_response):
        result = await client.fetch_option_chain(13)
        assert result is None

@pytest.mark.asyncio
async def test_dhan_client_invalid_json():
    """Test handling of invalid JSON response"""
    client = DhanApiClient()
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.side_effect = ValueError("Invalid JSON")
    
    with patch.object(httpx.AsyncClient, 'get', return_value=mock_response):
        result = await client.fetch_option_chain(13)
        assert result is None
