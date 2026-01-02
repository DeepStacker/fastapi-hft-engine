"""
Options Data Transformer
Handles normalization and transformation of raw API data into application internal format.
"""
from typing import Dict, Any, List
from datetime import datetime, timezone, timedelta

class OptionsTransformer:
    """
    Stateless transformer for options data.
    """
    
    @staticmethod
    def find_strike_key(oc: Dict, strike: float) -> str:
        """
        Find the correct strike key in option chain.
        Dhan returns keys like '26000.000000' but lookups might use '26000'.
        """
        # Try exact integer match first
        int_key = str(int(strike))
        if int_key in oc:
            return int_key
        
        # Try with decimals
        float_key = f"{strike:.6f}"
        if float_key in oc:
            return float_key
        
        # Search for matching strike value
        for key in oc.keys():
            try:
                if float(key) == strike:
                    return key
            except:
                continue
        
        return int_key  # Fallback to integer key

    @staticmethod
    def transform_leg(leg: Dict) -> Dict:
        """Transform option leg to standardized format with all Dhan fields"""
        return {
            # Core prices
            "ltp": leg.get("ltp", 0),
            "atp": leg.get("atp", 0),  # Average traded price
            "pc": leg.get("pc", 0),    # Previous close
            
            # Volume
            "volume": leg.get("vol", 0),
            "vol": leg.get("vol", 0),  # Keep both for compatibility
            "pVol": leg.get("pVol", 0),  # Previous volume
            
            # Open Interest - Dhan uses uppercase OI!
            "oi": leg.get("OI", leg.get("oi", 0)),  # Handle both cases
            "OI": leg.get("OI", leg.get("oi", 0)),  # Keep uppercase for frontend
            "oichng": leg.get("oichng", 0),
            "oi_change": leg.get("oichng", 0),  # Alias for compatibility
            "oiperchnge": leg.get("oiperchnge", 0),
            "p_oi": leg.get("p_oi", 0),  # Previous day OI
            
            # Price change
            "p_chng": leg.get("p_chng", 0),  # Price change
            "p_pchng": leg.get("p_pchng", 0),  # Price change percent
            "change": leg.get("p_chng", 0),  # Alias for frontend
            
            # IV & Greeks
            "iv": leg.get("iv", 0),
            "optgeeks": leg.get("optgeeks", {}),
            
            # Bid/Ask
            "bid": leg.get("bid", 0),
            "ask": leg.get("ask", 0),
            "bid_qty": leg.get("bid_qty", 0),
            "ask_qty": leg.get("ask_qty", 0),
            
            # Build-up signals - CRITICAL for trading
            "btyp": leg.get("btyp", "NT"),  # LB, SB, SC, LC, NT
            "BuiltupName": leg.get("BuiltupName", "NEUTRAL"),  # Full buildup name
            
            # Moneyness
            "mness": leg.get("mness", ""),  # I = ITM, O = OTM
            
            # Symbol info
            "sym": leg.get("sym", ""),
            "sid": leg.get("sid", 0),
            "disp_sym": leg.get("disp_sym", ""),
            "otype": leg.get("otype", ""),  # CE or PE
        }

    @staticmethod
    def calculate_days_to_expiry_ist(expiry_timestamp: int) -> float:
        """
        Calculate days to expiry using IST market hours.
        """
        IST_OFFSET = timedelta(hours=5, minutes=30)
        
        # Convert timestamp to IST
        expiry_dt_utc = datetime.fromtimestamp(expiry_timestamp, timezone.utc)
        expiry_ist = expiry_dt_utc + IST_OFFSET
        expiry_target = expiry_ist.replace(hour=15, minute=31, second=0, microsecond=0)
        
        # Get current time in IST
        now_utc = datetime.now(timezone.utc)
        now_ist = now_utc + IST_OFFSET
        
        # Define reference times
        today_1530 = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        today_0900 = now_ist.replace(hour=9, minute=0, second=0, microsecond=0)
        yesterday_1530 = (now_ist - timedelta(days=1)).replace(
            hour=15, minute=30, second=0, microsecond=0
        )
        
        # Choose reference time based on current time
        if now_ist > today_1530:
            reference_time = today_1530
        elif now_ist < today_0900:
            reference_time = yesterday_1530
        else:
            reference_time = now_ist
        
        # Normalize to common year for day difference calculation
        common_year = 2000
        expiry_normalized = expiry_target.replace(year=common_year, tzinfo=None)
        reference_normalized = reference_time.replace(year=common_year, tzinfo=None)
        
        # Calculate difference in days
        day_diff = (expiry_normalized - reference_normalized).total_seconds() / (24 * 3600)
        
        return max(day_diff - 1, 0.000001)

    @staticmethod
    def parse_expiry_to_days(expiry) -> float:
        """
        Parse expiry and calculate days to expiry.
        Handles both Unix timestamps (int/str) and ISO date strings.
        """
        if expiry is None:
            return 0
        
        expiry_str = str(expiry)
        
        # Check if it's a date string (contains dash)
        if '-' in expiry_str:
            try:
                # Parse ISO date string (e.g., "2024-12-26")
                expiry_date = datetime.strptime(expiry_str, "%Y-%m-%d")
                # Set expiry to 3:30 PM IST
                expiry_date = expiry_date.replace(hour=15, minute=30)
                now = datetime.now()
                return max(0, (expiry_date - now).total_seconds() / (24 * 3600))
            except ValueError:
                return 0
        else:
            # It's a Unix timestamp
            try:
                timestamp = int(expiry_str)
                return OptionsTransformer.calculate_days_to_expiry_ist(timestamp)
            except ValueError:
                return 0

    @staticmethod
    def greeks_to_dict(greeks) -> Dict:
        """Convert Greeks dataclass to dictionary"""
        return {
            "delta": greeks.delta,
            "gamma": greeks.gamma,
            "theta": greeks.theta,
            "vega": greeks.vega,
            "rho": greeks.rho,
            "vanna": greeks.vanna,
            "vomma": greeks.vomma,
            "charm": greeks.charm,
            "speed": greeks.speed,
            "zomma": greeks.zomma,
            "color": greeks.color,
            "ultima": greeks.ultima,
        }
