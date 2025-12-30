"""
Audit logging for security-critical events

Tracks authentication attempts, data access, and modifications for compliance.
"""
import logging
from datetime import datetime
from typing import Optional, Dict, Any
import json
from enum import Enum
import os
from core.utils.timezone import get_ist_isoformat

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Configure audit logger
audit_logger = logging.getLogger("stockify.audit")
audit_logger.setLevel(logging.INFO)

# File handler for audit logs
audit_handler = logging.FileHandler("logs/audit.log")
audit_handler.setFormatter(
    logging.Formatter('%(asctime)s - %(message)s')
)
audit_logger.addHandler(audit_handler)


# Helper function for async compatibility
async def log_auth_event(action: str, username: str = None, user_id: int = None, details: dict = None):
    """
    Async-compatible auth event logger
    
    Used by auth.py for authentication events
    """
    from core.logging.audit import AuditLogger, AuditEventType
    
    event_map = {
        "login_success": AuditEventType.LOGIN_SUCCESS,
        "login_failed": AuditEventType.LOGIN_FAILURE,
        "token_validation_failed": AuditEventType.PERMISSION_DENIED,
        "apikey_validation_failed": AuditEventType.PERMISSION_DENIED,
        "apikey_expired": AuditEventType.PERMISSION_DENIED,
        "user_created": AuditEventType.REGISTER,
        "apikey_created": AuditEventType.DATA_MODIFICATION,
    }
    
    event_type = event_map.get(action, AuditEventType.DATA_ACCESS)
    
    AuditLogger.log_event(
        event_type,
        user_id=str(user_id) if user_id else None,
        username=username,
        details=details
    )


class AuditEventType(str, Enum):
    """Types of auditable events"""
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILURE = "login_failure"
    LOGOUT = "logout"
    REGISTER = "register"
    PASSWORD_CHANGE = "password_change"
    DATA_ACCESS = "data_access"
    DATA_MODIFICATION =  "data_modification"
    PERMISSION_DENIED = "permission_denied"
    API_KEY_USED = "api_key_used"


class AuditLogger:
    """Centralized audit logging class"""
    
    @staticmethod
    def log_event(
        event_type: AuditEventType,
        user_id: Optional[str] = None,
        username: Optional[str] = None,
        ip_address: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        success: bool = True
    ):
        """
        Log an audit event
        
        Args:
            event_type: Type of event being audited
            user_id: User ID if applicable
            username: Username if applicable
            ip_address: Client IP address
            details: Additional event details
            success: Whether the event was successful
        """
        audit_entry = {
            "timestamp": get_ist_isoformat(),
            "event_type": event_type.value,
            "user_id": user_id,
            "username": username,
            "ip_address": ip_address,
            "success": success,
            "details": details or {}
        }
        
        audit_logger.info(json.dumps(audit_entry))
    
    @staticmethod
    def log_login_attempt(username: str, ip_address: str, success: bool, reason: Optional[str] = None):
        """Log login attempt"""
        AuditLogger.log_event(
            AuditEventType.LOGIN_SUCCESS if success else AuditEventType.LOGIN_FAILURE,
            username=username,
            ip_address=ip_address,
            success=success,
            details={"reason": reason} if reason else None
        )
    
    @staticmethod
    def log_data_access(user_id: str, resource: str, ip_address: str):
        """Log data access event"""
        AuditLogger.log_event(
            AuditEventType.DATA_ACCESS,
            user_id=user_id,
            ip_address=ip_address,
            details={"resource": resource}
        )
    
    @staticmethod
    def log_permission_denied(user_id: str, resource: str, ip_address: str, reason: str):
        """Log permission denied event"""
        AuditLogger.log_event(
            AuditEventType.PERMISSION_DENIED,
            user_id=user_id,
            ip_address=ip_address,
            success=False,
            details={"resource": resource, "reason": reason}
        )
