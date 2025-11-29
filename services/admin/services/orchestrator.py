"""
Orchestration Service

Handles service deployment, scaling, and updates using Docker Compose.
"""
import logging
import asyncio
from typing import Dict, List, Optional
from python_on_whales import DockerClient
from services.admin.services.docker_manager import docker_manager

logger = logging.getLogger("stockify.admin.orchestrator")


class Orchestrator:
    """Manage service orchestration"""
    
    def __init__(self):
        # We use python-on-whales for docker-compose support
        # Note: This requires docker-compose to be installed in the container
        # Since we are in a container, we might need to use the host's docker-compose via socket
        # But python-on-whales handles this if docker client is configured
        try:
            self.docker = DockerClient(compose_files=["/app/docker-compose.yml"])
            logger.info("Orchestrator initialized")
        except Exception as e:
            logger.error(f"Failed to initialize Orchestrator: {e}")
            self.docker = None
            
    def scale_service(self, service_name: str, replicas: int) -> bool:
        """Scale a service to N replicas"""
        if not self.docker:
            return False
            
        try:
            # Map friendly names to compose service names
            # Frontend sends: gateway, ingestion, etc.
            # Compose file uses: gateway-service, ingestion-service, etc.
            service_map = {
                "gateway": "gateway-service",
                "ingestion": "ingestion-service",
                "processor": "processor-service",
                "storage": "storage-service",
                "realtime": "realtime-service",
                "grpc-server": "grpc-server",
                "admin": "admin-service",
            }
            compose_service_name = service_map.get(service_name, service_name)
            
            self.docker.compose.up([compose_service_name], detach=True, scales={compose_service_name: replicas})
            logger.info(f"Scaled {service_name} ({compose_service_name}) to {replicas} replicas")
            return True
        except Exception as e:
            logger.error(f"Error scaling service {service_name}: {e}")
            return False
            
    def update_service(self, service_name: str, image_tag: str = "latest") -> bool:
        """Update a service to a specific image tag"""
        if not self.docker:
            return False
            
        try:
            # Map friendly names to compose service names
            service_map = {
                "gateway": "gateway-service",
                "ingestion": "ingestion-service",
                "processor": "processor-service",
                "storage": "storage-service",
                "realtime": "realtime-service",
                "grpc-server": "grpc-server",
                "admin": "admin-service",
            }
            compose_service_name = service_map.get(service_name, service_name)
            
            # Pull new image
            # In a real scenario, we'd update the docker-compose.yml or use overrides
            # For this MVP, we'll just pull and restart
            self.docker.compose.pull([compose_service_name])
            self.docker.compose.up([compose_service_name], detach=True, build=False)
            logger.info(f"Updated service {service_name} ({compose_service_name})")
            return True
        except Exception as e:
            logger.error(f"Error updating service {service_name}: {e}")
            return False
            
    def deploy_stack(self) -> bool:
        """Deploy the entire stack"""
        if not self.docker:
            return False
            
        try:
            self.docker.compose.up(detach=True)
            logger.info("Deployed stack")
            return True
        except Exception as e:
            logger.error(f"Error deploying stack: {e}")
            return False


# Singleton instance
orchestrator = Orchestrator()
