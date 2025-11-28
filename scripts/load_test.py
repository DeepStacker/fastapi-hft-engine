"""
Load Testing Suite for Stockify System

Tests API performance, WebSocket capacity, and concurrent throughput.
"""
from locust import HttpUser, task, between, events
import random
import json
import msgpack
from websocket import create_connection
import time

class StockifyAPIUser(HttpUser):
    """Simulates API user behavior"""
    wait_time = between(0.1, 0.5)  # 100-500ms between requests
    
    def on_start(self):
        """Login and get token"""
        response = self.client.post("/token", data={
            "username": "testuser",
            "password": "testpass123"
        })
        if response.status_code == 200:
            self.token = response.json()["access_token"]
        else:
            self.token = None
    
    @task(10)
    def get_snapshot(self):
        """Test snapshot endpoint (hot path)"""
        symbol_id = random.choice([13, 25, 27, 442])
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        
        with self.client.get(
            f"/snapshot/{symbol_id}",
            headers=headers,
            catch_response=True
        ) as response:
            if response.status_code == 200:
                response.success()
            elif response.status_code == 404:
                response.failure("Symbol not found")
            else:
                response.failure(f"Unexpected status: {response.status_code}")
    
    @task(5)
    def get_historical(self):
        """Test historical data endpoint"""
        symbol_id = random.choice([13, 25, 27, 442])
        limit = random.choice([10, 50, 100])
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        
        self.client.get(
            f"/historical/{symbol_id}?limit={limit}",
            headers=headers,
            name="/historical/[symbol_id]"
        )
    
    @task(3)
    def get_options(self):
        """Test options endpoint"""
        symbol_id = random.choice([13, 25, 27, 442])
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        
        self.client.get(
            f"/options/{symbol_id}?limit=50",
            headers=headers,
            name="/options/[symbol_id]"
        )
    
    @task(2)
    def get_stats(self):
        """Test stats endpoint"""
        headers = {"Authorization": f"Bearer {self.token}"} if self.token else {}
        
        self.client.get(
            "/stats",
            headers=headers
        )
    
    @task(1)
    def health_check(self):
        """Test health endpoint"""
        self.client.get("/health")


class StockifyWebSocketUser(HttpUser):
    """Simulates WebSocket connections"""
    wait_time = between(1, 3)
    
    def on_start(self):
        """Establish WebSocket connection"""
        # Get auth token first
        response = self.client.post("/token", data={
            "username": "testuser",
            "password": "testpass123"
        })
        
        if response.status_code == 200:
            token = response.json()["access_token"]
            symbol_id = random.choice([13, 25, 27, 442])
            
            try:
                ws_url = f"ws://localhost:8000/ws/{symbol_id}?token={token}"
                self.ws = create_connection(ws_url)
                self.connected = True
            except Exception as e:
                print(f"WebSocket connection failed: {e}")
                self.connected = False
        else:
            self.connected = False
    
    @task
    def receive_messages(self):
        """Receive and measure WebSocket messages"""
        if not self.connected:
            return
        
        try:
            start_time = time.time()
            message = self.ws.recv()
            latency = (time.time() - start_time) * 1000
            
            # Record custom metric
            events.request.fire(
                request_type="WebSocket",
                name="receive_message",
                response_time=latency,
                response_length=len(message),
                exception=None,
                context={}
            )
        except Exception as e:
            events.request.fire(
                request_type="WebSocket",
                name="receive_message",
                response_time=0,
                response_length=0,
                exception=e,
                context={}
            )
    
    def on_stop(self):
        """Close WebSocket connection"""
        if hasattr(self, 'ws') and self.ws:
            self.ws.close()


# Test scenarios
class HighLoadScenario(HttpUser):
    """Simulates high concurrent load"""
    wait_time = between(0.01, 0.1)  # Very short wait
    tasks = [StockifyAPIUser]


class SteadyStateScenario(HttpUser):
    """Simulates steady production load"""
    wait_time = between(0.5, 2.0)  # Normal wait
    tasks = [StockifyAPIUser]


# Custom events for detailed metrics
@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    print("Load test starting...")
    print(f"Target: {environment.host}")
    print(f"Users: {environment.runner.target_user_count if hasattr(environment.runner, 'target_user_count') else 'N/A'}")


@events.test_stop.add_listener  
def on_test_stop(environment, **kwargs):
    print("\nLoad test completed!")
    print("\nFinal Statistics:")
    stats = environment.stats
    print(f"Total requests: {stats.total.num_requests}")
    print(f"Total failures: {stats.total.num_failures}")
    print(f"Median response time: {stats.total.median_response_time}ms")
    print(f"95th percentile: {stats.total.get_response_time_percentile(0.95)}ms")
    print(f"99th percentile: {stats.total.get_response_time_percentile(0.99)}ms")
    print(f"Requests per second: {stats.total.total_rps:.2f}")


if __name__ == "__main__":
    import os
    import subprocess
    
    print("=" * 60)
    print("Stockify Load Testing Suite")
    print("=" * 60)
    print("\nAvailable test scenarios:")
    print("1. Quick smoke test (10 users, 30 seconds)")
    print("2. Standard load test (100 users, 5 minutes)")
    print("3. Stress test (1000 users, 10 minutes)")
    print("4. WebSocket capacity test (10K connections)")
    print("5. Endurance test (100 users, 1 hour)")
    
    choice = input("\nSelect scenario (1-5): ")
    
    scenarios = {
        "1": ["locust", "-f", __file__, "--headless", "-u", "10", "-r", "2", "-t", "30s", "--host=http://localhost:8000"],
        "2": ["locust", "-f", __file__, "--headless", "-u", "100", "-r", "10", "-t", "5m", "--host=http://localhost:8000"],
        "3": ["locust", "-f", __file__, "--headless", "-u", "1000", "-r", "100", "-t", "10m", "--host=http://localhost:8000"],
        "4": ["locust", "-f", __file__, "--headless", "-u", "10000", "-r", "500", "-t", "5m", "--host=http://localhost:8000", "--user-classes=StockifyWebSocketUser"],
        "5": ["locust", "-f", __file__, "--headless", "-u", "100", "-r", "10", "-t", "1h", "--host=http://localhost:8000"],
    }
    
    if choice in scenarios:
        print(f"\nRunning scenario {choice}...")
        subprocess.run(scenarios[choice])
    else:
        print("Invalid choice!")
