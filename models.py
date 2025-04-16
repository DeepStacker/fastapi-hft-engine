from sqlalchemy import (
    Column, Integer, String, Float, DateTime, JSON, Index, ForeignKey, Enum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

Base = declarative_base()

class OptionType(enum.Enum):
    CE = "CE"
    PE = "PE"

class OptionSnapshot(Base):
    __tablename__ = "option_snapshots"

    id            = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(String(50), index=True)  # Added length for VARCHAR
    segment       = Column(String(20))  # Added length for VARCHAR
    expiry        = Column(DateTime, index=True)
    strike_price  = Column(Float, index=True)
    option_type   = Column(String(2), index=True)  # "CE" / "PE"
    data          = Column(JSON)  # raw entry
    timestamp     = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (
        Index("ix_inst_time", "instrument_id", "timestamp"),
    )

class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    total_oi_calls = Column(Integer)  # OIC
    total_oi_puts = Column(Integer)   # OIP
    pcr_ratio = Column(Float)         # Rto
    exchange = Column(String(10))     # exch
    segment = Column(String(10))      # seg
    instrument_type = Column(String(20))  # oinst
    atm_iv = Column(Float)            # atmiv
    aiv_percent_change = Column(Float)  # aivperchng
    spot_ltp = Column(Float)          # sltp
    spot_volume = Column(Integer)     # svol
    spot_percent_change = Column(Float)  # SPerChng
    spot_change = Column(Float)       # SChng
    option_lot_size = Column(Integer)   # olot
    option_tick_size = Column(Float)    # otick
    days_to_expiry = Column(Integer)    # dte

class FutureContract(Base):
    __tablename__ = "future_contracts"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    symbol_id = Column(Integer, index=True)  # sid
    symbol = Column(String(50), index=True)  # sym
    ltp = Column(Float)
    previous_close = Column(Float)    # pc
    price_change = Column(Float)      # pch
    price_change_percent = Column(Float)  # prch
    volume = Column(Integer)          # vol
    volume_change = Column(Integer)   # v_chng
    volume_change_percent = Column(Float)  # v_pchng
    open_interest = Column(Integer)   # oi
    oi_change = Column(Integer)       # oichng
    oi_change_percent = Column(Float) # oipchng
    previous_volume = Column(Integer) # pvol
    lot_size = Column(Integer)        # lot
    expiry_type = Column(String(5))   # exptype
    expiry = Column(DateTime, index=True)

class OptionContract(Base):
    __tablename__ = "option_contracts"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    symbol_id = Column(Integer, index=True)  # sid
    symbol = Column(String(100), index=True)  # sym
    display_symbol = Column(String(100))      # disp_sym
    strike_price = Column(Float, index=True)
    option_type = Column(String(2), index=True)  # otype (CE/PE)
    ltp = Column(Float)
    previous_close = Column(Float)    # pc
    volume = Column(Integer)          # vol
    volume_change = Column(Integer)   # v_chng
    volume_change_percent = Column(Float)  # v_pchng
    open_interest = Column(Integer)   # OI
    oi_change = Column(Integer)       # oichng
    oi_change_percent = Column(Float) # oiperchnge
    implied_volatility = Column(Float)  # iv
    previous_volume = Column(Integer)   # pVol
    previous_oi = Column(Integer)       # p_oi
    price_change = Column(Float)        # p_chng
    price_change_percent = Column(Float)  # p_pchng
    bid_price = Column(Float)           # bid
    ask_price = Column(Float)           # ask
    bid_quantity = Column(Integer)      # bid_qty
    ask_quantity = Column(Integer)      # ask_qty
    moneyness = Column(String(5))       # mness
    buildup_type = Column(String(20))   # btyp
    buildup_name = Column(String(50))   # BuiltupName
    
    # Greeks
    delta = Column(Float)
    theta = Column(Float)
    gamma = Column(Float)
    rho = Column(Float)
    vega = Column(Float)
    theoretical_price = Column(Float)  # theoryprc
    
    # PCR related
    vol_pcr = Column(Float)           # volpcr
    oi_pcr = Column(Float)            # oipcr
    max_pain_loss = Column(Float)     # mploss
    expiry_type = Column(String(5))   # exptype

class IOdata(Base):
    __tablename__ = "io_data"
    
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    symbol_id = Column(Integer, index=True)  # sid
    symbol = Column(String(100), index=True)  # sym
    display_symbol = Column(String(100))      # disp_sym
    strike_price = Column(Float, index=True)
    option_type = Column(String(2), index=True)  # otype (CE/PE)
    ltp = Column(Float)
    previous_close = Column(Float)    # pc
    volume = Column(Integer)          # vol
    volume_change = Column(Integer)   # v_chng
    volume_change_percent = Column(Float)  # v_pchng
    open_interest = Column(Integer)   # OI
    oi_change = Column(Integer)       # oichng
    oi_change_percent = Column(Float) # oiperchnge
    implied_volatility = Column(Float)  # iv
    previous_volume = Column(Integer)   # pVol
    previous_oi = Column(Integer)       # p_oi
    price_change = Column(Float)        # p_chng
    price_change_percent = Column(Float)  # p_pchng
    bid_price = Column(Float)           # bid
    ask_price = Column(Float)           # ask
    bid_quantity = Column(Integer)      # bid_qty
    ask_quantity = Column(Integer)      # ask_qty
    moneyness = Column(String(5))       # mness
    buildup_type = Column(String(20))   # btyp
    buildup_name = Column(String(50))   # BuiltupName
    
    # Greeks
    delta = Column(Float)
    theta = Column(Float)
    gamma = Column(Float)
    rho = Column(Float)
    vega = Column(Float)
    theoretical_price = Column(Float)  # theoryprc
    
    # PCR related
    vol_pcr = Column(Float)           # volpcr
    oi_pcr = Column(Float)            # oipcr
    max_pain_loss = Column(Float)     # mploss
    expiry_type = Column(String(5))   # exptype
