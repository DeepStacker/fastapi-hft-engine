# Multi-stage Dockerfile for optimized production builds

# Stage 1: Builder
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    make \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt ./

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    wget \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Install grpc_health_probe for gRPC health checks
RUN GRPC_HEALTH_PROBE_VERSION=v0.4.24 && \
    wget -qO/bin/grpc_health_probe \
    https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/${GRPC_HEALTH_PROBE_VERSION}/grpc_health_probe-linux-amd64 && \
    chmod +x /bin/grpc_health_probe

# Install docker-compose plugin
RUN DOCKER_COMPOSE_VERSION=v2.24.5 && \
    mkdir -p /usr/local/lib/docker/cli-plugins && \
    wget -qO /usr/local/lib/docker/cli-plugins/docker-compose \
    https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-linux-x86_64 && \
    chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY . .

# Compile Protocol Buffers BEFORE switching to non-root user
RUN python -m grpc_tools.protoc \
    -I./protos \
    --python_out=./core/grpc_server \
    --python_out=./core/grpc_client \
    --grpc_python_out=./core/grpc_server \
    --grpc_python_out=./core/grpc_client \
    ./protos/stockify.proto

# Create __init__.py files for proper Python module imports
RUN touch ./core/grpc_server/__init__.py && \
    touch ./core/grpc_client/__init__.py

# Fix imports in generated proto files to use relative imports
RUN sed -i 's/^import stockify_pb2/from . import stockify_pb2/g' ./core/grpc_server/stockify_pb2_grpc.py && \
    sed -i 's/^import stockify_pb2/from . import stockify_pb2/g' ./core/grpc_client/stockify_pb2_grpc.py

# Verify proto files were generated successfully
RUN ls -la ./core/grpc_server/stockify_pb2.py && \
    ls -la ./core/grpc_server/stockify_pb2_grpc.py

# Create non-root user
RUN useradd -m -u 1000 stockify && \
    chown -R stockify:stockify /app

USER stockify

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default port
EXPOSE 8000 50051

# Default command (override in docker-compose)
CMD ["uvicorn", "services.gateway.main:app", "--host", "0.0.0.0", "--port", "8000"]
