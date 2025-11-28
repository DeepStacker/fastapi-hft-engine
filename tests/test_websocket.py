import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from services.gateway.main import app
import json

client = TestClient(app)

def test_websocket_connection_without_token():
    """Test WebSocket connection is rejected without token"""
    with client.websocket_connect("/ws/13") as websocket:
        # Should be closed due to missing token
        try:
            websocket.receive_text()
            assert False, "Should have closed connection"
        except:
            pass  # Expected to fail

def test_websocket_connection_with_invalid_token():
    """Test WebSocket connection is rejected with invalid token"""
    try:
        with client.websocket_connect("/ws/13?token=invalid_token") as websocket:
            # Should be closed due to invalid token
            websocket.receive_text()
            assert False, "Should have closed connection"
    except:
        pass  # Expected to fail

@pytest.mark.asyncio
async def test_websocket_authentication_function():
    """Test WebSocket JWT authentication function"""
    from services.gateway.main import authenticate_websocket
    from services.gateway.auth import create_access_token
    
    # Create valid token
    valid_token = create_access_token(data={"sub": "testuser"})
    username = await authenticate_websocket(valid_token)
    assert username == "testuser"
    
    # Test invalid token
    username = await authenticate_websocket("invalid")
    assert username is None

def test_websocket_manager_connection():
    """Test WebSocket manager connection handling"""
    from services.gateway.websocket_manager import manager
    from fastapi import WebSocket
    from unittest.mock import MagicMock
    
    mock_websocket = MagicMock(spec=WebSocket)
    mock_websocket.accept = AsyncMock()
    
    symbol_id = "13"
    
    # Should add to connections
    import asyncio
    asyncio.run(manager.connect(mock_websocket, symbol_id))
    
    assert symbol_id in manager.active_connections
    assert mock_websocket in manager.active_connections[symbol_id]
    
    # Disconnect
    manager.disconnect(mock_websocket, symbol_id)
    assert mock_websocket not in manager.active_connections.get(symbol_id, [])

@pytest.mark.asyncio
async def test_websocket_manager_broadcast():
    """Test broadcasting messages to WebSocket clients"""
    from services.gateway.websocket_manager import manager
    from unittest.mock import MagicMock, AsyncMock
    
    # Mock WebSocket
    mock_ws1 = MagicMock()
    mock_ws1.send_json = AsyncMock()
    mock_ws2 = MagicMock()
    mock_ws2.send_json = AsyncMock()
    
    symbol_id = "13"
    manager.active_connections[symbol_id] = [mock_ws1, mock_ws2]
    
    message = {"symbol_id": 13, "ltp": 15000.0}
    
    await manager.broadcast(symbol_id, message)
    
    # Both should receive message
    mock_ws1.send_json.assert_called_once_with(message)
    mock_ws2.send_json.assert_called_once_with(message)

@pytest.mark.asyncio
async def test_websocket_manager_broadcast_error_handling():
    """Test handling of errors during broadcast"""
    from services.gateway.websocket_manager import manager
    from unittest.mock import MagicMock, AsyncMock
    
    # Mock WebSocket that fails
    mock_ws = MagicMock()
    mock_ws.send_json = AsyncMock(side_effect=Exception("Connection error"))
    
    symbol_id = "13"
    manager.active_connections[symbol_id] = [mock_ws]
    
    message = {"symbol_id": 13, "ltp": 15000.0}
    
    # Should not raise exception
    await manager.broadcast(symbol_id, message)
    
    # Connection should be removed
    assert len(manager.active_connections[symbol_id]) == 0
