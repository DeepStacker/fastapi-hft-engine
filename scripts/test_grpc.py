import grpc
import sys
import os

# Add /app to path to allow imports from core
sys.path.append('/app')

from core.grpc_client import stockify_pb2
from core.grpc_client import stockify_pb2_grpc

def check_health():
    try:
        channel = grpc.insecure_channel('grpc-server:50051')
        stub = stockify_pb2_grpc.HealthServiceStub(channel)
        response = stub.Check(stockify_pb2.HealthCheckRequest(service="market_data"))
        if response.status == stockify_pb2.HealthCheckResponse.SERVING:
            print("✅ gRPC Server is HEALTHY and SERVING")
        else:
            print(f"❌ gRPC Server status: {response.status}")
    except Exception as e:
        print(f"❌ gRPC Health Check Failed: {e}")

if __name__ == "__main__":
    check_health()
