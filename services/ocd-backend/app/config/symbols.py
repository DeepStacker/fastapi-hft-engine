"""
Symbol Mappings and Constants
Trading instrument symbol to ID mappings
"""
from typing import Dict, Set


# Symbol to Dhan API ID mapping
SYMBOL_LIST: Dict[str, int] = {
    # Indices
    "NIFTY": 13,
    "BANKNIFTY": 25,
    "FINNIFTY": 27,
    "MIDCPNIFTY": 442,
    "NIFTYNXT50": 38,
    "SENSEX": 51,
    "BANKEX": 69,
    
    # Commodities
    "CRUDEOIL": 294,
    
    # Stocks (Nifty 50)
    "ADANIENT": 25,
    "ADANIPORTS": 15083,
    "APOLLOHOSP": 157,
    "ASIANPAINT": 236,
    "AXISBANK": 5900,
    "BAJAJ-AUTO": 16669,
    "BAJFINANCE": 317,
    "BAJAJFINSV": 16675,
    "BEL": 383,
    "BPCL": 526,
    "BHARTIARTL": 10604,
    "BRITANNIA": 547,
    "CIPLA": 694,
    "COALINDIA": 20374,
    "DRREDDY": 881,
    "EICHERMOT": 910,
    "GRASIM": 1232,
    "HCLTECH": 7229,
    "HDFCBANK": 1333,
    "HDFCLIFE": 467,
    "HEROMOTOCO": 1348,
    "HINDALCO": 1363,
    "HINDUNILVR": 1394,
    "ICICIBANK": 4963,
    "ITC": 1660,
    "INDUSINDBK": 5258,
    "INFY": 1594,
    "JSWSTEEL": 11723,
    "KOTAKBANK": 1922,
    "LT": 11483,
    "MM": 2031,
    "MARUTI": 10999,
    "NTPC": 11630,
    "NESTLEIND": 17963,
    "ONGC": 2475,
    "POWERGRID": 14977,
    "RELIANCE": 2885,
    "SBILIFE": 21808,
    "SHRIRAMFIN": 4306,
    "SBIN": 3045,
    "SUNPHARMA": 3351,
    "TCS": 11536,
    "TATACONSUM": 3432,
    "TATAMOTORS": 3456,
    "TATASTEEL": 3499,
    "TECHM": 13538,
    "TITAN": 3506,
    "TRENT": 1964,
    "ULTRACEMCO": 11532,
    "WIPRO": 3787,
}

# Symbol to segment mapping (0 = Index, 1 = Stock, 5 = Commodity)
SEGMENT_LIST: Dict[str, int] = {
    # Indices (Segment 0)
    "NIFTY": 0,
    "BANKNIFTY": 0,
    "FINNIFTY": 0,
    "MIDCPNIFTY": 0,
    "NIFTYNXT50": 0,
    "SENSEX": 0,
    "BANKEX": 0,
    
    # Commodities (Segment 5)
    "CRUDEOIL": 5,
    
    # Default all stocks to segment 1
}

# Default segment for stocks not explicitly listed
DEFAULT_STOCK_SEGMENT = 1

# Index symbols (for different handling)
INDEX_SYMBOLS: Set[str] = {
    "NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY", 
    "NIFTYNXT50", "SENSEX", "BANKEX"
}

# Commodity symbols
COMMODITY_SYMBOLS: Set[str] = {"CRUDEOIL"}

# All supported symbols
ALL_SYMBOLS: Set[str] = set(SYMBOL_LIST.keys())


def get_symbol_id(symbol: str) -> int:
    """Get Dhan API symbol ID"""
    symbol = symbol.upper()
    return SYMBOL_LIST.get(symbol, 0)


def get_segment_id(symbol: str) -> int:
    """Get segment ID for a symbol"""
    symbol = symbol.upper()
    
    # Check explicit mapping first
    if symbol in SEGMENT_LIST:
        return SEGMENT_LIST[symbol]
    
    # Default: stocks are segment 1
    if symbol in SYMBOL_LIST:
        return DEFAULT_STOCK_SEGMENT
    
    return 0


def is_valid_symbol(symbol: str) -> bool:
    """Check if symbol is valid"""
    return symbol.upper() in SYMBOL_LIST


def is_index(symbol: str) -> bool:
    """Check if symbol is an index"""
    return symbol.upper() in INDEX_SYMBOLS


def is_commodity(symbol: str) -> bool:
    """Check if symbol is a commodity"""
    return symbol.upper() in COMMODITY_SYMBOLS


def get_instrument_type(symbol: str) -> str:
    """Get instrument type (IDX, EQ, COM)"""
    symbol = symbol.upper()
    if symbol in INDEX_SYMBOLS:
        return "IDX"
    elif symbol in COMMODITY_SYMBOLS:
        return "COM"
    return "EQ"


# Strike interval mapping for ATM calculation
STRIKE_INTERVALS: Dict[str, float] = {
    "NIFTY": 50,
    "BANKNIFTY": 100,
    "FINNIFTY": 50,
    "MIDCPNIFTY": 25,
    "SENSEX": 100,
    "BANKEX": 100,
    "CRUDEOIL": 50,
}

DEFAULT_STRIKE_INTERVAL = 50


def get_strike_interval(symbol: str) -> float:
    """Get strike interval for a symbol"""
    return STRIKE_INTERVALS.get(symbol.upper(), DEFAULT_STRIKE_INTERVAL)
