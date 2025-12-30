"""
Core Clients Package - External API Clients

All external API clients should be defined here as single source of truth.
"""
from core.clients.dhan import DhanClientBase, get_dhan_client

__all__ = ["DhanClientBase", "get_dhan_client"]
