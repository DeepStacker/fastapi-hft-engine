"""
HFT Engine Data Adapter (Shim)
Retained for backward compatibility. Imports from new modular location.
"""
from app.services.adapters.hft import HFTDataAdapter, get_hft_adapter, close_hft_adapter
from app.services.adapters.symbols import SYMBOL_ID_MAP, ID_TO_SYMBOL

# Re-export key components
__all__ = ['HFTDataAdapter', 'get_hft_adapter', 'close_hft_adapter', 'SYMBOL_ID_MAP', 'ID_TO_SYMBOL']
