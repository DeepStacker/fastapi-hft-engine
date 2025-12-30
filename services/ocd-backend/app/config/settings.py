"""
Application Settings - Compatibility Layer

This module re-exports the unified settings from core.config.settings.
All services should use the same settings instance.
"""
from core.config.settings import Settings, get_settings, settings

__all__ = ["Settings", "get_settings", "settings"]
