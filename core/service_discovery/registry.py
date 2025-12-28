"""
Service Registry for Dynamic Service Discovery

Enables services to register themselves and discover other services dynamically.
Works with Consul/Etcd or in-memory mode for development.
"""

from typing import Dict, List, Optional, Callable
from dataclasses import dataclass
import asyncio
import random
import structlog

logger = structlog.get_logger("service-registry")


@dataclass
class ServiceInstance:
    """Represents a service instance"""
    service_name: str
    instance_id: str
    host: str
    port: int
    health_check_url: Optional[str] = None
    metadata: Dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}
    
    @property
    def url(self) -> str:
        """Get full URL for this instance"""
        return f"http://{self.host}:{self.port}"


class ServiceRegistry:
    """
    Service Registry for dynamic service discovery
    
    Supports:
    - Service registration with health checks
    - Service discovery with load balancing
    - Health-based routing
    - In-memory mode (development) or Consul backend (production)
    
    Usage:
        # Register service
        registry = get_service_registry()
        await registry.register(
            service_name="processor",
            instance_id="processor-1",
            host="processor",
            port=8000,
            health_check_url="http://processor:8000/health/live"
        )
        
        # Discover service
        url = await registry.get_service_url("storage")
        async with httpx.AsyncClient() as client:
            response = await client.post(url + "/store", json=data)
    """
    
    def __init__(self, backend: str = "memory"):
        """
        Args:
            backend: "memory" for in-memory (dev), "consul" for Consul (prod)
        """
        self.backend = backend
        self.services: Dict[str, List[ServiceInstance]] = {}
        self.health_checks: Dict[str, asyncio.Task] = {}
        
        if backend == "consul":
            try:
                import consul
                self.consul = consul.Consul(host="consul", port=8500)
                logger.info("Connected to Consul for service discovery")
            except ImportError:
                logger.warning("consul-python not installed, falling back to memory mode")
                self.backend = "memory"
        
    async def register(
        self,
        service_name: str,
        instance_id: str,
        host: str,
        port: int,
        health_check_url: Optional[str] = None,
        metadata: Optional[Dict] = None
    ):
        """Register a service instance"""
        instance = ServiceInstance(
            service_name=service_name,
            instance_id=instance_id,
            host=host,
            port=port,
            health_check_url=health_check_url,
            metadata=metadata or {}
        )
        
        if self.backend == "consul":
            await self._register_consul(instance)
        else:
            await self._register_memory(instance)
        
        logger.info(
            f"Registered service: {service_name} ({instance_id}) at {host}:{port}"
        )
    
    async def _register_memory(self, instance: ServiceInstance):
        """Register in memory (development mode)"""
        if instance.service_name not in self.services:
            self.services[instance.service_name] = []
        
        # Remove existing instance with same ID
        self.services[instance.service_name] = [
            inst for inst in self.services[instance.service_name]
            if inst.instance_id != instance.instance_id
        ]
        
        # Add new instance
        self.services[instance.service_name].append(instance)
        
        # Start health check if URL provided
        if instance.health_check_url:
            task_key = f"{instance.service_name}:{instance.instance_id}"
            if task_key in self.health_checks:
                self.health_checks[task_key].cancel()
            
            self.health_checks[task_key] = asyncio.create_task(
                self._health_check_loop(instance)
            )
    
    async def _register_consul(self, instance: ServiceInstance):
        """Register with Consul"""
        check = None
        if instance.health_check_url:
            import consul
            check = consul.Check.http(
                instance.health_check_url,
                interval="10s",
                timeout="5s",
                deregister="30s"
            )
        
        self.consul.agent.service.register(
            name=instance.service_name,
            service_id=instance.instance_id,
            address=instance.host,
            port=instance.port,
            check=check,
            tags=list(instance.metadata.keys()) if instance.metadata else None
        )
    
    async def _health_check_loop(self, instance: ServiceInstance):
        """Periodic health check for in-memory mode"""
        import httpx
        
        while True:
            try:
                async with httpx.AsyncClient(timeout=5.0) as client:
                    response = await client.get(instance.health_check_url)
                    
                    if response.status_code != 200:
                        logger.warning(
                            f"Health check failed for {instance.instance_id}: "
                            f"status {response.status_code}"
                        )
                        # Remove unhealthy instance
                        self.services[instance.service_name] = [
                            inst for inst in self.services[instance.service_name]
                            if inst.instance_id != instance.instance_id
                        ]
                        break
            
            except Exception as e:
                logger.error(f"Health check error for {instance.instance_id}: {e}")
                # Remove unhealthy instance
                if instance.service_name in self.services:
                    self.services[instance.service_name] = [
                        inst for inst in self.services[instance.service_name]
                        if inst.instance_id != instance.instance_id
                    ]
                break
            
            await asyncio.sleep(10)
    
    async def deregister(self, service_name: str, instance_id: str):
        """Deregister a service instance"""
        if self.backend == "consul":
            self.consul.agent.service.deregister(instance_id)
        else:
            if service_name in self.services:
                self.services[service_name] = [
                    inst for inst in self.services[service_name]
                    if inst.instance_id != instance_id
                ]
        
        # Cancel health check
        task_key = f"{service_name}:{instance_id}"
        if task_key in self.health_checks:
            self.health_checks[task_key].cancel()
            del self.health_checks[task_key]
        
        logger.info(f"Deregistered service: {service_name} ({instance_id})")
    
    async def discover(self, service_name: str) -> List[ServiceInstance]:
        """Discover all healthy instances of a service"""
        if self.backend == "consul":
            return await self._discover_consul(service_name)
        else:
            return self.services.get(service_name, [])
    
    async def _discover_consul(self, service_name: str) -> List[ServiceInstance]:
        """Discover from Consul"""
        _, services = self.consul.health.service(service_name, passing=True)
        
        instances = []
        for service in services:
            instances.append(ServiceInstance(
                service_name=service_name,
                instance_id=service["Service"]["ID"],
                host=service["Service"]["Address"],
                port=service["Service"]["Port"],
                metadata=service["Service"].get("Tags", {})
            ))
        
        return instances
    
    async def get_service_url(
        self,
        service_name: str,
        load_balance: str = "random"
    ) -> str:
        """
        Get URL for a service instance
        
        Args:
            service_name: Name of the service to discover
            load_balance: Load balancing strategy ("random", "round_robin")
        
        Returns:
            Full URL for the service
        
        Raises:
            ServiceNotAvailable: No healthy instances found
        """
        instances = await self.discover(service_name)
        
        if not instances:
            raise ServiceNotAvailable(
                f"No healthy instances of service '{service_name}'"
            )
        
        # Simple load balancing
        if load_balance == "random":
            instance = random.choice(instances)
        else:  # round_robin
            # Use timestamp-based selection for stateless round-robin
            import time
            index = int(time.time()) % len(instances)
            instance = instances[index]
        
        return instance.url


