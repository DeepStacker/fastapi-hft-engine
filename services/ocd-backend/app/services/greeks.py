"""
Greeks Service Shim
Delegates to core.analytics.greeks.
"""
from dataclasses import dataclass
from typing import Dict
from core.analytics.greeks import GreeksCalculator
from core.analytics.models import AdvancedGreeks

# Re-export definitions for compatibility
AdvancedGreeks = AdvancedGreeks

class GreeksServiceMixin:
    """Mixin for backward compatibility if needed"""
    pass

class GreeksService(GreeksCalculator):
    """
    Wrapper for Core GreeksCalculator.
    """
    def __init__(self, risk_free_rate: float = 0.10):
        super().__init__(risk_free_rate)

# Singleton instance
greeks_service = GreeksService()
