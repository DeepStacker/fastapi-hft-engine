from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Optional, Union, Any


class SnapshotIn(BaseModel):
    instrument_id: str
    data: Dict[str, Any]


class OptionData(BaseModel):
    ce_ltp: float
    pe_ltp: float
    ce_open_interest: int
    pe_open_interest: int
    ce_implied_volatility: float
    pe_implied_volatility: float
    ce_delta: float
    pe_delta: float
    ce_theoretical_price: float
    pe_theoretical_price: float
    ce_vol_pcr: float
    pe_oi_pcr: float
    ce_price_change: float
    pe_price_change: float
    ce_price_change_percent: float
    pe_price_change_percent: float
    ce_volume: int
    pe_volume: int

class HistoricalPoint(BaseModel):
    timestamp: datetime
    value: Dict[str, OptionData]


class HistoricalResponse(BaseModel):
    sid: int
    exp: str
    timestamp: datetime
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

    # CE fields
    ce_symbol_id: int
    ce_symbol: str
    ce_display_symbol: str
    ce_strike_price: float
    ce_option_type: str
    ce_ltp: float
    ce_previous_close: float
    ce_volume: int
    ce_volume_change: int
    ce_volume_change_percent: float
    ce_open_interest: int
    ce_oi_change: int
    ce_oi_change_percent: float
    ce_implied_volatility: float
    ce_previous_volume: int
    ce_previous_oi: int
    ce_price_change: float
    ce_price_change_percent: float
    ce_bid_price: float
    ce_ask_price: float
    ce_bid_quantity: int
    ce_ask_quantity: int
    ce_moneyness: str
    ce_buildup_type: str
    ce_buildup_name: str
    ce_delta: float
    ce_theta: float
    ce_gamma: float
    ce_rho: float
    ce_vega: float
    ce_theoretical_price: float
    ce_vol_pcr: float
    ce_oi_pcr: float
    ce_max_pain_loss: float
    ce_expiry_type: str

    # PE fields
    pe_symbol_id: int
    pe_symbol: str
    pe_option_type: str
    pe_ltp: float
    pe_previous_close: float
    pe_volume: int
    pe_volume_change: int
    pe_volume_change_percent: float
    pe_open_interest: int
    pe_oi_change: int
    pe_oi_change_percent: float
    pe_implied_volatility: float
    pe_previous_volume: int
    pe_previous_oi: int
    pe_price_change: float
    pe_price_change_percent: float
    pe_bid_price: float
    pe_ask_price: float
    pe_bid_quantity: int
    pe_ask_quantity: int
    pe_moneyness: str
    pe_buildup_type: str
    pe_buildup_name: str
    pe_delta: float
    pe_theta: float
    pe_gamma: float
    pe_rho: float
    pe_vega: float
    pe_theoretical_price: float
    pe_vol_pcr: float
    pe_oi_pcr: float
    pe_max_pain_loss: float
    pe_expiry_type: str


class LiveDataResponse(BaseModel):
    timestamp: datetime
    market: MarketSnapshotResponse
    futures: List[FutureContractResponse]
    options: List[OptionContractResponse]
