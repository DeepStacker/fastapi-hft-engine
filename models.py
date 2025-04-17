from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    DateTime,
    JSON,
    Index,
    ForeignKey,
    Enum,
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

    id = Column(Integer, primary_key=True, index=True)
    instrument_id = Column(String(50), index=True)  # Added length for VARCHAR
    segment = Column(String(20))  # Added length for VARCHAR
    expiry = Column(DateTime, index=True)
    strike_price = Column(Float, index=True)
    option_type = Column(String(2), index=True)  # "CE" / "PE"
    data = Column(JSON)  # raw entry
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    __table_args__ = (Index("ix_inst_time", "instrument_id", "timestamp"),)


class MarketSnapshot(Base):
    __tablename__ = "market_snapshots"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    total_oi_calls = Column(Integer)  # OIC
    total_oi_puts = Column(Integer)  # OIP
    pcr_ratio = Column(Float)  # Rto
    exchange = Column(String(10))  # exch
    segment = Column(String(10))  # seg
    instrument_type = Column(String(20))  # oinst
    atm_iv = Column(Float)  # atmiv
    aiv_percent_change = Column(Float)  # aivperchng
    spot_ltp = Column(Float)  # sltp
    spot_volume = Column(Integer)  # svol
    spot_percent_change = Column(Float)  # SPerChng
    spot_change = Column(Float)  # SChng
    option_lot_size = Column(Integer)  # olot
    option_tick_size = Column(Float)  # otick
    days_to_expiry = Column(Integer)  # dte


class FutureContract(Base):
    __tablename__ = "future_contracts"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)
    symbol_id = Column(Integer, index=True)  # sid
    symbol = Column(String(50), index=True)  # sym
    ltp = Column(Float)
    previous_close = Column(Float)  # pc
    price_change = Column(Float)  # pch
    price_change_percent = Column(Float)  # prch
    volume = Column(Integer)  # vol
    volume_change = Column(Integer)  # v_chng
    volume_change_percent = Column(Float)  # v_pchng
    open_interest = Column(Integer)  # oi
    oi_change = Column(Integer)  # oichng
    oi_change_percent = Column(Float)  # oipchng
    previous_volume = Column(Integer)  # pvol
    lot_size = Column(Integer)  # lot
    expiry_type = Column(String(5))  # exptype
    expiry = Column(DateTime, index=True)


class OptionContract(Base):
    __tablename__ = "option_contracts"

    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, index=True, default=datetime.utcnow)

    # CE fields
    ce_symbol_id = Column(Integer, index=True)
    ce_symbol = Column(String(100), index=True)
    ce_display_symbol = Column(String(100))
    ce_strike_price = Column(Float, index=True)
    ce_option_type = Column(String(2), index=True)
    ce_ltp = Column(Float)
    ce_previous_close = Column(Float)
    ce_volume = Column(Integer)
    ce_volume_change = Column(Integer)
    ce_volume_change_percent = Column(Float)
    ce_open_interest = Column(Integer)
    ce_oi_change = Column(Integer)
    ce_oi_change_percent = Column(Float)
    ce_implied_volatility = Column(Float)
    ce_previous_volume = Column(Integer)
    ce_previous_oi = Column(Integer)
    ce_price_change = Column(Float)
    ce_price_change_percent = Column(Float)
    ce_bid_price = Column(Float)
    ce_ask_price = Column(Float)
    ce_bid_quantity = Column(Integer)
    ce_ask_quantity = Column(Integer)
    ce_moneyness = Column(String(5))
    ce_buildup_type = Column(String(20))
    ce_buildup_name = Column(String(50))
    ce_delta = Column(Float)
    ce_theta = Column(Float)
    ce_gamma = Column(Float)
    ce_rho = Column(Float)
    ce_vega = Column(Float)
    ce_theoretical_price = Column(Float)
    ce_vol_pcr = Column(Float)
    ce_oi_pcr = Column(Float)
    ce_max_pain_loss = Column(Float)
    ce_expiry_type = Column(String(5))

    # PE fields
    pe_symbol_id = Column(Integer, index=True)
    pe_symbol = Column(String(100), index=True)
    pe_option_type = Column(String(2), index=True)
    pe_ltp = Column(Float)
    pe_previous_close = Column(Float)
    pe_volume = Column(Integer)
    pe_volume_change = Column(Integer)
    pe_volume_change_percent = Column(Float)
    pe_open_interest = Column(Integer)
    pe_oi_change = Column(Integer)
    pe_oi_change_percent = Column(Float)
    pe_implied_volatility = Column(Float)
    pe_previous_volume = Column(Integer)
    pe_previous_oi = Column(Integer)
    pe_price_change = Column(Float)
    pe_price_change_percent = Column(Float)
    pe_bid_price = Column(Float)
    pe_ask_price = Column(Float)
    pe_bid_quantity = Column(Integer)
    pe_ask_quantity = Column(Integer)
    pe_moneyness = Column(String(5))
    pe_buildup_type = Column(String(20))
    pe_buildup_name = Column(String(50))
    pe_delta = Column(Float)
    pe_theta = Column(Float)
    pe_gamma = Column(Float)
    pe_rho = Column(Float)
    pe_vega = Column(Float)
    pe_theoretical_price = Column(Float)
    pe_vol_pcr = Column(Float)
    pe_oi_pcr = Column(Float)
    pe_max_pain_loss = Column(Float)
    pe_expiry_type = Column(String(5))


