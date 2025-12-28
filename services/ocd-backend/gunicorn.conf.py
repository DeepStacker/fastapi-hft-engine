"""
Gunicorn Production Configuration
Optimized for millions of concurrent users
"""
import os
import multiprocessing


# Worker configuration
workers = int(os.environ.get("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = "uvicorn.workers.UvicornWorker"
threads = int(os.environ.get("GUNICORN_THREADS", 4))

# Uvicorn worker configuration - disable access logs since our middleware handles this
worker_class_args = {"access_log": False}

# Binding
bind = os.environ.get("GUNICORN_BIND", "0.0.0.0:8000")

# Timeouts
timeout = int(os.environ.get("GUNICORN_TIMEOUT", 120))
keepalive = int(os.environ.get("GUNICORN_KEEPALIVE", 5))
graceful_timeout = int(os.environ.get("GUNICORN_GRACEFUL_TIMEOUT", 30))

# Limits
max_requests = int(os.environ.get("GUNICORN_MAX_REQUESTS", 10000))
max_requests_jitter = int(os.environ.get("GUNICORN_MAX_REQUESTS_JITTER", 1000))

# Logging - Disable access logs since FastAPI middleware handles this
loglevel = os.environ.get("GUNICORN_LOG_LEVEL", "warning")  # Reduced from info
accesslog = None  # Disable gunicorn access logs (FastAPI middleware logs requests)
errorlog = os.environ.get("GUNICORN_ERROR_LOG", "-")
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = "stockify_api"

# Security
limit_request_line = 8190
limit_request_fields = 100
limit_request_field_size = 8190

# Pre-loading for faster startup
preload_app = True


def on_starting(server):
    """Pre-start hook"""
    print(f"Starting Gunicorn with {workers} workers")


def on_exit(server):
    """Pre-exit hook"""
    print("Shutting down Gunicorn")


def worker_exit(server, worker):
    """Worker exit hook for cleanup"""
    pass
