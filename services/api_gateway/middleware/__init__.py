"""API Gateway middleware package"""

from services.api_gateway.middleware.auth import verify_api_key

__all__ = ['verify_api_key']
