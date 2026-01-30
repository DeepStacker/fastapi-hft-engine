"""
OpenTelemetry Distributed Tracing Module

BREAKING CHANGE: All services now instrumented with automatic tracing
- Complete request flow visibility (Ingestion → Processor → Storage)
- Performance bottleneck identification
- Error tracking across service boundaries
"""

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME
from opentelemetry.exporter.jaeger.thrift import JaegerExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.asyncpg import AsyncPGInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.trace import Status, StatusCode
from opentelemetry.context import attach, detach, set_value
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator

import asyncio  # Required for iscoroutinefunction check
import logging
from typing import Dict, Any, Optional
from functools import wraps

logger = logging.getLogger(__name__)


class DistributedTracer:
    """
    Centralized distributed tracing manager
    
    BREAKING CHANGE: All services automatically instrumented
    - Traces propagate via Kafka message headers
    - End-to-end visibility: Ingestion → Processor → Storage
    - Automatic DB and Redis instrumentation
    """
    
    _instance = None
    _initialized = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize once per service"""
        if not self._initialized:
            self._tracer = None
            self._propagator = TraceContextTextMapPropagator()
    
    def initialize(
        self,
        service_name: str,
        jaeger_host: str = "localhost",
        jaeger_port: int = 6831
    ):
        """
        Initialize OpenTelemetry tracing for service
        
        BREAKING CHANGE: Must be called on service startup
        
        Args:
            service_name: Name of the service (e.g., "ingestion-service")
            jaeger_host: Jaeger agent hostname
            jaeger_port: Jaeger agent port (UDP)
        """
        import os
        
        if self._initialized:
            logger.warning(f"Tracer already initialized for {service_name}")
            return
        
        # Check if tracing is enabled (default: True for backward compatibility)
        enable_tracing = os.getenv("ENABLE_TRACING", "true").lower() in ("true", "1", "yes")
        
        if not enable_tracing:
            logger.info(f"Distributed tracing disabled for {service_name} (ENABLE_TRACING=false)")
            self._initialized = True
            # Create a no-op tracer
            self._tracer = trace.get_tracer(__name__)
            return
        
        try:
            # Create resource
            resource = Resource.create({SERVICE_NAME: service_name})
            
            # Create Jaeger exporter
            jaeger_exporter = JaegerExporter(
                agent_host_name=jaeger_host,
                agent_port=jaeger_port,
            )
            
            # Set up tracer provider
            provider = TracerProvider(resource=resource)
            processor = BatchSpanProcessor(jaeger_exporter)
            provider.add_span_processor(processor)
            
            # Register provider
            trace.set_tracer_provider(provider)
            
            # Get tracer
            self._tracer = trace.get_tracer(__name__)
            
            # Auto-instrument libraries
            AsyncPGInstrumentor().instrument()
            RedisInstrumentor().instrument()
            LoggingInstrumentor().instrument()
            
            self._initialized = True
            logger.info(f"✓ Distributed tracing initialized for {service_name}")
            logger.info(f"✓ Jaeger exporter: {jaeger_host}:{jaeger_port}")
            
        except Exception as e:
            logger.warning(f"Failed to initialize Jaeger tracing: {e}. Tracing disabled.")
            # Fall back to no-op tracer
            self._tracer = trace.get_tracer(__name__)
            self._initialized = True
    
    def get_tracer(self) -> trace.Tracer:
        """Get tracer instance"""
        if not self._initialized:
            raise RuntimeError("Tracer not initialized. Call initialize() first.")
        return self._tracer
    
    def start_span(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        """
        Start a new span
        
        Usage:
            with tracer.start_span("process_symbol", {"symbol": "NIFTY"}):
                # Your code here
        """
        span = self._tracer.start_span(name)
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, str(value))
        return span
    
    def inject_context(self, carrier: Dict[str, str]):
        """
        Inject trace context into carrier (e.g., Kafka headers)
        
        BREAKING CHANGE: All Kafka messages now include trace headers
        
        Usage:
            headers = {}
            tracer.inject_context(headers)
            await producer.send(topic, value=message, headers=headers)
        """
        self._propagator.inject(carrier)
    
    def extract_context(self, carrier: Dict[str, str]):
        """
        Extract trace context from carrier (e.g., Kafka headers)
        
        Usage:
            context = tracer.extract_context(message.headers)
            with tracer.start_span("process_message", context=context):
                # Processing logic
        """
        return self._propagator.extract(carrier)
    
    def record_exception(self, exception: Exception):
        """Record exception in current span"""
        span = trace.get_current_span()
        if span:
            span.record_exception(exception)
            span.set_status(Status(StatusCode.ERROR, str(exception)))


# Singleton instance
distributed_tracer = DistributedTracer()


def traced(span_name: str = None):
    """
    Decorator for automatic function tracing
    
    Usage:
        @traced("process_instrument")
        async def process_instrument(symbol_id: int):
            # Automatically traced
            pass
    """
    def decorator(func):
        name = span_name or f"{func.__module__}.{func.__name__}"
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            tracer = distributed_tracer.get_tracer()
            with tracer.start_as_current_span(name) as span:
                try:
                    # Add function arguments as attributes
                    if args:
                        span.set_attribute("args", str(args[:3]))  # First 3 args
                    if kwargs:
                        for key, value in list(kwargs.items())[:5]:  # First 5 kwargs
                            span.set_attribute(f"kwarg.{key}", str(value)[:100])
                    
                    result = await func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            tracer = distributed_tracer.get_tracer()
            with tracer.start_as_current_span(name) as span:
                try:
                    result = func(*args, **kwargs)
                    span.set_status(Status(StatusCode.OK))
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(Status(StatusCode.ERROR, str(e)))
                    raise
        
        # Return appropriate wrapper
        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper
    
    return decorator


def instrument_fastapi(app):
    """
    Auto-instrument FastAPI application
    
    BREAKING CHANGE: All HTTP endpoints automatically traced
    
    Usage:
        from core.observability.tracing import instrument_fastapi
        
        app = FastAPI()
        instrument_fastapi(app)
    """
    FastAPIInstrumentor.instrument_app(app)
    logger.info("✓ FastAPI instrumented for distributed tracing")


# Kafka trace propagation helpers
def create_kafka_headers_with_trace() -> list:
    """
    Create Kafka headers with trace context
    
    Returns:
        List of (key, value) tuples for Kafka headers
    """
    carrier = {}
    distributed_tracer.inject_context(carrier)
    return [(k.encode(), v.encode()) for k, v in carrier.items()]


def extract_trace_from_kafka_headers(headers: list) -> Optional[dict]:
    """
    Extract trace context from Kafka message headers
    
    Args:
        headers: Kafka message headers [(key, value), ...]
        
    Returns:
        Trace context dict or None
    """
    if not headers:
        return None
    
    carrier = {}
    for k, v in headers:
        key = k.decode() if isinstance(k, bytes) else k
        val = v.decode() if isinstance(v, bytes) else v
        carrier[key] = val
        
    return distributed_tracer.extract_context(carrier)
