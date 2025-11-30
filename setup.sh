#!/bin/bash

# Stockify - One-Command Setup Script
# This script sets up and runs the entire application with minimal user intervention

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Banner
echo -e "${CYAN}"
cat << "EOF"
   _____ _             _    _  __       
  / ____| |           | |  (_)/ _|      
 | (___ | |_ ___   ___| | ___| |_ _   _ 
  \___ \| __/ _ \ / __| |/ / |  _| | | |
  ____) | || (_) | (__|   <| | | | |_| |
 |_____/ \__\___/ \___|_|\_\_|_|  \__, |
                                   __/ |
    HFT Data Engine Setup         |___/ 
EOF
echo -e "${NC}"

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Stockify - Automated Setup${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if Docker is installed
echo -e "${YELLOW}🔍 Checking prerequisites...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}✗ Docker is not installed${NC}"
    echo -e "${YELLOW}Please install Docker from: https://docs.docker.com/get-docker/${NC}"
    exit 1
fi

if ! command -v docker compose &> /dev/null; then
    echo -e "${RED}✗ Docker Compose is not installed${NC}"
    echo -e "${YELLOW}Please install Docker Compose from: https://docs.docker.com/compose/install/${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker installed: $(docker --version)${NC}"
echo -e "${GREEN}✓ Docker Compose installed${NC}"

# Check if Docker daemon is running
if ! docker info &> /dev/null; then
    echo -e "${RED}✗ Docker daemon is not running${NC}"
    echo -e "${YELLOW}Please start Docker and try again${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Docker daemon is running${NC}"
echo ""

# Check if .env exists, if not copy from .env.example
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚙️  Creating .env file from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}✓ .env file created${NC}"
        echo -e "${YELLOW}⚠️  Please edit .env file and add your API credentials${NC}"
        echo -e "${YELLOW}   Required: DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN${NC}"
        echo ""
        read -p "Press Enter to continue after editing .env file, or Ctrl+C to exit and edit later..."
    else
        echo -e "${RED}✗ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✓ .env file exists${NC}"
fi

# Validate .env has required variables
echo -e "${YELLOW}🔍 Validating .env configuration...${NC}"
required_vars=("DATABASE_URL" "POSTGRES_DB" "POSTGRES_USER" "POSTGRES_PASSWORD" "REDIS_URL" "SECRET_KEY")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^${var}=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}✗ Missing required environment variables:${NC}"
    for var in "${missing_vars[@]}"; do
        echo -e "${RED}  - $var${NC}"
    done
    echo -e "${YELLOW}Please add these to your .env file${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All required environment variables present${NC}"
echo ""

# Ask user what they want to do
echo -e "${CYAN}Select an option:${NC}"
echo -e "${CYAN}1) Fresh setup (clean all data and start fresh)${NC}"
echo -e "${CYAN}2) Start services (keep existing data)${NC}"
echo -e "${CYAN}3) Stop all services${NC}"
echo -e "${CYAN}4) View logs${NC}"
echo -e "${CYAN}5) Clean up (remove all containers and data)${NC}"
echo ""
read -p "Enter your choice [1-5]: " choice

