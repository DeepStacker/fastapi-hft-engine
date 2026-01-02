"""
Pydantic Models for Raw Option Chain Data

These models provide type safety and validation for data received from Dhan API.
"""
from typing import Optional, Literal, List
from pydantic import BaseModel, Field, validator, ConfigDict
from datetime import datetime


class OptionGreeks(BaseModel):
    """Greeks data from API"""
    delta: float = 0.0
    gamma: float = 0.0
    theta: float = 0.0
    vega: float = 0.0
    rho: float = 0.0
    theoryprc: float = 0.0  # Always 0 from API, we calculate it


class RawOptionData(BaseModel):
    """
    Raw option data for a single strike (CE or PE)
    Maps directly to API response fields
    """
    # Identifiers
    sid: int
    sym: str
    disp_sym: str = ""
    otype: Literal['CE', 'PE']
    
    # Price data
    ltp: Optional[float] = 0.0
    pc: float = 0.0  # Previous close
    p_chng: float = 0.0
    p_pchng: float = 0.0
    bid: Optional[float] = 0.0
    ask: Optional[float] = 0.0
    bid_qty: int = 0
    ask_qty: int = 0
    atp: float = 0.0  # Average traded price
    
    # Volume
    vol: int = 0
    pVol: int = 0  # Previous volume
    v_chng: int = 0
    v_pchng: float = 0.0
    
    # Open Interest
    OI: int = Field(default=0, alias='OI')
    p_oi: int = 0
    oichng: int = 0
    oiperchnge: float = 0.0
    
    # Greeks & IV
    iv: Optional[float] = 0.0
    optgeeks: OptionGreeks = Field(default_factory=OptionGreeks)
    
    # Classification
    mness: str = 'O'  # Moneyness: I/O/A
    btyp: str = ''  # Build-up type
    BuiltupName: str = ''
    
    model_config = ConfigDict(populate_by_name=True)  # Allow 'OI' field
        
    @validator('ltp', 'bid', 'ask', pre=True)
    def handle_none_prices(cls, v):
        """Convert None or 0 to None for optional prices"""
        if v is None or v == 0:
            return None
        return float(v)
    
    @validator('iv', pre=True)
    def handle_none_iv(cls, v):
        """IV is critical, convert 0 to None"""
        if v is None or v == 0:
            return None
        return float(v)


class StrikeData(BaseModel):
    """Complete data for a single strike price"""
    ce: Optional[RawOptionData] = None
    pe: Optional[RawOptionData] = None
    volpcr: float = 0.0
    oipcr: float = 0.0
    mploss: float = 0.0
    exptype: str = 'W'  # W=Weekly, M=Monthly


class FuturesContractData(BaseModel):
    """Futures contract data"""
    sid: int
    sym: str
    ltp: float
    pc: float  # Previous close
    pch: float = 0.0  # Unused by API
    prch: float = 0.0  # Unused by API
    
    vol: int
    pvol: int
    v_chng: int
    v_pchng: float
    
    oi: int
    poi: int = 0  # Unused by API
    oichng: int
    oipchng: float
    
    xch: str = 'NSE'
    seg: str = 'D'
    ticksize: float = 0.1
    lot: int = 75
    exptype: str = 'M'
    
    # Unused fields
    daystoexp: int = 0
    expcode: int = 0
    mtp: int = 0
    d_sym: str = ''


class GlobalContext(BaseModel):
    """Global market data and context"""
    # Spot data
    sltp: float = Field(...)  # Spot LTP (required)
    svol: int = 0
    SPerChng: float = 0.0
    SChng: float = 0.0
    s_xch: str = 'IDX'
    s_seg: str = 'I'
    s_sid: int = 0
    
    # Option metrics
    olot: int = 75  # Option lot size
    otick: float = 0.05  # Option tick size
    omulti: int = 1
    OIC: int = 0  # Total Call OI
    OIP: int = 0  # Total Put OI
    Rto: float = 0.0  # PCR ratio
    
    atmiv: float = 0.0  # ATM IV
    aivperchng: float = 0.0  # ATM IV % change
    
    mxpn_strk: float = 0.0  # Max pain strike
    dte: int = 0  # Days to expiry
    
    # Identifiers
    exch: str = 'NSE'
    seg: str = 'D'
    oinst: str = 'OPTIDX'
    finst: str = 'FUTIDX'
    sinst: str = 'IDX'
    u_id: int = 0
    
    # Expiry list
    explst: List[int] = Field(default_factory=list)
    
    model_config = ConfigDict(populate_by_name=True)


class RawMarketData(BaseModel):
    """
    Complete raw market data from Dhan API
    Top-level structure
    """
    code: int
    data: dict  # Will be parsed manually
    remarks: str = ""
    
    # Metadata
    received_at: datetime = Field(default_factory=lambda: datetime.now())
    
    model_config = ConfigDict(arbitrary_types_allowed=True)
