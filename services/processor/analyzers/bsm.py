"""
Black-Scholes-Merton Model (Shim)
Imports from core.analytics.bsm to avoid duplication.
"""
from core.analytics.bsm import BlackScholesModel

# Re-export for compatibility
__all__ = ['BlackScholesModel']
