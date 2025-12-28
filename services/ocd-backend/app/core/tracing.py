"""
OpenTelemetry Distributed Tracing Setup

Provides end-to-end request tracing across services for debugging at scale.
Integrates with FastAPI for automatic instrumentation.
"""
import logging
from typing import Optional
from contextlib import asynccontextmanager

try:
    from opentelemetry import trace
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter
    from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION
    OTEL_AVAILABLE = True
except ImportError:
    OTEL_AVAILABLE = False
    trace = None

# Optional instrumentations - may not be installed
FastAPIInstrumentor = None
HTTPXClientInstrumentor = None
RedisInstrumentor = None
SQLAlchemyInstrumentor = None

try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
except ImportError:
    pass
try:
    from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
except ImportError:
    pass
try:
    from opentelemetry.instrumentation.redis import RedisInstrumentor
except ImportError:
    pass
try:
    from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
except ImportError:
    pass

from app.config.settings import settings

logger = logging.getLogger(__name__)

# Global tracer
_tracer: Optional[trace.Tracer] = None


def init_tracing(app=None, engine=None):
    """
    Initialize OpenTelemetry tracing.
    
    Args:
        app: FastAPI application instance
        engine: SQLAlchemy engine for DB tracing
    """
    global _tracer
    
    # Skip if already initialized or disabled
    if not getattr(settings, 'OTEL_ENABLED', True):
        logger.info("OpenTelemetry tracing disabled")
        return
    
    # Create resource with service info
    resource = Resource.create({
        SERVICE_NAME: getattr(settings, 'OTEL_SERVICE_NAME', 'stockify-backend'),
        SERVICE_VERSION: getattr(settings, 'APP_VERSION', '1.0.0'),
        "deployment.environment": getattr(settings, 'ENVIRONMENT', 'development'),
    })
    
    # Create tracer provider
    provider = TracerProvider(resource=resource)
    
    # Add exporters
    otlp_endpoint = getattr(settings, 'OTEL_EXPORTER_OTLP_ENDPOINT', None)
    
    if otlp_endpoint:
        try:
            from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
            otlp_exporter = OTLPSpanExporter(endpoint=otlp_endpoint)
            provider.add_span_processor(BatchSpanProcessor(otlp_exporter))
            logger.info(f"OTLP exporter configured: {otlp_endpoint}")
        except ImportError:
            logger.warning("OTLP exporter not available, using console exporter")
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
    else:
        # Development: console exporter for debugging
        if getattr(settings, 'DEBUG', False):
            provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))
            logger.info("Console span exporter enabled (DEBUG mode)")
    
    # Set global tracer provider
    trace.set_tracer_provider(provider)
    _tracer = trace.get_tracer(__name__)
    
    # Instrument FastAPI
    if app and FastAPIInstrumentor:
        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumented")
    
    # Instrument HTTP clients (for Dhan API calls)
    if HTTPXClientInstrumentor:
        HTTPXClientInstrumentor().instrument()
        logger.info("HTTPX client instrumented")
    
    # Instrument Redis
    if RedisInstrumentor:
        try:
            RedisInstrumentor().instrument()
            logger.info("Redis instrumented")
        except Exception as e:
            logger.warning(f"Redis instrumentation failed: {e}")
    
    # Instrument SQLAlchemy
    if engine and SQLAlchemyInstrumentor:
        try:
            SQLAlchemyInstrumentor().instrument(engine=engine)
            logger.info("SQLAlchemy instrumented")
        except Exception as e:
            logger.warning(f"SQLAlchemy instrumentation failed: {e}")
    
    logger.info("OpenTelemetry tracing initialized")


def get_tracer() -> trace.Tracer:
    """Get the global tracer instance."""
    global _tracer
    if _tracer is None:
        _tracer = trace.get_tracer(__name__)
    return _tracer


@asynccontextmanager
async def trace_span(name: str, attributes: dict = None):
    """
    Context manager for creating trace spans.
    
    Usage:
        async with trace_span("fetch_option_chain", {"symbol": "NIFTY"}):
            data = await fetch_data()
    """
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as span:
        if attributes:
            for key, value in attributes.items():
                span.set_attribute(key, str(value))
        try:
            yield span
        except Exception as e:
            span.record_exception(e)
            span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
            raise


def trace_function(name: str = None, attributes: dict = None):
    """
    Decorator for tracing async functions.
    
    Usage:
        @trace_function("calculate_greeks")
        async def calculate_greeks(symbol: str):
            ...
    """
    def decorator(func):
        import functools
        
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            span_name = name or func.__name__
            tracer = get_tracer()
            with tracer.start_as_current_span(span_name) as span:
                if attributes:
                    for key, value in attributes.items():
                        span.set_attribute(key, str(value))
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    span.record_exception(e)
                    span.set_status(trace.Status(trace.StatusCode.ERROR, str(e)))
                    raise
        
        return wrapper
    return decorator


def shutdown_tracing():
    """Shutdown tracing and flush spans."""
    try:
        provider = trace.get_tracer_provider()
        if hasattr(provider, 'shutdown'):
            provider.shutdown()
            logger.info("OpenTelemetry tracing shutdown complete")
    except Exception as e:
        logger.error(f"Error shutting down tracing: {e}")
