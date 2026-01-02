"""
User Model - User account and authentication
Unified with Core Database Models (Phase 2 Consolidation)
"""
from core.database.models import AppUserDB as User
from core.database.models import UserRole, UserActivityLogDB

# Re-export for compatibility
__all__ = ["User", "UserRole", "UserActivityLogDB"]
