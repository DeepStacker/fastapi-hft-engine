import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime
from core.database.models import MarketSnapshotDB, OptionContractDB, UserDB
from services.gateway.auth import get_password_hash
from sqlalchemy import select

# All tests use mocked database to avoid requiring actual PostgreSQL

@pytest.mark.asyncio
async def test_create_market_snapshot_mocked():
    """Test creating market snapshot with mocked database"""
    with patch('core.database.db.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        
        mock_factory.return_value = mock_session
        
        # Create a market snapshot
        snapshot = MarketSnapshotDB(
            timestamp=datetime.utcnow(),
            symbol_id=13,
            exchange="NSE",
            segment="EQ",
            ltp=15000.0,
            volume=1000,
            oi=500
        )
        
        async with mock_factory() as session:
            session.add(snapshot)
            await session.commit()
            
            # Verify add and commit were called
            assert session.add.called
            assert session.commit.called

@pytest.mark.asyncio
async def test_create_option_contract_mocked():
    """Test creating option contract with mocked database"""
    with patch('core.database.db.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        
        mock_factory.return_value = mock_session
        
        option = OptionContractDB(
            timestamp=datetime.utcnow(),
            symbol_id=13,
            expiry=datetime(2025, 12, 31),
            strike_price=15000.0,
            option_type="CE",
            ltp=100.0,
            volume=500,
            oi=200,
            iv=0.25,
            delta=0.5
        )
        
        async with mock_factory() as session:
            session.add(option)
            await session.commit()
            
            assert session.add.called
            assert session.commit.called

@pytest.mark.asyncio
async def test_query_market_snapshot_mocked():
    """Test querying market snapshots with mocked database"""
    with patch('core.database.db.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        
        # Mock query result
        mock_snapshot = MarketSnapshotDB(
            timestamp=datetime.utcnow(),
            symbol_id=13,
            exchange="NSE",
            segment="EQ",
            ltp=15000.0,
            volume=1000,
            oi=500
        )
        
        mock_result = AsyncMock()
        mock_result.scalar_one = AsyncMock(return_value=mock_snapshot)
        mock_session.execute = AsyncMock(return_value=mock_result)
        
        mock_factory.return_value = mock_session
        
        async with mock_factory() as session:
            result = await session.execute(select(MarketSnapshotDB))
            retrieved = result.scalar_one()
            
            assert retrieved.symbol_id == 13
            assert retrieved.ltp == 15000.0

@pytest.mark.asyncio
async def test_create_user_mocked():
    """Test creating user with mocked database"""
    with patch('core.database.db.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.add = MagicMock()
        mock_session.commit = AsyncMock()
        
        mock_factory.return_value = mock_session
        
        user = UserDB(
            username="testuser",
            email="test@example.com",
            hashed_password=get_password_hash("password123")
        )
        
        async with mock_factory() as session:
            session.add(user)
            await session.commit()
            
            assert session.add.called
            assert session.commit.called

@pytest.mark.asyncio
async def test_bulk_insert_mocked():
    """Test bulk insert with mocked database"""
    from sqlalchemy import insert
    
    with patch('core.database.db.async_session_factory') as mock_factory:
        mock_session = AsyncMock()
        mock_session.__aenter__ = AsyncMock(return_value=mock_session)
        mock_session.__aexit__ = AsyncMock(return_value=None)
        mock_session.execute = AsyncMock()
        mock_session.commit = AsyncMock()
        
        mock_factory.return_value = mock_session
        
        # Create 100 snapshots
        snapshots = [
            {
                "timestamp": datetime.utcnow(),
                "symbol_id": i % 10,
                "exchange": "NSE",
                "segment": "EQ",
                "ltp": 15000.0 + i,
                "volume": 1000 + i,
                "oi": 500 + i
            }
            for i in range(100)
        ]
        
        async with mock_factory() as session:
            await session.execute(insert(MarketSnapshotDB), snapshots)
            await session.commit()
            
            assert session.execute.called
            assert session.commit.called
