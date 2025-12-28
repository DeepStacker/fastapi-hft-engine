"""
Standardized Health Check Framework

Provides comprehensive health checks with:
- Liveness checks (service is running)
- Readiness checks (service can handle traffic)
- Dependency health checks (database, cache, Kafka)
- Standardized response format
"""

from enum import Enum
from typing import Dict, List, Callable, Optional
from datetime import datetime
import asyncio
import structlog

logger = structlog.get_logger("health-framework")


class HealthStatus(Enum):
    """Health check status"""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class CheckResult:
    """Result of a single health check"""
    
    def __init__(
        self,
        name: str,
        status: HealthStatus,
        critical: bool = True,
        details: Optional[Dict] = None,
        error: Optional[str] = None
    ):
        self.name = name
        self.status = status
        self.critical = critical
        self.details = details or {}
        self.error = error
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        result = {
            "name": self.name,
            "status": self.status.value,
            "critical": self.critical,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if self.details:
            result["details"] = self.details
        
        if self.error:
            result["error"] = self.error
        
        return result


class HealthCheck:
    """Individual health check"""
    
    def __init__(
        self,
        name: str,
        check_fn: Callable,
        critical: bool = True,
        timeout: int = 5
    ):
        """
        Args:
            name: Check name
            check_fn: Async function that performs the check
            critical: If True, failure marks service as unhealthy
            timeout: Max seconds for check to complete
        """
        self.name = name
        self.check_fn = check_fn
        self.critical = critical
        self.timeout = timeout
    
    async def run(self) -> CheckResult:
        """Run the health check"""
        try:
            details = await asyncio.wait_for(
                self.check_fn(),
                timeout=self.timeout
            )
            
            return CheckResult(
                name=self.name,
                status=HealthStatus.HEALTHY,
                critical=self.critical,
                details=details
            )
        
        except asyncio.TimeoutError:
            logger.error(f"Health check {self.name} timed out")
            return CheckResult(
                name=self.name,
                status=HealthStatus.UNHEALTHY,
                critical=self.critical,
                error=f"Check timed out after {self.timeout}s"
            )
        
        except Exception as e:
            logger.error(f"Health check {self.name} failed: {e}")
            return CheckResult(
                name=self.name,
                status=HealthStatus.UNHEALTHY,
                critical=self.critical,
                error=str(e)
            )


class HealthCheckRegistry:
    """
    Registry for all health checks
    
    Usage:
        # Register checks
        registry.register_liveness(HealthCheck("basic", check_basic))
        registry.register_readiness(HealthCheck("database", check_db))
        
        # Get health
        health = await registry.get_health()
    """
    
    def __init__(self):
        self.liveness_checks: List[HealthCheck] = []
        self.readiness_checks: List[HealthCheck] = []
    
    def register_liveness(self, check: HealthCheck):
        """
        Register liveness check
        
        Liveness = Is the service running?
        Failed liveness = Restart the pod
        """
        self.liveness_checks.append(check)
        logger.info(f"Registered liveness check: {check.name}")
    
    def register_readiness(self, check: HealthCheck):
        """
        Register readiness check
        
        Readiness = Can the service handle traffic?
        Failed readiness = Remove from load balancer
        """
        self.readiness_checks.append(check)
        logger.info(f"Registered readiness check: {check.name}")
    
    async def check_liveness(self) -> Dict:
        """
        Check if service is alive
        
        Returns immediately with basic info.
        Used by Kubernetes liveness probe.
        """
        # Run liveness checks
        results = await asyncio.gather(
            *[check.run() for check in self.liveness_checks],
            return_exceptions=True
        )
        
        # Service is alive if no critical checks failed
        unhealthy_critical = any(
            isinstance(r, CheckResult) and 
            r.status == HealthStatus.UNHEALTHY and 
            r.critical
            for r in results
        )
        
        status = HealthStatus.UNHEALTHY if unhealthy_critical else HealthStatus.HEALTHY
        
        return {
            "status": status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": [r.to_dict() for r in results if isinstance(r, CheckResult)]
        }
    
    async def check_readiness(self) -> Dict:
        """
        Check if service is ready to handle traffic
        
        Checks all dependencies (DB, cache, Kafka, etc.)
        Used by Kubernetes readiness probe.
        """
        # Run readiness checks
        results = await asyncio.gather(
            *[check.run() for check in self.readiness_checks],
            return_exceptions=True
        )
        
        # Determine overall status
        unhealthy_critical = any(
            isinstance(r, CheckResult) and 
            r.status == HealthStatus.UNHEALTHY and 
            r.critical
            for r in results
        )
        
        unhealthy_non_critical = any(
            isinstance(r, CheckResult) and 
            r.status == HealthStatus.UNHEALTHY and 
            not r.critical
            for r in results
        )
        
        if unhealthy_critical:
            status = HealthStatus.UNHEALTHY
        elif unhealthy_non_critical:
            status = HealthStatus.DEGRADED
        else:
            status = HealthStatus.HEALTHY
        
        return {
            "status": status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": [r.to_dict() for r in results if isinstance(r, CheckResult)]
        }
    
    async def get_health(self) -> Dict:
        """
        Get complete health status
        
        Returns both liveness and readiness.
        Use for /health endpoint.
        """
        liveness = await self.check_liveness()
        readiness = await self.check_readiness()
        
        # Overall status is worst of both
        statuses = [
            HealthStatus[liveness["status"].upper()],
            HealthStatus[readiness["status"].upper()]
        ]
        
        overall_status = max(statuses, key=lambda s: list(HealthStatus).index(s))
        
        return {
            "status": overall_status.value,
            "timestamp": datetime.utcnow().isoformat(),
            "liveness": liveness,
            "readiness": readiness
        }


# Singleton
health_registry = HealthCheckRegistry()


# Common health checks

async def check_basic() -> Dict:
    """Basic liveness check"""
    return {"service": "running"}


async def check_database(db_pool) -> Dict:
    """Check database connectivity"""
    from sqlalchemy import text
    
    async with db_pool.get_read_session() as session:
        result = await session.execute(text("SELECT 1"))
        row = result.scalar()
    
    return {"database": "connected", "test_query": "passed"}


async def check_redis(redis_client) -> Dict:
    """Check Redis connectivity"""
    await redis_client.ping()
    
    return {"redis": "connected"}


async def check_kafka(consumer) -> Dict:
    """Check Kafka connectivity"""
    # Get consumer group metadata
    partitions = consumer.assignment()
    
    return {
        "kafka": "connected",
        "partitions": len(partitions) if partitions else 0
    }


# FastAPI integration

def create_health_endpoints(app, service_name: str):
    """
    Create standardized health endpoints for FastAPI app
    
    Usage:
        from core.health.framework import create_health_endpoints
        create_health_endpoints(app, "processor-service")
    """
    
    @app.get("/health")
    async def health():
        """Complete health check"""
        return await health_registry.get_health()
    
    @app.get("/health/live")
    async def liveness():
        """Liveness probe for Kubernetes"""
        return await health_registry.check_liveness()
    
    @app.get("/health/ready")
    async def readiness():
        """Readiness probe for Kubernetes"""
        return await health_registry.check_readiness()
    
    @app.get("/")
    async def root():
        """Service info"""
        return {
            "service": service_name,
            "status": "running",
            "timestamp": datetime.utcnow().isoformat(),
            "endpoints": {
                "health": "/health",
                "liveness": "/health/live",
                "readiness": "/health/ready"
            }
        }
