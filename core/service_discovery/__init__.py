"""
Service Discovery and Registration

Dynamic service discovery for microservices communication.
"""

from core.service_discovery.registry import (
    ServiceInstance,
    ServiceRegistry,
    ServiceNotAvailable,
    get_service_registry,
    ServiceClient
)

__all__ = [
    "ServiceInstance",
    "ServiceRegistry",
    "ServiceNotAvailable",
    "get_service_registry",
    "ServiceClient"
]
