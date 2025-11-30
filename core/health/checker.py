"""
Enhanced Health Checks

Comprehensive health checks that verify all dependencies:
- Database connectivity
- Redis connectivity
- Kafka connectivity
"""

from datetime import datetime
from typing import Dict, Any
import asyncio
import structlog

logger = structlog.get_logger("health-check")


class HealthChecker:
    """Centralized health checking for all dependencies"""
    
    def __init__(self):
        self.checks = {}
    
    async def check_database(self, engine) -> Dict[str, Any]:
        """Check database connectivity and pool status"""
        try:
            async with engine.begin() as conn:
                await conn.execute("SELECT 1")
            
            # Get pool status
            pool = engine.pool
            pool_status = {
                "size": pool.size(),
                "checked_in": pool.checkedin(),
                "checked_out": pool.checkedout(),
                "overflow": pool.overflow()
            }
            
            return {
                "status": "healthy",
                "pool": pool_status,
                "latency_ms": 0  # Could measure actual latency
            }
            
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    async def check_redis(self, redis_client) -> Dict[str, Any]:
        """Check Redis connectivity"""
        try:
            start = datetime.utcnow()
            await redis_client.ping()
            latency = (datetime.utcnow() - start).total_seconds() * 1000
            
            # Get Redis info
            info = await redis_client.info()
            
            return {
                "status": "healthy",
                "latency_ms": round(latency, 2),
                "connected_clients": info.get('connected_clients'),
                "used_memory_human": info.get('used_memory_human')
            }
            
        except Exception as e:
            logger.error(f"Redis health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    async def check_kafka(self, bootstrap_servers: str) -> Dict[str, Any]:
        """Check Kafka connectivity"""
        try:
            from aiokafka import AIOKafkaProducer
            
            producer = AIOKafkaProducer(
                bootstrap_servers=bootstrap_servers,
                request_timeout_ms=5000
            )
            
            await asyncio.wait_for(producer.start(), timeout=5.0)
            await producer.stop()
            
            return {
                "status": "healthy",
                "bootstrap_servers": bootstrap_servers
            }
            
        except asyncio.TimeoutError:
            return {
                "status": "unhealthy",
                "error": "Connection timeout"
            }
        except Exception as e:
            logger.error(f"Kafka health check failed: {e}")
            return {
                "status": "unhealthy",
                "error": str(e)
            }
    
    async def check_all(
        self,
        database_engine=None,
        redis_client=None,
        kafka_servers=None
    ) -> Dict[str, Any]:
        """
        Run all health checks in parallel.
        
        Returns overall health status and individual check results.
        """
        checks = {}
        
        # Run checks in parallel
        tasks = []
        
        if database_engine:
            tasks.append(("database", self.check_database(database_engine)))
        
        if redis_client:
            tasks.append(("redis", self.check_redis(redis_client)))
        
        if kafka_servers:
            tasks.append(("kafka", self.check_kafka(kafka_servers)))
        
        # Execute all checks
        results = await asyncio.gather(*[task[1] for task in tasks], return_exceptions=True)
        
        # Combine results
        for (name, _), result in zip(tasks, results):
            if isinstance(result, Exception):
                checks[name] = {
                    "status": "unhealthy",
                    "error": str(result)
                }
            else:
                checks[name] = result
        
        # Determine overall status
        statuses = [check.get("status") for check in checks.values()]
        
        if all(s == "healthy" for s in statuses):
            overall_status = "healthy"
        elif any(s == "unhealthy" for s in statuses):
            overall_status = "degraded"
        else:
            overall_status = "unhealthy"
        
        return {
            "status": overall_status,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks
        }


# Global health checker instance
health_checker = HealthChecker()
