"""
Admin Routers Package

Exports all admin routers for easy import.
"""
from services.admin.routers.system import router as system_router
from services.admin.routers.kafka import router as kafka_router
from services.admin.routers.instruments import router as instruments_router
from services.admin.routers.services import router as services_router
from services.admin.routers.database import router as database_router
from services.admin.routers.config import router as config_router
from services.admin.routers.auth import router as auth_router
from services.admin.routers.docker import router as docker_router
from services.admin.routers.logs import router as logs_router
from services.admin.routers.metrics import router as metrics_router
from services.admin.routers.deployment import router as deployment_router
from services.admin.routers.dhan_tokens import router as dhan_tokens_router
from services.admin.routers.traders import router as traders_router
from services.admin.routers.audit import router as audit_router

__all__ = [
    "system_router", "kafka_router", "instruments_router",
    "services_router", "database_router", "config_router", "auth_router",
    "docker_router", "logs_router", "metrics_router", "deployment_router",
    "dhan_tokens_router", "traders_router", "audit_router"
]
