"""
Performance Benchmarking Tool

Run performance benchmarks and store results.
"""
import asyncio
import time
from datetime import datetime
from typing import Dict, List
import httpx
import statistics

from core.database.db import async_session_factory
from core.database.admin_models import PerformanceBenchmarkDB


class PerformanceBenchmarker:
    """Run performance benchmarks against the API"""
    
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
    
    async def run_benchmark(
        self,
        endpoint: str,
        num_requests: int = 1000,
        concurrency: int = 10,
        name: str = None
    ) -> Dict:
        """Run a performance benchmark"""
        
        print(f"Running benchmark: {endpoint}")
        print(f"Requests: {num_requests}, Concurrency: {concurrency}")
        
        start_time = time.time()
        
        # Get system state before
        import psutil
        cpu_before = psutil.cpu_percent(interval=0.1)
        memory_before = psutil.virtual_memory().percent
        
        # Run concurrent requests
        latencies = []
        errors = 0
        
        async with httpx.AsyncClient() as client:
            semaphore = asyncio.Semaphore(concurrency)
            
            async def make_request():
                nonlocal errors
                async with semaphore:
                    req_start = time.time()
                    try:
                        response = await client.get(f"{self.base_url}{endpoint}")
                        req_time = (time.time() - req_start) * 1000  # ms
                        latencies.append(req_time)
                        
                        if response.status_code >= 400:
                            errors += 1
                    except Exception:
                        errors += 1
                        latencies.append(0)
            
            tasks = [make_request() for _ in range(num_requests)]
            await asyncio.gather(*tasks)
        
        duration = time.time() - start_time
        
        # Calculate metrics
        latencies.sort()
        successful_requests = num_requests - errors
        
        results = {
            "benchmark_name": name or f"Benchmark {endpoint}",
            "endpoint": endpoint,
            "requests_per_second": successful_requests / duration,
            "avg_latency_ms": statistics.mean(latencies) if latencies else 0,
            "p50_latency_ms": self.percentile(latencies, 50),
            "p95_latency_ms": self.percentile(latencies, 95),
            "p99_latency_ms": self.percentile(latencies, 99),
            "error_count": errors,
            "total_requests": num_requests,
            "cpu_percent": cpu_before,  # Would track during test
            "memory_percent": memory_before,
            "duration_seconds": int(duration)
        }
        
        # Save to database
        await self.save_benchmark(results)
        
        # Print results
        print("\n=== Benchmark Results ===")
        print(f"Requests/sec: {results['requests_per_second']:.2f}")
        print(f"Avg latency: {results['avg_latency_ms']:.2f}ms")
        print(f"P95 latency: {results['p95_latency_ms']:.2f}ms")
        print(f"P99 latency: {results['p99_latency_ms']:.2f}ms")
        print(f"Errors: {errors}/{num_requests}")
        print("========================\n")
        
        return results
    
    def percentile(self, data: List[float], percentile: int) -> float:
        """Calculate percentile"""
        if not data:
            return 0
        size = len(data)
        return data[int(size * percentile / 100)]
    
    async def save_benchmark(self, results: Dict):
        """Save benchmark results to database"""
        async with async_session_factory() as session:
            benchmark = PerformanceBenchmarkDB(**results)
            session.add(benchmark)
            await session.commit()
    
    async def run_standard_suite(self):
        """Run standard benchmark suite"""
        endpoints = [
            ("/health", 500, 5),
            ("/snapshot/13", 1000, 10),
            ("/stats", 500, 10),
        ]
        
        results = []
        for endpoint, num_req, concurrency in endpoints:
            result = await self.run_benchmark(endpoint, num_req, concurrency)
            results.append(result)
            await asyncio.sleep(2)  # Cool down between tests
        
        return results


# Convenience function
async def run_quick_benchmark():
    """Run a quick benchmark"""
    benchmarker = PerformanceBenchmarker()
    return await benchmarker.run_benchmark("/health", num_requests=100, concurrency=10)
