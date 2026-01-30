"""
COA Alert Subscription API Endpoints

Manages user subscriptions for COA scenario change alerts.
"""
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel
from uuid import UUID

from app.config.database import get_db
from app.core.dependencies import get_current_user, CurrentUser

logger = logging.getLogger(__name__)
router = APIRouter()


# ============== Request/Response Models ==============

class AlertSubscriptionCreate(BaseModel):
    """Create alert subscription"""
    alert_on_scenario_change: bool = True
    alert_on_strength_change: bool = False
    alert_on_eos_eor_breach: bool = False
    notify_in_app: bool = True
    notify_push: bool = True
    notify_email: bool = False


class AlertSubscriptionUpdate(BaseModel):
    """Update alert subscription"""
    enabled: Optional[bool] = None
    alert_on_scenario_change: Optional[bool] = None
    alert_on_strength_change: Optional[bool] = None
    alert_on_eos_eor_breach: Optional[bool] = None
    notify_in_app: Optional[bool] = None
    notify_push: Optional[bool] = None
    notify_email: Optional[bool] = None


class AlertSubscriptionResponse(BaseModel):
    """Subscription response"""
    id: int
    symbol: str
    symbol_id: int
    enabled: bool
    alert_on_scenario_change: bool
    alert_on_strength_change: bool
    alert_on_eos_eor_breach: bool
    notify_in_app: bool
    notify_push: bool
    notify_email: bool
    last_scenario: Optional[str] = None
    last_alert_at: Optional[str] = None


# ============== Endpoints ==============