case $choice in
    1)
        echo -e "${YELLOW}⚠️  This will remove all existing containers and data!${NC}"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo -e "${YELLOW}Cancelled.${NC}"
            exit 0
        fi
        
        echo -e "${YELLOW}🧹 Cleaning up existing containers and volumes...${NC}"
        docker compose down -v 2>/dev/null || true
        echo -e "${GREEN}✓ Cleanup complete${NC}"
        echo ""
        
        echo -e "${YELLOW}🏗️  Building Docker images...${NC}"
        docker compose build
        echo -e "${GREEN}✓ Build complete${NC}"
        echo ""
        
        echo -e "${YELLOW}🚀 Starting infrastructure services...${NC}"
        docker compose up -d timescaledb redis zookeeper
        echo -e "${GREEN}✓ Infrastructure started${NC}"
        echo ""
        
        echo -e "${YELLOW}⏳ Waiting for services to be healthy (this may take 30-60 seconds)...${NC}"
        sleep 10
        
        # Wait for health checks
        echo -e "${YELLOW}Waiting for TimescaleDB...${NC}"
        timeout 60 bash -c 'until docker compose ps | grep timescaledb | grep -q "healthy"; do sleep 2; done' || {
            echo -e "${RED}✗ TimescaleDB failed to start${NC}"
            echo -e "${YELLOW}Check logs with: docker compose logs timescaledb${NC}"
            exit 1
        }
        echo -e "${GREEN}✓ TimescaleDB is healthy${NC}"
        
        echo -e "${YELLOW}Waiting for Redis...${NC}"
        timeout 30 bash -c 'until docker compose ps | grep redis | grep -q "healthy"; do sleep 2; done' || {
            echo -e "${RED}✗ Redis failed to start${NC}"
            echo -e "${YELLOW}Check logs with: docker compose logs redis${NC}"
            exit 1
        }
        echo -e "${GREEN}✓ Redis is healthy${NC}"
        
        echo -e "${YELLOW}⏳ Waiting for Zookeeper...${NC}"
        sleep 5
        echo -e "${GREEN}✓ Zookeeper started${NC}"
        
        echo -e "${YELLOW}🚀 Starting Kafka...${NC}"
        docker compose up -d kafka
        echo -e "${YELLOW}⏳ Waiting for Kafka to be ready (this may take 20-30 seconds)...${NC}"
        sleep 20
        echo -e "${GREEN}✓ Kafka started${NC}"
        echo ""
        
        echo -e "${YELLOW}🔧 Initializing database...${NC}"
        docker compose up db-init
        echo -e "${GREEN}✓ Database initialized${NC}"
        echo ""
        
        echo -e "${YELLOW}🚀 Starting application services...${NC}"
        docker compose up -d
        echo -e "${GREEN}✓ All services started${NC}"
        ;;
        
    2)
        echo -e "${YELLOW}🚀 Starting services...${NC}"
        docker compose up -d
        echo -e "${GREEN}✓ Services started${NC}"
        ;;
        
    3)
        echo -e "${YELLOW}⏹️  Stopping all services...${NC}"
        docker compose down
        echo -e "${GREEN}✓ All services stopped${NC}"
        exit 0
        ;;
        
    4)
        echo -e "${YELLOW}📋 Showing logs (Ctrl+C to exit)...${NC}"
        docker compose logs -f
        exit 0
        ;;
        
    5)
        echo -e "${YELLOW}⚠️  This will remove all containers, networks, and data volumes!${NC}"
        read -p "Are you sure? (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            echo -e "${YELLOW}Cancelled.${NC}"
            exit 0
        fi
        
        echo -e "${YELLOW}🧹 Cleaning up...${NC}"
        docker compose down -v
        echo -e "${GREEN}✓ Cleanup complete${NC}"
        exit 0
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete! 🎉${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Wait a bit for services to start
echo -e "${YELLOW}⏳ Waiting for services to start (10 seconds)...${NC}"
sleep 10

# Show service status
echo -e "${CYAN}📊 Service Status:${NC}"
docker compose ps
echo ""

echo -e "${CYAN}📍 Access Points:${NC}"
echo -e "${GREEN}  • API Gateway:        ${BLUE}http://localhost:8000${NC}"
echo -e "${GREEN}  • API Gateway Docs:   ${BLUE}http://localhost:8000/docs${NC}"
echo -e "${GREEN}  • Admin Service:      ${BLUE}http://localhost:8001${NC}"
echo -e "${GREEN}  • Admin Dashboard:    ${BLUE}http://localhost:3000${NC}"
echo -e "${GREEN}  • Grafana:            ${BLUE}http://localhost:3001${NC} (admin/admin)"
echo -e "${GREEN}  • Prometheus:         ${BLUE}http://localhost:9090${NC}"
echo ""

echo -e "${CYAN}🛠️  Useful Commands:${NC}"
echo -e "${YELLOW}  • View logs:          ${NC}docker compose logs -f"
echo -e "${YELLOW}  • View specific logs: ${NC}docker compose logs -f gateway-service"
echo -e "${YELLOW}  • Restart service:    ${NC}docker compose restart gateway-service"
echo -e "${YELLOW}  • Stop all:           ${NC}docker compose down"
echo -e "${YELLOW}  • Check status:       ${NC}docker compose ps"
echo ""

echo -e "${CYAN}📚 Documentation:${NC}"
echo -e "${YELLOW}  • README.md for general overview${NC}"
echo -e "${YELLOW}  • DOCKER_SETUP.md for Docker-specific setup${NC}"
echo -e "${YELLOW}  • API documentation at http://localhost:8000/docs${NC}"
echo ""

echo -e "${GREEN}✅ Stockify is ready to use!${NC}"
echo ""
