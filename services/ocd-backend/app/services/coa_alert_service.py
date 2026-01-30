"""
COA Alert Service

Handles scenario change detection and alert dispatching for COA subscriptions.
"""
import logging
from typing import Optional, List
from datetime import datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)


class COAAlertService:
    """
    COA Alert Service
    
    Detects scenario changes and sends alerts to subscribed users.
    """
    
    def __init__(self, db: AsyncSession, redis=None):
        self.db = db
        self.redis = redis
        self._cache_prefix = "coa:last_scenario:"
    
    async def check_and_alert(
        self,
        symbol_id: int,
        symbol: str,
        new_scenario: dict,
        spot_price: float,
        eos: Optional[float] = None,
        eor: Optional[float] = None,
    ) -> int:
        """
        Check if scenario changed and alert subscribed users.
        
        Returns number of alerts sent.
        """
        from core.database.models import COAAlertSubscriptionDB, AppUserDB, InstrumentDB
        
        try:
            new_scenario_id = new_scenario.get('id', '?')
            new_scenario_name = new_scenario.get('name', 'Unknown')
            new_bias = new_scenario.get('bias', 'unknown')
            
            # Get last known scenario from Redis cache (faster) or subscriptions
            last_scenario_id = await self._get_cached_scenario(symbol_id)
            
            # Get all enabled subscriptions for this symbol
            query = select(COAAlertSubscriptionDB).where(
                COAAlertSubscriptionDB.symbol_id == symbol_id,
                COAAlertSubscriptionDB.enabled == True
            ).options(selectinload(COAAlertSubscriptionDB.user))
            
            result = await self.db.execute(query)
            subscriptions = result.scalars().all()
            
            if not subscriptions:
                # No subscribers, just cache the scenario
                await self._cache_scenario(symbol_id, new_scenario_id)
                return 0
            
            alerts_sent = 0
            
            for sub in subscriptions:
                should_alert = False
                alert_reason = ""
                
                # Check scenario change
                if sub.alert_on_scenario_change and last_scenario_id:
                    if new_scenario_id != last_scenario_id:
                        should_alert = True
                        alert_reason = f"Scenario changed: {last_scenario_id} → {new_scenario_id}"
                
                # Check EOS/EOR breach
                if sub.alert_on_eos_eor_breach and eos and eor:
                    if spot_price <= eos:
                        should_alert = True
                        alert_reason = f"Spot {spot_price:.0f} breached EOS {eos:.0f}"
                    elif spot_price >= eor:
                        should_alert = True
                        alert_reason = f"Spot {spot_price:.0f} breached EOR {eor:.0f}"
                
                if should_alert:
                    await self._send_alert(
                        user=sub.user,
                        symbol=symbol,
                        scenario_id=new_scenario_id,
                        scenario_name=new_scenario_name,
                        bias=new_bias,
                        reason=alert_reason,
                        spot_price=spot_price,
                        eos=eos,
                        eor=eor,
                        subscription=sub,
                    )
                    
                    # Update subscription tracking
                    await self.db.execute(
                        update(COAAlertSubscriptionDB)
                        .where(COAAlertSubscriptionDB.id == sub.id)
                        .values(
                            last_scenario=new_scenario_id,
                            last_alert_at=datetime.utcnow()
                        )
                    )
                    
                    alerts_sent += 1
            
            # Cache new scenario
            await self._cache_scenario(symbol_id, new_scenario_id)
            
            if alerts_sent > 0:
                await self.db.commit()
                logger.info(f"Sent {alerts_sent} COA alerts for {symbol}")
            
            return alerts_sent
            
        except Exception as e:
            logger.error(f"COA alert check failed: {e}", exc_info=True)
            return 0
    
    async def _get_cached_scenario(self, symbol_id: int) -> Optional[str]:
        """Get last scenario from Redis cache"""
        if self.redis:
            try:
                cached = await self.redis.get(f"{self._cache_prefix}{symbol_id}")
                return cached.decode() if cached else None
            except Exception:
                pass
        return None
    
    async def _cache_scenario(self, symbol_id: int, scenario_id: str):
        """Cache scenario in Redis"""
        if self.redis:
            try:
                await self.redis.set(
                    f"{self._cache_prefix}{symbol_id}",
                    scenario_id,
                    ex=3600  # 1 hour TTL
                )
            except Exception:
                pass
    
    async def _send_alert(
        self,
        user,
        symbol: str,
        scenario_id: str,
        scenario_name: str,
        bias: str,
        reason: str,
        spot_price: float,
        eos: Optional[float],
        eor: Optional[float],
        subscription,
    ):
        """Send alert notification to user"""
        from app.models.notification import Notification, NotificationPriority, NotificationPurpose
        
        try:
            # Build notification message
            title = f"🎯 {symbol} COA Alert"
            message = f"{reason}\n\nScenario: {scenario_id} - {scenario_name}\nBias: {bias.upper()}\nSpot: {spot_price:.0f}"
            if eos:
                message += f"\nEOS: {eos:.0f}"
            if eor:
                message += f"\nEOR: {eor:.0f}"
            
            # Create in-app notification
            if subscription.notify_in_app:
                notification = Notification(
                    user_id=user.id,
                    title=title,
                    message=message,
                    type="trade",
                    purpose=NotificationPurpose.TRANSACTIONAL.value,
                    priority=NotificationPriority.HIGH.value,
                    sound_enabled=True,
                    extra_data={
                        "symbol": symbol,
                        "scenario_id": scenario_id,
                        "scenario_name": scenario_name,
                        "bias": bias,
                        "spot_price": spot_price,
                        "eos": eos,
                        "eor": eor,
                    }
                )
                self.db.add(notification)
            
            logger.debug(f"COA alert sent to {user.email}: {reason}")
            
        except Exception as e:
            logger.error(f"Failed to send COA alert: {e}")


async def get_coa_alert_service(
    db: AsyncSession,
    redis=None,
) -> COAAlertService:
    """Dependency injection for COA alert service"""
    return COAAlertService(db=db, redis=redis)