@router.post("/{symbol}/coa/alerts/subscribe")
async def subscribe_to_coa_alerts(
    symbol: str,
    subscription: AlertSubscriptionCreate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Subscribe to COA alerts for a symbol.
    
    Creates or updates an alert subscription for the authenticated user.
    """
    from core.database.models import COAAlertSubscriptionDB, InstrumentDB
    
    try:
        # Get symbol ID
        symbol_query = select(InstrumentDB.symbol_id).where(InstrumentDB.symbol == symbol.upper()).limit(1)
        result = await db.execute(symbol_query)
        symbol_id = result.scalar_one_or_none()
        
        if not symbol_id:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        
        # Check if subscription exists
        existing_query = select(COAAlertSubscriptionDB).where(
            COAAlertSubscriptionDB.user_id == current_user.id,
            COAAlertSubscriptionDB.symbol_id == symbol_id
        )
        result = await db.execute(existing_query)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update existing subscription
            existing.enabled = True
            existing.alert_on_scenario_change = subscription.alert_on_scenario_change
            existing.alert_on_strength_change = subscription.alert_on_strength_change
            existing.alert_on_eos_eor_breach = subscription.alert_on_eos_eor_breach
            existing.notify_in_app = subscription.notify_in_app
            existing.notify_push = subscription.notify_push
            existing.notify_email = subscription.notify_email
            sub = existing
        else:
            # Create new subscription
            sub = COAAlertSubscriptionDB(
                user_id=current_user.id,
                symbol_id=symbol_id,
                enabled=True,
                alert_on_scenario_change=subscription.alert_on_scenario_change,
                alert_on_strength_change=subscription.alert_on_strength_change,
                alert_on_eos_eor_breach=subscription.alert_on_eos_eor_breach,
                notify_in_app=subscription.notify_in_app,
                notify_push=subscription.notify_push,
                notify_email=subscription.notify_email,
            )
            db.add(sub)
        
        await db.commit()
        await db.refresh(sub)
        
        return {
            "success": True,
            "message": f"Subscribed to COA alerts for {symbol.upper()}",
            "subscription": {
                "id": sub.id,
                "symbol": symbol.upper(),
                "symbol_id": symbol_id,
                "enabled": sub.enabled,
                "alert_on_scenario_change": sub.alert_on_scenario_change,
                "alert_on_strength_change": sub.alert_on_strength_change,
                "alert_on_eos_eor_breach": sub.alert_on_eos_eor_breach,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Subscribe to COA alerts failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{symbol}/coa/alerts/unsubscribe")
async def unsubscribe_from_coa_alerts(
    symbol: str,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Unsubscribe from COA alerts for a symbol.
    """
    from core.database.models import COAAlertSubscriptionDB, InstrumentDB
    
    try:
        # Get symbol ID
        symbol_query = select(InstrumentDB.symbol_id).where(InstrumentDB.symbol == symbol.upper()).limit(1)
        result = await db.execute(symbol_query)
        symbol_id = result.scalar_one_or_none()
        
        if not symbol_id:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        
        # Delete subscription
        delete_query = delete(COAAlertSubscriptionDB).where(
            COAAlertSubscriptionDB.user_id == current_user.id,
            COAAlertSubscriptionDB.symbol_id == symbol_id
        )
        result = await db.execute(delete_query)
        await db.commit()
        
        if result.rowcount == 0:
            return {
                "success": True,
                "message": f"No subscription found for {symbol.upper()}"
            }
        
        return {
            "success": True,
            "message": f"Unsubscribed from COA alerts for {symbol.upper()}"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unsubscribe from COA alerts failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/coa/alerts/subscriptions")
async def get_coa_subscriptions(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get all COA alert subscriptions for the current user.
    """
    from core.database.models import COAAlertSubscriptionDB, InstrumentDB
    from sqlalchemy.orm import selectinload
    
    try:
        query = select(COAAlertSubscriptionDB).where(
            COAAlertSubscriptionDB.user_id == current_user.id
        ).options(selectinload(COAAlertSubscriptionDB.instrument))
        
        result = await db.execute(query)
        subscriptions = result.scalars().all()
        
        return {
            "success": True,
            "count": len(subscriptions),
            "subscriptions": [
                {
                    "id": sub.id,
                    "symbol": sub.instrument.symbol if sub.instrument else "Unknown",
                    "symbol_id": sub.symbol_id,
                    "enabled": sub.enabled,
                    "alert_on_scenario_change": sub.alert_on_scenario_change,
                    "alert_on_strength_change": sub.alert_on_strength_change,
                    "alert_on_eos_eor_breach": sub.alert_on_eos_eor_breach,
                    "notify_in_app": sub.notify_in_app,
                    "notify_push": sub.notify_push,
                    "notify_email": sub.notify_email,
                    "last_scenario": sub.last_scenario,
                    "last_alert_at": sub.last_alert_at.isoformat() if sub.last_alert_at else None,
                }
                for sub in subscriptions
            ]
        }
        
    except Exception as e:
        logger.error(f"Get COA subscriptions failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{symbol}/coa/alerts")
async def update_coa_subscription(
    symbol: str,
    update: AlertSubscriptionUpdate,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update COA alert subscription settings.
    """
    from core.database.models import COAAlertSubscriptionDB, InstrumentDB
    
    try:
        # Get symbol ID
        symbol_query = select(InstrumentDB.symbol_id).where(InstrumentDB.symbol == symbol.upper()).limit(1)
        result = await db.execute(symbol_query)
        symbol_id = result.scalar_one_or_none()
        
        if not symbol_id:
            raise HTTPException(status_code=404, detail=f"Symbol {symbol} not found")
        
        # Get subscription
        sub_query = select(COAAlertSubscriptionDB).where(
            COAAlertSubscriptionDB.user_id == current_user.id,
            COAAlertSubscriptionDB.symbol_id == symbol_id
        )
        result = await db.execute(sub_query)
        sub = result.scalar_one_or_none()
        
        if not sub:
            raise HTTPException(status_code=404, detail=f"No subscription found for {symbol}")
        
        # Update fields
        update_data = update.dict(exclude_unset=True)
        for key, value in update_data.items():
            if value is not None:
                setattr(sub, key, value)
        
        await db.commit()
        await db.refresh(sub)
        
        return {
            "success": True,
            "message": f"Updated COA alert subscription for {symbol.upper()}",
            "subscription": {
                "id": sub.id,
                "symbol": symbol.upper(),
                "enabled": sub.enabled,
                "alert_on_scenario_change": sub.alert_on_scenario_change,
                "alert_on_strength_change": sub.alert_on_strength_change,
                "alert_on_eos_eor_breach": sub.alert_on_eos_eor_breach,
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Update COA subscription failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
