import pytest
from pydantic import ValidationError
from core.models.schemas import (
    MarketSnapshot,
    OptionContract,
    FutureContract,
    Instrument,
    MarketRawMessage,
    MarketEnrichedMessage,
    UserCreate,
    Token
)
from datetime import datetime

def test_market_snapshot_validation():
    """Test market snapshot model validation"""
    snapshot = MarketSnapshot(
        timestamp=datetime.utcnow(),
        symbol_id=13,
        exchange="NSE",
        segment="EQ",
        ltp=15000.0,
        volume=1000,
        oi=500
    )
    assert snapshot.symbol_id == 13
    assert snapshot.ltp == 15000.0

def test_market_snapshot_negative_ltp():
    """Test that negative LTP is rejected"""
    with pytest.raises(ValidationError):
        MarketSnapshot(
            timestamp=datetime.utcnow(),
            symbol_id=13,
            exchange="NSE",
            segment="EQ",
            ltp=-100.0,  # Invalid
            volume=1000,
            oi=500
        )

def test_option_contract_validation():
    """Test option contract model validation"""
    option = OptionContract(
        timestamp=datetime.utcnow(),
        symbol_id=13,
        expiry=datetime(2025, 12, 31),
        strike_price=15000.0,
        option_type="CE",
        ltp=100.0,
        volume=500,
        oi=200
    )
    assert option.option_type == "CE"
    assert option.strike_price == 15000.0

def test_option_contract_invalid_type():
    """Test that invalid option type is rejected"""
    with pytest.raises(ValidationError):
        OptionContract(
            timestamp=datetime.utcnow(),
            symbol_id=13,
            expiry=datetime(2025, 12, 31),
            strike_price=15000.0,
            option_type="INVALID",  # Must be CE or PE
            ltp=100.0,
            volume=500,
            oi=200
        )

def test_option_contract_negative_strike():
    """Test that negative strike price is rejected"""
    with pytest.raises(ValidationError):
        OptionContract(
            timestamp=datetime.utcnow(),
            symbol_id=13,
            expiry=datetime(2025, 12, 31),
            strike_price=-1000.0,  # Invalid
            option_type="CE",
            ltp=100.0,
            volume=500,
            oi=200
        )

def test_future_contract_validation():
    """Test future contract model validation"""
    future = FutureContract(
        timestamp=datetime.utcnow(),
        symbol_id=13,
        expiry=datetime(2025, 12, 31),
        ltp=15000.0,
        volume=1000,
        oi=500
    )
    assert future.symbol_id == 13

def test_instrument_validation():
    """Test instrument model validation"""
    instrument = Instrument(
        symbol_id=13,
        symbol="NIFTY",
        segment="IDX",
        exchange="NSE",
        is_active=1
    )
    assert instrument.symbol == "NIFTY"

def test_instrument_invalid_symbol_id():
    """Test that zero or negative symbol_id is rejected"""
    with pytest.raises(ValidationError):
        Instrument(
            symbol_id=0,  # Invalid
            symbol="NIFTY",
            segment="IDX",
            exchange="NSE"
        )

def test_market_raw_message_validation():
    """Test Kafka raw message schema"""
    message = MarketRawMessage(
        symbol_id=13,
        payload={"data": "test"},
        timestamp="2023-11-14T10:30:00"
    )
    assert message.symbol_id == 13

def test_market_raw_message_invalid_symbol_id():
    """Test that invalid symbol_id in raw message is rejected"""
    with pytest.raises(ValidationError):
        MarketRawMessage(
            symbol_id=-1,  # Invalid
            payload={"data": "test"},
            timestamp="2023-11-14T10:30:00"
        )

def test_market_enriched_message_validation():
    """Test Kafka enriched message schema"""
    message = MarketEnrichedMessage(
        symbol_id=13,
        timestamp="2023-11-14T10:30:00",
        market_snapshot={"ltp": 15000.0},
        options=[]
    )
    assert message.symbol_id == 13

def test_user_create_validation():
    """Test user creation schema"""
    user = UserCreate(
        username="testuser",
        email="test@example.com",
        password="securepass123"
    )
    assert user.username == "testuser"

def test_user_create_short_username():
    """Test that short username is rejected"""
    with pytest.raises(ValidationError):
        UserCreate(
            username="ab",  # Too short (min 3)
            email="test@example.com",
            password="securepass123"
        )

def test_user_create_short_password():
    """Test that short password is rejected"""
    with pytest.raises(ValidationError):
        UserCreate(
            username="testuser",
            email="test@example.com",
            password="short"  # Too short (min 8)
        )

def test_user_create_invalid_email():
    """Test that invalid email is rejected"""
    with pytest.raises(ValidationError):
        UserCreate(
            username="testuser",
            email="notanemail",  # Invalid format
            password="securepass123"
        )

def test_token_schema():
    """Test token response schema"""
    token = Token(
        access_token="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
        token_type="bearer"
    )
    assert token.token_type == "bearer"
