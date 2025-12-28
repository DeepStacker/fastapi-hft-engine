"""
Performance Testing Script

Tests API response times and throughput for all services.
"""

import asyncio
import time
from httpx import AsyncClient
from datetime import datetime, timedelta
import statistics

# Service URLs
HISTORICAL_URL = "http://localhost:8002"
CALCULATIONS_URL = "http://localhost:8004"


class PerformanceTester:
    """Performance testing utilities"""
    
    def __init__(self):
        self.results = {}
    
    async def test_endpoint(self, client: AsyncClient, url: str, params: dict = None, method: str = "GET", json_data: dict = None, iterations: int = 100):
        """Test an endpoint multiple times and measure performance"""
        response_times = []
        
        for i in range(iterations):
            start = time.time()
            try:
                if method == "GET":
                    response = await client.get(url, params=params)
                else:
                    response = await client.post(url, json=json_data)
                
                elapsed = (time.time() - start) * 1000  # Convert to milliseconds
                if response.status_code == 200:
                    response_times.append(elapsed)
            except Exception as e:
                print(f"Error on iteration {i}: {e}")
        
        if response_times:
            return {
                "min": round(min(response_times), 2),
                "max": round(max(response_times), 2),
                "mean": round(statistics.mean(response_times), 2),
                "median": round(statistics.median(response_times), 2),
                "p95": round(statistics.quantiles(response_times, n=20)[18], 2),  # 95th percentile
                "p99": round(statistics.quantiles(response_times, n=100)[98], 2),  # 99th percentile
                "success_rate": round(len(response_times) / iterations * 100, 2),
                "total_requests": iterations
            }
        return None
    
    async def run_historical_service_tests(self):
        """Test Historical Service endpoints"""
        async with AsyncClient(base_url=HISTORICAL_URL, timeout=30.0) as client:
            print("\n=== Historical Service Performance Tests ===\n")
            
            # Test PCR Latest
            print("Testing PCR Latest...")
            result = await self.test_endpoint(
                client,
                "/pcr/latest",
                params={"symbol_id": 13, "expiry": "2025-12-05"},
                iterations=50
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["pcr_latest"] = result
            
            # Test Market Mood Latest
            print("Testing Market Mood Latest...")
            result = await self.test_endpoint(
                client,
                "/market-mood/latest",
                params={"symbol_id": 13, "expiry": "2025-12-05"},
                iterations=50
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["market_mood_latest"] = result
            
            # Test S/R Levels
            print("Testing S/R Levels...")
            result = await self.test_endpoint(
                client,
                "/sr/levels",
                params={"symbol_id": 13, "expiry": "2025-12-05"},
                iterations=50
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["sr_levels"] = result
            
            # Test Overall Latest
            print("Testing Overall Latest...")
            result = await self.test_endpoint(
                client,
                "/overall/latest",
                params={"symbol_id": 13},
                iterations=50
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["overall_latest"] = result
    
    async def run_calculations_service_tests(self):
        """Test Calculations Service endpoints"""
        async with AsyncClient(base_url=CALCULATIONS_URL, timeout=30.0) as client:
            print("\n=== Calculations Service Performance Tests ===\n")
            
            # Test Option Pricing
            print("Testing Option Pricing (Black-Scholes)...")
            payload = {
                "spot": 23450.0,
                "strike": 23500.0,
                "expiry_date": "2025-12-05",
                "risk_free_rate": 0.05,
                "volatility": 0.15,
                "option_type": "CE",
                "model": "black_scholes"
            }
            result = await self.test_endpoint(
                client,
                "/option-price",
                method="POST",
                json_data=payload,
                iterations=100
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["option_pricing_bs"] = result
            
            # Test IV Solver
            print("Testing IV Solver...")
            payload = {
                "spot": 23450.0,
                "strike": 23500.0,
                "expiry_date": "2025-12-05",
                "risk_free_rate": 0.05,
                "market_price": 150.0,
                "option_type": "CE"
            }
            result = await self.test_endpoint(
                client,
                "/implied-volatility",
                method="POST",
                json_data=payload,
                iterations=50
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["iv_solver"] = result
            
            # Test Greeks
            print("Testing Greeks Calculator...")
            payload = {
                "spot": 23450.0,
                "strike": 23500.0,
                "expiry_date": "2025-12-05",
                "risk_free_rate": 0.05,
                "volatility": 0.15,
                "option_type": "CE"
            }
            result = await self.test_endpoint(
                client,
                "/greeks",
                method="POST",
                json_data=payload,
                iterations=100
            )
            if result:
                print(f"  Mean: {result['mean']}ms | P95: {result['p95']}ms | P99: {result['p99']}ms")
                self.results["greeks"] = result
    
    def print_summary(self):
        """Print performance summary"""
        print("\n" + "=" * 60)
        print("PERFORMANCE TEST SUMMARY")
        print("=" * 60)
        
        print(f"\n{'Endpoint':<30} {'Mean':<10} {'P95':<10} {'P99':<10}")
        print("-" * 60)
        
        for endpoint, stats in self.results.items():
            print(f"{endpoint:<30} {stats['mean']:<10} {stats['p95']:<10} {stats['p99']:<10}")
        
        # Overall stats
        all_means = [s['mean'] for s in self.results.values()]
        all_p95s = [s['p95'] for s in self.results.values()]
        
        print("\n" + "=" * 60)
        print(f"Overall Average Response Time: {statistics.mean(all_means):.2f}ms")
        print(f"Overall P95: {statistics.mean(all_p95s):.2f}ms")
        print("=" * 60)
        
        # Check if targets are met
        print("\nPerformance Targets:")
        success = True
        if statistics.mean(all_means) > 500:
            print("  ❌ Mean response time > 500ms (Target: <500ms)")
            success = False
        else:
            print("  ✅ Mean response time < 500ms")
        
        if statistics.mean(all_p95s) > 1000:
            print("  ❌ P95 response time > 1000ms (Target: <1000ms)")
            success = False
        else:
            print("  ✅ P95 response time < 1000ms")
        
        return success


async def main():
    """Run all performance tests"""
    tester = PerformanceTester()
    
    print("\nStarting Performance Tests...")
    print("This will test all API endpoints with multiple requests.\n")
    
    await tester.run_historical_service_tests()
    await tester.run_calculations_service_tests()
    
    success = tester.print_summary()
    
    if success:
        print("\n✅ All performance targets met!")
        return 0
    else:
        print("\n⚠️  Some performance targets not met. Consider optimization.")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
