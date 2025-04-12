from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Optional, Union, Any

class SnapshotIn(BaseModel):
    instrument_id: str
    data: Dict[str, Any]

class HistoricalPoint(BaseModel):
    timestamp: datetime
    value: Dict[str, Union[float, int]]

class HistoricalResponse(BaseModel):
    instrument_id: str
    strike_price: float
    option_type: str
    points: List[HistoricalPoint]

class MarketSnapshotResponse(BaseModel):
    timestamp: datetime
    total_oi_calls: int
    total_oi_puts: int
    pcr_ratio: float
    atm_iv: float
    aiv_percent_change: float
    spot_ltp: float
    spot_volume: int
    spot_percent_change: float
    spot_change: float
    option_lot_size: int
    option_tick_size: float
    days_to_expiry: int

class FutureContractResponse(BaseModel):
    timestamp: datetime
    symbol_id: int
    symbol: str
    ltp: float
    previous_close: float
    price_change: float
    price_change_percent: float
    volume: int
    volume_change: int
    volume_change_percent: float
    open_interest: int
    oi_change: int
    oi_change_percent: float
    lot_size: int
    expiry_type: str
    expiry: Optional[datetime]

class OptionContractResponse(BaseModel):
    timestamp: datetime
    symbol_id: int
    symbol: str
    display_symbol: str
    strike_price: float
    option_type: str
    ltp: float
    previous_close: float
    volume: int
    volume_change: int
    volume_change_percent: float
    open_interest: int
    oi_change: int
    oi_change_percent: float
    implied_volatility: float
    delta: float
    theta: float
    gamma: float
    vega: float
    rho: float
    theoretical_price: float
    vol_pcr: float
    oi_pcr: float
    max_pain_loss: float
    expiry_type: str

class LiveDataResponse(BaseModel):
    timestamp: datetime
    market: MarketSnapshotResponse
    futures: List[FutureContractResponse]
    options: List[OptionContractResponse]
