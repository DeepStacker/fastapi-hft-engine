"""
Docker Manager Service

Handles Docker container operations - list, restart, stop, start, logs, stats.
"""
import docker
from typing import List, Dict, Optional
import logging

logger = logging.getLogger("stockify.admin.docker")


class DockerManager:
    """Manage Docker containers and services"""
    
    def __init__(self):
        """Initialize Docker client"""
        try:
            self.client = docker.from_env()
            logger.info("Docker client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Docker client: {e}")
            self.client = None
    
    def list_containers(self, all: bool = True) -> List[Dict]:
        """List all Docker containers"""
        if not self.client:
            return []
        
        try:
            containers = self.client.containers.list(all=all)
            return [
                {
                    "id": c.id[:12],
                    "name": c.name,
                    "image": c.image.tags[0] if c.image.tags else c.image.id[:12],
                    "status": str(c.status),
                    "state": c.attrs['State'].get('Status', 'unknown'),
                    "started_at": c.attrs['State'].get('StartedAt'),
                    "restart_count": c.attrs.get('RestartCount', 0),
                    "created": c.attrs['Created'],
                    "ports": c.attrs['NetworkSettings']['Ports'],
                }
                for c in containers
            ]
        except Exception as e:
            logger.error(f"Error listing containers: {e}")
            return []
    
    def get_container(self, container_id: str):
        """Get a specific container"""
        if not self.client:
            return None
        
        try:
            return self.client.containers.get(container_id)
        except docker.errors.NotFound:
            logger.warning(f"Container {container_id} not found")
            return None
        except Exception as e:
            logger.error(f"Error getting container {container_id}: {e}")
            return None
    
    def restart_container(self, container_id: str) -> bool:
        """Restart a container"""
        container = self.get_container(container_id)
        if not container:
            return False
        
        try:
            container.restart()
            logger.info(f"Restarted container: {container.name}")
            return True
        except Exception as e:
            logger.error(f"Error restarting container {container_id}: {e}")
            return False
    
    def stop_container(self, container_id: str, timeout: int = 10) -> bool:
        """Stop a container"""
        container = self.get_container(container_id)
        if not container:
            return False
        
        try:
            container.stop(timeout=timeout)
            logger.info(f"Stopped container: {container.name}")
            return True
        except Exception as e:
            logger.error(f"Error stopping container {container_id}: {e}")
            return False
    
    def start_container(self, container_id: str) -> bool:
        """Start a container"""
        container = self.get_container(container_id)
        if not container:
            return False
        
        try:
            container.start()
            logger.info(f"Started container: {container.name}")
            return True
        except Exception as e:
            logger.error(f"Error starting container {container_id}: {e}")
            return False
    
    def get_container_logs(self, container_id: str, tail: int = 100, follow: bool = False):
        """Get container logs"""
        container = self.get_container(container_id)
        if not container:
            return None
        
        try:
            return container.logs(tail=tail, follow=follow, stream=follow)
        except Exception as e:
            logger.error(f"Error getting logs for container {container_id}: {e}")
            return None
    
    def get_container_stats(self, container_id: str) -> Optional[Dict]:
        """Get container resource stats (CPU, memory, network)"""
        container = self.get_container(container_id)
        if not container:
            return None
        
        try:
            stats = container.stats(stream=False)
            
            # Calculate CPU percentage
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                       stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                          stats['precpu_stats']['system_cpu_usage']
            cpu_percent = (cpu_delta / system_delta) * 100.0 if system_delta > 0 else 0.0
            
            # Memory stats
            memory_usage = stats['memory_stats'].get('usage', 0)
            memory_limit = stats['memory_stats'].get('limit', 1)
            memory_percent = (memory_usage / memory_limit) * 100.0 if memory_limit > 0 else 0.0
            
            # Network stats
            networks = stats.get('networks', {})
            rx_bytes = sum(net['rx_bytes'] for net in networks.values())
            tx_bytes = sum(net['tx_bytes'] for net in networks.values())
            
            return {
                "cpu_percent": round(cpu_percent, 2),
                "memory_usage": memory_usage,
                "memory_limit": memory_limit,
                "memory_percent": round(memory_percent, 2),
                "network_rx_bytes": rx_bytes,
                "network_tx_bytes": tx_bytes,
            }
        except Exception as e:
            logger.error(f"Error getting stats for container {container_id}: {e}")
            return None


# Singleton instance
docker_manager = DockerManager()
