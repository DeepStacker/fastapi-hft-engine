"""
Standardized Health Check Framework

Provides consistent health check endpoints across all services.
"""
from fastapi import APIRouter, status
from pydantic import BaseModel
from typing import Dict, Optional, List
from datetime import datetime
from enum import Enum
import structlog
import asyncio

logger = structlog.get_logger(__name__)


class HealthStatus(str, Enum):
    """Health check status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ComponentHealth(BaseModel):
    """Health status of a single component"""
    name: str
    status: HealthStatus
    message: Optional[str] = None
    latency_ms: Optional[float] = None
    details: Optional[Dict] = None


class ServiceHealth(BaseModel):
    """Overall service health status"""
    service: str
    status: HealthStatus
    timestamp: datetime
    uptime_seconds: float
    version: str = "1.0.0"
    components: List[ComponentHealth] = []


class HealthChecker:
    """
    Health check coordinator for a service
    
    Aggregates health checks from multiple components.
    """
    
    def __init__(self, service_name: str, version: str = "1.0.0"):
        """
        Initialize health checker
        
        Args:
            service_name: Name of the service
            version: Service version
        """
        self.service_name = service_name
        self.version = version
        self._checks = {}
        self._start_time = datetime.utcnow()
        
    def register_check(self, component_name: str, check_func):
        """
        Register a health check function
        
        Args:
            component_name: Name of the component being checked
            check_func: Async function that returns (status, message, details)
        """
        self._checks[component_name] = check_func
        logger.debug(
            f"Registered health check",
            service=self.service_name,
            component=component_name
        )
        
    async def check_health(self) -> ServiceHealth:
        """
        Run all health checks and aggregate results
        
        Returns:
            ServiceHealth with overall status
        """
        component_results = []
        overall_status = HealthStatus.HEALTHY
        
        # Run all registered checks
        for component_name, check_func in self._checks.items():
            start_time = datetime.utcnow()
            
            try:
                # Run health check with timeout
                status_result, message, details = await asyncio.wait_for(
                    check_func(),
                    timeout=5.0  # 5 second timeout per check
                )
                
                latency = (datetime.utcnow() - start_time).total_seconds() * 1000
                
                component_results.append(ComponentHealth(
                    name=component_name,
                    status=status_result,
                    message=message,
                    latency_ms=round(latency, 2),
                    details=details
                ))
                
                # Downgrade overall status if component is degraded/unhealthy
                if status_result == HealthStatus.UNHEALTHY:
                    overall_status = HealthStatus.UNHEALTHY
                elif status_result == HealthStatus.DEGRADED and overall_status == HealthStatus.HEALTHY:
                    overall_status = HealthStatus.DEGRADED
                    
            except asyncio.TimeoutError:
                logger.warning(
                    f"Health check timeout",
                    service=self.service_name,
                    component=component_name
                )
                component_results.append(ComponentHealth(
                    name=component_name,
                    status=HealthStatus.UNHEALTHY,
                    message="Health check timeout",
                    latency_ms=5000.0
                ))
                overall_status = HealthStatus.UNHEALTHY
                
            except Exception as e:
                logger.error(
                    f"Health check error",
                    service=self.service_name,
                    component=component_name,
                    error=str(e)
                )
                component_results.append(ComponentHealth(
                    name=component_name,
                    status=HealthStatus.UNHEALTHY,
                    message=f"Error: {str(e)}"
                ))
                overall_status = HealthStatus.UNHEALTHY
        
        # Calculate uptime
        uptime = (datetime.utcnow() - self._start_time).total_seconds()
        
        return ServiceHealth(
            service=self.service_name,
            status=overall_status,
            timestamp=datetime.utcnow(),
            uptime_seconds=round(uptime, 2),
            version=self.version,
            components=component_results
        )
        
    def create_router(self) -> APIRouter:
        """
        Create FastAPI router with health endpoints
        
        Returns:
            APIRouter with /health and /health/live endpoints
        """
        router = APIRouter(tags=["health"])
        
        @router.get("/health", response_model=ServiceHealth)
        async def health_check():
            """
            Comprehensive health check
            
            Returns health status of service and all components
            """
            return await self.check_health()
        
        @router.get("/health/live")
        async def liveness_probe():
            """
            Kubernetes liveness probe
            
            Simple check that service is running
            """
            return {"status": "alive"}
        
        @router.get("/health/ready")
        async def readiness_probe():
            """
            Kubernetes readiness probe
            
            Checks if service is ready to accept traffic
            """
            health = await self.check_health()
            if health.status == HealthStatus.UNHEALTHY:
                return {"status": "not_ready"}, status.HTTP_503_SERVICE_UNAVAILABLE
            return {"status": "ready"}
        
        return router


# Example health check functions

async def check_database_health(db_engine) -> tuple:
    """
    Check database connectivity
    
    Args:
        db_engine: SQLAlchemy engine
        
    Returns:
        (status, message, details)
    """
    try:
        async with db_engine.connect() as conn:
            await conn.execute("SELECT 1")
        return (HealthStatus.HEALTHY, "Database connected", {"type": "postgresql"})
    except Exception as e:
        return (HealthStatus.UNHEALTHY, f"Database error: {str(e)}", None)


async def check_redis_health(redis_client) -> tuple:
    """
    Check Redis connectivity
    
    Args:
        redis_client: Redis client
        
    Returns:
        (status, message, details)
    """
    try:
        await redis_client.ping()
        return (HealthStatus.HEALTHY, "Redis connected", None)
    except Exception as e:
        return (HealthStatus.UNHEALTHY, f"Redis error: {str(e)}", None)


async def check_kafka_health(kafka_producer) -> tuple:
    """
    Check Kafka connectivity
    
    Args:
        kafka_producer: Kafka producer
        
    Returns:
        (status, message, details)
    """
    try:
        # Check if producer is started
        if kafka_producer and hasattr(kafka_producer, '_sender'):
            return (HealthStatus.HEALTHY, "Kafka connected", None)
        else:
            return (HealthStatus.DEGRADED, "Kafka producer not initialized", None)
    except Exception as e:
        return (HealthStatus.UNHEALTHY, f"Kafka error: {str(e)}", None)
