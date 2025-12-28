from locust import HttpUser, task, between, constant
import json

class StockifyUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login to get token"""
        # Assume admin credentials for test, or user credentials
        # We'll try to hit public endpoints or login as admin
        self.client.timeout = 10
        try:
            response = self.client.post("/api/admin/auth/login", data={"username": "admin", "password": "admin"})
            if response.status_code == 200:
                self.token = response.json()["access_token"]
                self.headers = {"Authorization": f"Bearer {self.token}"}
            else:
                self.token = None
                print("Login Failed")
        except Exception as e:
            print(f"Login Error: {e}")
            self.token = None

    @task(3)
    def index(self):
        self.client.get("/health")

    @task(1)
    def get_traders(self):
        if hasattr(self, 'token') and self.token:
            self.client.get("/api/admin/traders", headers=self.headers)
            
    @task(2)
    def view_market_data(self):
        # Hit OCD backend via Gateway
        # Assuming /api/v1/health or similar exists
        self.client.get("/api/v1/health")

class WebSocketUser(HttpUser):
    # Specialized for WS if using locust-plugins, but here we keep it simple HTTP
    pass