# class IOdata(Base):
#     __tablename__ = "io_data"

#     id = Column(Integer, primary_key=True)
#     timestamp = Column(DateTime, index=True, default=datetime.utcnow)

#     # CE fields
#     ce_symbol_id = Column(Integer, index=True)
#     ce_symbol = Column(String(100), index=True)
#     ce_display_symbol = Column(String(100))
#     ce_strike_price = Column(Float, index=True)
#     ce_option_type = Column(String(2), index=True)
#     ce_ltp = Column(Float)
#     ce_previous_close = Column(Float)
#     ce_volume = Column(Integer)
#     ce_volume_change = Column(Integer)
#     ce_volume_change_percent = Column(Float)
#     ce_open_interest = Column(Integer)
#     ce_oi_change = Column(Integer)
#     ce_oi_change_percent = Column(Float)
#     ce_implied_volatility = Column(Float)
#     ce_previous_volume = Column(Integer)
#     ce_previous_oi = Column(Integer)
#     ce_price_change = Column(Float)
#     ce_price_change_percent = Column(Float)
#     ce_bid_price = Column(Float)
#     ce_ask_price = Column(Float)
#     ce_bid_quantity = Column(Integer)
#     ce_ask_quantity = Column(Integer)
#     ce_moneyness = Column(String(5))
#     ce_buildup_type = Column(String(20))
#     ce_buildup_name = Column(String(50))
#     ce_delta = Column(Float)
#     ce_theta = Column(Float)
#     ce_gamma = Column(Float)
#     ce_rho = Column(Float)
#     ce_vega = Column(Float)
#     ce_theoretical_price = Column(Float)
#     ce_vol_pcr = Column(Float)
#     ce_oi_pcr = Column(Float)
#     ce_max_pain_loss = Column(Float)
#     ce_expiry_type = Column(String(5))

#     # PE fields
#     pe_symbol_id = Column(Integer, index=True)
#     pe_symbol = Column(String(100), index=True)
#     pe_option_type = Column(String(2), index=True)
#     pe_ltp = Column(Float)
#     pe_previous_close = Column(Float)
#     pe_volume = Column(Integer)
#     pe_volume_change = Column(Integer)
#     pe_volume_change_percent = Column(Float)
#     pe_open_interest = Column(Integer)
#     pe_oi_change = Column(Integer)
#     pe_oi_change_percent = Column(Float)
#     pe_implied_volatility = Column(Float)
#     pe_previous_volume = Column(Integer)
#     pe_previous_oi = Column(Integer)
#     pe_price_change = Column(Float)
#     pe_price_change_percent = Column(Float)
#     pe_bid_price = Column(Float)
#     pe_ask_price = Column(Float)
#     pe_bid_quantity = Column(Integer)
#     pe_ask_quantity = Column(Integer)
#     pe_moneyness = Column(String(5))
#     pe_buildup_type = Column(String(20))
#     pe_buildup_name = Column(String(50))
#     pe_delta = Column(Float)
#     pe_theta = Column(Float)
#     pe_gamma = Column(Float)
#     pe_rho = Column(Float)
#     pe_vega = Column(Float)
#     pe_theoretical_price = Column(Float)
#     pe_vol_pcr = Column(Float)
#     pe_oi_pcr = Column(Float)
#     pe_max_pain_loss = Column(Float)
#     pe_expiry_type = Column(String(5))