class ServiceNotAvailable(Exception):
    """Raised when service is not available"""
    pass


# Singleton
_registry: Optional[ServiceRegistry] = None


def get_service_registry(backend: str = "memory") -> ServiceRegistry:
    """Get or create service registry singleton"""
    global _registry
    if _registry is None:
        _registry = ServiceRegistry(backend=backend)
    return _registry


# Service Client Helper

class ServiceClient:
    """
    HTTP client for inter-service communication with service discovery
    
    Usage:
        client = ServiceClient("storage-service")
        response = await client.post("/store", json=data)
    """
    
    def __init__(self, service_name: str, registry: Optional[ServiceRegistry] = None):
        self.service_name = service_name
        self.registry = registry or get_service_registry()
    
    async def _get_url(self) -> str:
        """Get service URL from registry"""
        return await self.registry.get_service_url(self.service_name)
    
    async def get(self, path: str, **kwargs):
        """GET request to service"""
        import httpx
        url = await self._get_url()
        async with httpx.AsyncClient() as client:
            return await client.get(f"{url}{path}", **kwargs)
    
    async def post(self, path: str, **kwargs):
        """POST request to service"""
        import httpx
        url = await self._get_url()
        async with httpx.AsyncClient() as client:
            return await client.post(f"{url}{path}", **kwargs)
    
    async def put(self, path: str, **kwargs):
        """PUT request to service"""
        import httpx
        url = await self._get_url()
        async with httpx.AsyncClient() as client:
            return await client.put(f"{url}{path}", **kwargs)
    
    async def delete(self, path: str, **kwargs):
        """DELETE request to service"""
        import httpx
        url = await self._get_url()
        async with httpx.AsyncClient() as client:
            return await client.delete(f"{url}{path}", **kwargs)
