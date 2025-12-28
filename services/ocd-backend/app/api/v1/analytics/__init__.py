"""
Analytics Package Initialization

Split from monolithic analytics.py (~1235 lines) for maintainability:
- timeseries: Time-series data and spot price APIs
- analysis: Strike analysis, reversal levels, max pain, IV skew
- aggregate: Aggregate OI/COI views (LOC Calculator style)

All routers are prefixed with /analytics in the main router.py
"""
from fastapi import APIRouter
from app.api.v1.analytics.timeseries import router as timeseries_router
from app.api.v1.analytics.analysis import router as analysis_router
from app.api.v1.analytics.aggregate import router as aggregate_router

router = APIRouter()

# Include sub-routers
router.include_router(timeseries_router, tags=["Analytics - Timeseries"])
router.include_router(analysis_router, tags=["Analytics - Analysis"])
router.include_router(aggregate_router, tags=["Analytics - Aggregate"])

__all__ = ["router"]
