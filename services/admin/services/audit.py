"""
Audit Service
Handles recording of administrative actions for security and compliance.
"""
from datetime import datetime
from uuid import UUID
from typing import Optional, Dict, Any
from core.database.pool import write_session
from core.database.models import AdminAuditLogDB
import logging

logger = logging.getLogger("stockify.admin.audit")

class AuditService:
    async def log(
        self,
        action: str,
        resource_type: str,
        resource_id: Optional[str] = None,
        actor_id: Optional[UUID] = None,
        details: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        status: str = "success"
    ) -> AdminAuditLogDB:
        """
        Record an audit log entry.
        
        Args:
            action: The action performed (e.g., "create", "delete", "login")
            resource_type: The type of resource affected (e.g., "user", "config", "system")
            resource_id: ID of the resource affected
            actor_id: UUID of the admin performing the action
            details: JSON-serializable dictionary of extra details (diff, snapshots)
            ip_address: IP address of the actor
            status: Outcome of the action ("success", "failure")
        """
        try:
            async with write_session() as session:
                log_entry = AdminAuditLogDB(
                    action=action,
                    resource_type=resource_type,
                    resource_id=resource_id,
                    actor_id=actor_id,
                    details=details,
                    ip_address=ip_address,
                    status=status,
                    timestamp=datetime.utcnow()
                )
                session.add(log_entry)
                await session.commit()
                return log_entry
        except Exception as e:
            logger.error(f"Failed to write audit log: {e}")
            # Audit logging failure should not break the main application flow, 
            # but it is critical error.
            return None

audit_service = AuditService()
