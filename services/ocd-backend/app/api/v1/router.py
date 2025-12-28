"""
API v1 Router - Aggregates all API endpoints
"""
from fastapi import APIRouter

from app.api.v1 import auth, users, options, admin, health, charts, monitoring, historical, screeners, calculators, notifications, profile, sse
from app.api.v1.analytics import router as analytics_router  # Use split analytics package

api_router = APIRouter()


# Include all route modules
api_router.include_router(
    health.router,
    tags=["Health"]
)

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"]
)

api_router.include_router(
    users.router,
    prefix="/users",
    tags=["Users"]
)

api_router.include_router(
    options.router,
    prefix="/options",
    tags=["Options"]
)

api_router.include_router(
    analytics_router,
    prefix="/analytics",
    tags=["Analytics"]
)

api_router.include_router(
    historical.router,
    prefix="/historical",
    tags=["Historical"]
)

api_router.include_router(
    admin.router,
    prefix="/admin",
    tags=["Admin"]
)

api_router.include_router(
    monitoring.router,
    # Note: monitoring.router already has prefix="/admin/monitoring" defined
    tags=["Monitoring"]
)

api_router.include_router(
    charts.router,
    prefix="/charts",
    tags=["Charts"]
)

api_router.include_router(
    screeners.router,
    prefix="/screeners",
    tags=["Screeners"]
)

api_router.include_router(
    calculators.router,
    prefix="/calculators",
    tags=["Calculators"]
)

api_router.include_router(
    notifications.router,
    prefix="/notifications",
    tags=["Notifications"]
)

api_router.include_router(
    profile.router,
    prefix="/profile",
    tags=["Profile"]
)

# SSE fallback for WebSocket alternatives
api_router.include_router(
    sse.router,
    prefix="/sse",
    tags=["SSE Fallback"]
)

