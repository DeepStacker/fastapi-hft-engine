"""
Real Metrics Collector Service

Collects actual system metrics from Docker,Prometheus, and other sources
to replace hardcoded values in admin dashboard.
"""
import asyncio
import logging
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import httpx

logger = logging.getLogger("stockify.admin.metrics")


class MetricsCollector:
    """Collects real metrics from various sources"""
    
    def __init__(self):
        from core.config.settings import get_settings
        self.settings = get_settings()
        self.prometheus_url = self.settings.PROMETHEUS_URL
        self._cache = {}
        self._cache_ttl = 5  # seconds
        
    async def get_service_cpu_memory(self, service_name: str) -> tuple[float, float]:
        """
        Get real CPU and memory usage for a service from Prometheus
        
        Returns: (cpu_percent, memory_mb)
        """
        cache_key = f"metrics_{service_name}"
        
        # Check cache
        if cache_key in self._cache:
            cached_time, cached_data = self._cache[cache_key]
            if (datetime.utcnow() - cached_time).total_seconds() < self._cache_ttl:
                return cached_data
        
        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                # Prepare queries
                cpu_query = f'rate(process_cpu_seconds_total{{job="{service_name}"}}[1m]) * 100'
                mem_query = f'process_resident_memory_bytes{{job="{service_name}"}} / 1024 / 1024'
                
                # Execute concurrently
                cpu_response, mem_response = await asyncio.gather(
                    client.get(f"{self.prometheus_url}/api/v1/query", params={"query": cpu_query}),
                    client.get(f"{self.prometheus_url}/api/v1/query", params={"query": mem_query}),
                    return_exceptions=True
                )
                
                cpu_percent = 0.0
                memory_mb = 0.0
                
                # Process CPU response
                if not isinstance(cpu_response, Exception) and cpu_response.status_code == 200:
                    cpu_data = cpu_response.json()
                    if cpu_data.get("data", {}).get("result"):
                        cpu_percent = float(cpu_data["data"]["result"][0]["value"][1])
                
                # Process Memory response
                if not isinstance(mem_response, Exception) and mem_response.status_code == 200:
                    mem_data = mem_response.json()
                    if mem_data.get("data", {}).get("result"):
                        memory_mb = float(mem_data["data"]["result"][0]["value"][1])
                
                result = (cpu_percent, memory_mb)
                self._cache[cache_key] = (datetime.utcnow(), result)
                return result
                
        except Exception as e:
            logger.warning(f"Failed to fetch metrics for {service_name}: {e}")
            return (0.0, 0.0)
    
    async def get_api_latency(self, endpoint: str) -> float:
        """
        Get average API latency for an endpoint from Prometheus
        
        Returns: avg_latency_ms
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                # Query p95 latency
                query = f'histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{{endpoint="{endpoint}"}}[5m])) * 1000'
                response = await client.get(
                    f"{self.prometheus_url}/api/v1/query",
                    params={"query": query}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("data", {}).get("result"):
                        return float(data["data"]["result"][0]["value"][1])
                
                return 0.0
                
        except Exception as e:
            logger.warning(f"Failed to fetch latency for {endpoint}: {e}")
            return 0.0
    
    async def get_request_count(self, endpoint: str, time_range: str = "1h") -> int:
        """
        Get total request count for an endpoint
        
        Returns: total_requests
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                query = f'sum(increase(http_requests_total{{endpoint="{endpoint}"}}[{time_range}]))'
                response = await client.get(
                    f"{self.prometheus_url}/api/v1/query",
                    params={"query": query}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("data", {}).get("result"):
                        return int(float(data["data"]["result"][0]["value"][1]))
                
                return 0
                
        except Exception as e:
            logger.warning(f"Failed to fetch request count for {endpoint}: {e}")
            return 0
    
    async def get_error_rate(self, endpoint: str) -> float:
        """
        Get error rate for an endpoint
        
        Returns: error_rate (0.0-1.0)
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                query = f'rate(http_requests_total{{endpoint="{endpoint}",status=~"5.."}}[5m]) / rate(http_requests_total{{endpoint="{endpoint}"}}[5m])'
                response = await client.get(
                    f"{self.prometheus_url}/api/v1/query",
                    params={"query": query}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("data", {}).get("result"):
                        return float(data["data"]["result"][0]["value"][1])
                
                return 0.0
                
        except Exception as e:
            logger.warning(f"Failed to fetch error rate for {endpoint}: {e}")
            return 0.0
    
    async def get_kafka_lag(self, consumer_group: str, topic: str) -> int:
        """
        Get Kafka consumer lag
        
        Note: Requires Kafka JMX exporter or similar
        Returns: total_lag
        """
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                query = f'kafka_consumergroup_lag{{consumergroup="{consumer_group}",topic="{topic}"}}'
                response = await client.get(
                    f"{self.prometheus_url}/api/v1/query",
                    params={"query": query}
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("data", {}).get("result"):
                        total_lag = sum(
                            float(result["value"][1])
                            for result in data["data"]["result"]
                        )
                        return int(total_lag)
                
                return 0
                
        except Exception as e:
            logger.warning(f"Failed to fetch Kafka lag: {e}")
            return 0


# Global instance
metrics_collector = MetricsCollector()
