"""
Example: Processor Service with Enhanced Microservice Patterns

Demonstrates how to use:
- Standardized health checks
- Service registry
- API contracts
- Resilience patterns
"""

from fastapi import FastAPI, HTTPException
from contextlib import asynccontextmanager
import structlog

# New microservice components
from core.health.framework import (
    health_registry,
    HealthCheck,
    create_health_endpoints,
    check_basic
)
from core.service_discovery.registry import get_service_registry, ServiceClient
from core.contracts.schemas import (
    BaseServiceRequest,
    BaseServiceResponse,
    ServiceStatus,
    ErrorCode,
    create_error_response
)
from core.resilience.patterns import Bulkhead, RetryPolicy, resilient

# Existing components
from core.config.settings import settings
from core.logging.logger import configure_logger, get_logger
from core.database.pool import db_pool, read_session

configure_logger()
logger = get_logger("processor-enhanced")

# Resilience components
db_bulkhead = Bulkhead("database-queries", max_concurrent=50)
kafka_retry = RetryPolicy(max_attempts=3, base_delay=1.0)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle management with service registration"""
    
    # Register health checks
    health_registry.register_liveness(
        HealthCheck("basic", check_basic, critical=True, timeout=1)
    )
    
    health_registry.register_readiness(
        HealthCheck("database", check_database_health, critical=True, timeout=5)
    )
    
    health_registry.register_readiness(
        HealthCheck("kafka", check_kafka_health, critical=True, timeout=5)
    )
    
    health_registry.register_readiness(
        HealthCheck("cache", check_cache_health, critical=False, timeout=3)
    )
    
    # Register service with discovery
    registry = get_service_registry()
    await registry.register(
        service_name="processor-service",
        instance_id=f"processor-{settings.INSTANCE_ID or '1'}",
        host=settings.SERVICE_HOST or "processor",
        port=settings.SERVICE_PORT or 8000,
        health_check_url=f"http://{settings.SERVICE_HOST}:{ settings.SERVICE_PORT}/health/live",
        metadata={
            "version": "2.0.0",
            "capabilities": ["analytics", "enrichment"]
        }
    )
    
    logger.info("Processor service started with enhanced microservice patterns")
    
    yield
    
    # Deregister service
    await registry.deregister(
        service_name="processor-service",
        instance_id=f"processor-{settings.INSTANCE_ID or '1'}"
    )
    
    logger.info("Processor service stopped")


# Create FastAPI app
app = FastAPI(
    title="Processor Service (Enhanced)",
    description="Microservice with health checks, service discovery, and resilience patterns",
    version="2.0.0",
    lifespan=lifespan
)

# Add standardized health endpoints
create_health_endpoints(app, "processor-service")


# Health check functions

async def check_database_health() -> dict:
    """Check database connectivity"""
    from sqlalchemy import text
    
    async with read_session() as session:
        await session.execute(text("SELECT 1"))
    
    return {"status": "connected", "pool_size": db_pool.pool_size}


async def check_kafka_health() -> dict:
    """Check Kafka connectivity"""
    # Check Kafka consumer/producer
    return {"status": "connected", "brokers": 3}


async def check_cache_health() -> dict:
    """Check cache connectivity"""
    from core.cache.layered_cache import layered_cache
    
    # Test cache
    await layered_cache.set("health_check", "ok", ttl=5)
    value = await layered_cache.get("health_check")
    
    return {"status": "connected", "test_passed": value == "ok"}


# Example API endpoint using contracts

@app.post("/process", response_model=BaseServiceResponse)
async def process_data(request: BaseServiceRequest):
    """
    Example endpoint using standardized contracts
    
    Demonstrates:
    - Pydantic request/response models
    - Service discovery for storage service
    - Resilience patterns (bulkhead, retry)
    """
    try:
        logger.info(f"Processing request {request.request_id}")
        
        # Process data (example)
        @resilient(
            bulkhead=db_bulkhead,
            retry_policy=kafka_retry,
            timeout=10.0
        )
        async def process_with_resilience():
            # Your processing logic here
            return {"processed": True, "records": 100}
        
        result = await process_with_resilience()
        
        # Call storage service using service discovery
        storage_client = ServiceClient("storage-service")
        
        try:
            response = await storage_client.post(
                "/store",
                json={"data": result, "request_id": request.request_id}
            )
            logger.info(f"Stored data: {response.status_code}")
        except Exception as e:
            logger.warning(f"Storage service unavailable: {e}")
            # Continue processing even if storage fails
        
        # Return standardized response
        return BaseServiceResponse(
            request_id=request.request_id,
            status=ServiceStatus.SUCCESS,
            service_name="processor-service",
            data=result
        )
    
    except Exception as e:
        logger.error(f"Processing failed: {e}")
        return create_error_response(
            request_id=request.request_id,
            service_name="processor-service",
            error_code=ErrorCode.SERVICE_UNAVAILABLE,
            error_message=str(e)
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "examples.processor_enhanced:app",
        host="0.0.0.0",
        port=8000,
        reload=False
    )
