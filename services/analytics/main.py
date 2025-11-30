"""
Analytics Service - Post-Storage Stateful Analysis

Processes enriched option chain data with historical context to compute:
- Cumulative metrics (OI changes since market open)
- Velocity indicators (rate of change)
- Support/Resistance zones
- Pattern detection
- Cross-symbol analysis
"""

import asyncio
import structlog
from typing import Dict, List, Optional
from datetime import datetime, timedelta

from aiokafka import AIOKafkaConsumer
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis

from core.config.settings import settings
from core.logging.logger import configure_logger, get_logger
from services.analytics.analyzers.cumulative_oi import CumulativeOIAnalyzer
from services.analytics.analyzers.velocity import VelocityAnalyzer
from services.analytics.analyzers.zones import SupportResistanceAnalyzer
from services.analytics.analyzers.patterns import PatternDetector

configure_logger()
logger = get_logger("analytics-service")


class AnalyticsService:
    """
    Post-storage stateful analysis engine.
    
    Consumes enriched data from Kafka, queries historical context from
    TimescaleDB, computes stateful metrics, and publishes results.
    """
    
    def __init__(self):
        """Initialize analytics service components"""
        self.consumer: Optional[AIOKafkaConsumer] = None
        self.db_engine = None
        self.db_session = None
        self.redis_client: Optional[redis.Redis] = None
        
        # Initialize analyzers
        self.cumulative_oi_analyzer = CumulativeOIAnalyzer()
        self.velocity_analyzer = VelocityAnalyzer()
        self.zones_analyzer = SupportResistanceAnalyzer()
        self.pattern_detector = PatternDetector()
        
        # Service state
        self.running = False
        self.messages_processed = 0
        
        logger.info("Analytics Service initialized with 4 analyzers")
    
    async def initialize(self):
        """Initialize all components"""
        try:
            # Initialize database connection
            self.db_engine = create_async_engine(
                settings.DATABASE_URL,
                pool_size=10,
                max_overflow=20,
                echo=False
            )
            
            async_session = sessionmaker(
                self.db_engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            self.db_session = async_session
            
            logger.info("Database engine initialized")
            
            # Initialize Redis client
            self.redis_client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            
            logger.info("Redis client initialized")
            
            # Initialize Kafka consumer
            self.consumer = AIOKafkaConsumer(
                'market.enriched',  # Topic with enriched data from processor
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id='analytics-service',
                auto_offset_reset='latest',
                enable_auto_commit=True,
                value_deserializer=lambda m: m.decode('utf-8') if m else None
            )
            
            await self.consumer.start()
            logger.info("Kafka consumer initialized for topic: market.enriched")
            
            logger.info("Analytics Service initialization complete")
            
        except Exception as e:
            logger.error(f"Initialization failed: {e}", exc_info=True)
            raise
    
    async def start(self):
        """Start the analytics service"""
        self.running = True
        logger.info("Analytics Service starting...")
        
        try:
            async for msg in self.consumer:
                if not self.running:
                    break
                
                try:
                    await self.process_message(msg.value)
                    self.messages_processed += 1
                    
                    if self.messages_processed % 100 == 0:
                        logger.info(f"Processed {self.messages_processed} enriched messages")
                        
                except Exception as e:
                    logger.error(f"Error processing message: {e}", exc_info=True)
                    continue
                    
        except Exception as e:
            logger.error(f"Service error: {e}", exc_info=True)
        finally:
            await self.shutdown()
    
    async def process_message(self, data: str):
        """
        Process enriched option chain data with historical context.
        
        Args:
            data: JSON string with enriched option chain
        """
        import json
        
        try:
            enriched_data = json.loads(data)
            
            symbol_id = enriched_data.get('symbol_id')
            expiry = enriched_data.get('expiry')
            timestamp = enriched_data.get('timestamp')
            
            if not all([symbol_id, expiry, timestamp]):
                logger.warning("Missing required fields in enriched data")
                return
            
            # 1. Fetch historical context (last 1 hour)
            historical_context = await self.fetch_historical_context(
                symbol_id=symbol_id,
                expiry=expiry,
                lookback_minutes=60
            )
            
            # Run all analyzers in parallel
            results = await asyncio.gather(
                self.cumulative_oi_analyzer.analyze(enriched_data, historical_context),
                self.velocity_analyzer.analyze(enriched_data, historical_context),
                self.zones_analyzer.analyze(enriched_data, historical_context),
                self.pattern_detector.analyze(enriched_data, historical_context),
                return_exceptions=True
            )
            
            # Unpack results
            cumulative_oi_result = results[0] if not isinstance(results[0], Exception) else None
            velocity_result = results[1] if not isinstance(results[1], Exception) else None
            zones_result = results[2] if not isinstance(results[2], Exception) else None
            patterns_result = results[3] if not isinstance(results[3], Exception) else None
            
            # 3. Publish realtime updates to Redis
            await self.publish_realtime({
                'symbol_id': symbol_id,
                'expiry': expiry,
                'timestamp': timestamp,
                'analytics': {
                    'cumulative_oi': cumulative_oi_result,
                    'velocity': velocity_result,
                    'zones': zones_result,
                    'patterns': patterns_result
                }
            })
            
            # 4. Store computed metrics in database
            # Create analytics payload
            analytics_payload = {
                'symbol_id': symbol_id,
                'expiry': expiry,
                'timestamp': timestamp,
                'cumulative_oi': cumulative_oi_result,
                'velocity': velocity_result,
                'zones': zones_result,
                'patterns': patterns_result
            }
            await self.store_analytics(analytics_payload)
            
            logger.debug(f"Analytics computed for {symbol_id} @ {timestamp}")
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in message: {e}")
        except Exception as e:
            logger.error(f"Error in process_message: {e}", exc_info=True)
    
    async def fetch_historical_context(
        self,
        symbol_id: int,
        expiry: str,
        lookback_minutes: int = 60
    ) -> List[Dict]:
        """
        Fetch historical data for context.
        
        Args:
            symbol_id: Security identifier
            expiry: Option expiry date
            lookback_minutes: How far back to query
            
        Returns:
            List of historical snapshots
        """
        try:
            from datetime import datetime, timedelta
            from sqlalchemy import select, and_
            from core.database.models import MarketSnapshot
            
            async with self.db_session() as session:
                # Calculate time range
                now = datetime.utcnow()
                start_time = now - timedelta(minutes=lookback_minutes)
                
                # Query historical snapshots
                stmt = select(MarketSnapshot).where(
                    and_(
                        MarketSnapshot.symbol_id == symbol_id,
                        MarketSnapshot.timestamp >= start_time,
                        MarketSnapshot.timestamp <= now
                    )
                ).order_by(MarketSnapshot.timestamp.asc())
                
                result = await session.execute(stmt)
                snapshots = result.scalars().all()
                
                # Convert to dict format for analyzers
                historical_data = []
                for snapshot in snapshots:
                    historical_data.append({
                        'timestamp': snapshot.timestamp.isoformat(),
                        'symbol_id': snapshot.symbol_id,
                        'spot_price': float(snapshot.spot_price) if snapshot.spot_price else None,
                        'options': snapshot.options_data if hasattr(snapshot, 'options_data') else []
                    })
                
                logger.debug(f"Fetched {len(historical_data)} historical snapshots for context")
                return historical_data
            
        except Exception as e:
            logger.error(f"Error fetching historical context: {e}", exc_info=True)
            return []
    
    async def publish_realtime(self, analytics_data: Dict):
        """
        Publish analytics to Redis Pub/Sub for realtime streaming.
        
        Args:
            analytics_data: Computed analytics metrics
        """
        try:
            import json
            
            channel = f"analytics:{analytics_data['symbol_id']}"
            message = json.dumps(analytics_data)
            
            await self.redis_client.publish(channel, message)
            
            logger.debug(f"Published to Redis channel: {channel}")
            
        except Exception as e:
            logger.error(f"Error publishing to Redis: {e}")
    
    async def store_analytics(self, data: Dict):
        """
        Store computed analytics in TimescaleDB.
        
        Args:
            data: Analytics data to persist
        """
        try:
            async with self.db_session() as session:
                timestamp = datetime.fromisoformat(data['timestamp'])
                symbol_id = data['symbol_id']
                expiry = datetime.fromisoformat(data['expiry']).date()
                
                # 1. Store Cumulative OI metrics
                cumulative_oi = data.get('cumulative_oi')
                if cumulative_oi and not isinstance(cumulative_oi, Exception):
                    await self._store_cumulative_oi(
                        session, timestamp, symbol_id, expiry, cumulative_oi
                    )
                
                # 2. Store Velocity metrics
                velocity = data.get('velocity')
                if velocity and not isinstance(velocity, Exception):
                    await self._store_velocity(
                        session, timestamp, symbol_id, expiry, velocity
                    )
                
                # 3. Store Zones
                zones = data.get('zones')
                if zones and not isinstance(zones, Exception):
                    await self._store_zones(
                        session, timestamp, symbol_id, expiry, zones
                    )
                
                # 4. Store Patterns
                patterns = data.get('patterns')
                if patterns and not isinstance(patterns, Exception):
                    await self._store_patterns(
                        session, timestamp, symbol_id, expiry, patterns
                    )
                
                # Commit all inserts
                await session.commit()
                logger.debug(f"Analytics stored for {symbol_id} @ {timestamp}")
                
        except Exception as e:
            logger.error(f"Error storing analytics: {e}", exc_info=True)
    
    async def _store_cumulative_oi(self, session, timestamp, symbol_id, expiry, data):
        """Store cumulative OI metrics"""
        from services.analytics.models import AnalyticsCumulativeOI
        
        strike_wise = data.get('strike_wise', {})
        
        for key, metrics in strike_wise.items():
            record = AnalyticsCumulativeOI(
                timestamp=timestamp,
                symbol_id=symbol_id,
                strike_price=metrics['strike'],
                option_type=metrics['option_type'],
                expiry=expiry,
                current_oi=metrics['current_oi'],
                opening_oi=metrics.get('opening_oi'),
                cumulative_oi_change=metrics.get('cumulative_oi_change'),
                cumulative_volume=metrics.get('cumulative_volume'),
                session_high_oi=metrics.get('session_high_oi'),
                session_low_oi=metrics.get('session_low_oi'),
                oi_change_pct=(
                    (metrics['cumulative_oi_change'] / metrics['opening_oi'] * 100)
                    if metrics.get('opening_oi') and metrics['opening_oi'] > 0
                    else None
                )
            )
            session.add(record)
    
    async def _store_velocity(self, session, timestamp, symbol_id, expiry, data):
        """Store velocity metrics"""
        from services.analytics.models import AnalyticsVelocity
        
        strike_wise = data.get('strike_wise', {})
        
        for key, metrics in strike_wise.items():
            record = AnalyticsVelocity(
                timestamp=timestamp,
                symbol_id=symbol_id,
                strike_price=metrics['strike'],
                option_type=metrics['option_type'],
                expiry=expiry,
                oi_velocity=metrics.get('oi_velocity'),
                volume_velocity=metrics.get('volume_velocity'),
                price_velocity=metrics.get('price_velocity'),
                is_spike=metrics.get('is_spike', False),
                spike_magnitude=abs(metrics.get('oi_velocity', 0)) if metrics.get('is_spike') else None,
                time_delta_seconds=int(data.get('time_delta_minutes', 1) * 60)
            )
            session.add(record)
    
    async def _store_zones(self, session, timestamp, symbol_id, expiry, data):
        """Store support/resistance zones and max pain"""
        from services.analytics.models import AnalyticsZones
        
        if not data or not isinstance(data, dict):
            return
        
        try:
            # Store max pain
            if 'max_pain' in data and data['max_pain']:
                max_pain_record = AnalyticsZones(
                    timestamp=timestamp,
                    symbol_id=symbol_id,
                    expiry=expiry,
                    zone_type='max_pain',
                    strike_price=float(data['max_pain']),
                    strength=100.0,  # Max pain always 100% strength
                    metadata_={'calculated_at': timestamp.isoformat()}
                )
                session.add(max_pain_record)
            
            # Store support levels (high PUT OI below spot)
            for support in data.get('support_levels', []):
                support_record = AnalyticsZones(
                    timestamp=timestamp,
                    symbol_id=symbol_id,
                    expiry=expiry,
                    zone_type='support',
                    strike_price=float(support.get('strike', 0)),
                    strength=float(support.get('strength', 50.0)),
                    metadata_={
                        'oi': support.get('oi'),
                        'option_type': 'PE',
                        'distance_from_spot': support.get('distance_from_spot')
                    }
                )
                session.add(support_record)
            
            # Store resistance levels (high CALL OI above spot)
            for resistance in data.get('resistance_levels', []):
                resistance_record = AnalyticsZones(
                    timestamp=timestamp,
                    symbol_id=symbol_id,
                    expiry=expiry,
                    zone_type='resistance',
                    strike_price=float(resistance.get('strike', 0)),
                    strength=float(resistance.get('strength', 50.0)),
                    metadata_={
                        'oi': resistance.get('oi'),
                        'option_type': 'CE',
                        'distance_from_spot': resistance.get('distance_from_spot')
                    }
                )
                session.add(resistance_record)
            
            # Store OI concentration zones
            for zone in data.get('oi_zones', []):
                zone_record = AnalyticsZones(
                    timestamp=timestamp,
                    symbol_id=symbol_id,
                    expiry=expiry,
                    zone_type='oi_concentration',
                    strike_price=float(zone.get('center_strike', 0)),
                    strength=float(zone.get('strength', 70.0)),
                    metadata_={
                        'strikes': zone.get('strikes', []),
                        'total_oi': zone.get('total_oi'),
                        'avg_oi': zone.get('avg_oi')
                    }
                )
                session.add(zone_record)
            
            # Store pivot points if available
            if 'pivot_points' in data and data['pivot_points']:
                pivots = data['pivot_points']
                for pivot_type, strike_value in pivots.items():
                    if strike_value:
                        pivot_record = AnalyticsZones(
                            timestamp=timestamp,
                            symbol_id=symbol_id,
                            expiry=expiry,
                            zone_type=f'pivot_{pivot_type}',  # pivot_R1, pivot_S1, etc.
                            strike_price=float(strike_value),
                            strength=60.0,  # Pivot points have medium strength
                            metadata_={'pivot_type': pivot_type}
                        )
                        session.add(pivot_record)
                        
        except Exception as e:
            logger.error(f"Error storing zones: {e}", exc_info=True)
            # Don't raise - allow other storage to continue
    
    async def _store_patterns(self, session, timestamp, symbol_id, expiry, data):
        """Store detected trading patterns"""
        from services.analytics.models import AnalyticsPatterns
        
        if not data or not isinstance(data, list):
            return
        
        try:
            for pattern in data:
                if not isinstance(pattern, dict):
                    continue
                
                pattern_record = AnalyticsPatterns(
                    timestamp=timestamp,
                    symbol_id=symbol_id,
                    expiry=expiry,
                    pattern_type=pattern.get('type'),
                    strike_price=pattern.get('strike'),
                    option_type=pattern.get('option_type'),
                    confidence=float(pattern.get('confidence', 50.0)),
                    signal=pattern.get('signal'),
                    description=pattern.get('description'),
                    metadata_=pattern  # Store complete pattern data for reference
                )
                session.add(pattern_record)
                
        except Exception as e:
            logger.error(f"Error storing patterns: {e}", exc_info=True)
            # Don't raise - allow other storage to continue
    
    async def shutdown(self):
        """Clean shutdown of all components"""
        logger.info("Shutting down Analytics Service...")
        
        self.running = False
        
        if self.consumer:
            await self.consumer.stop()
            logger.info("Kafka consumer stopped")
        
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis client closed")
        
        if self.db_engine:
            await self.db_engine.dispose()
            logger.info("Database engine disposed")
        
        logger.info("Analytics Service shutdown complete")


async def main():
    """Main entry point"""
    service = AnalyticsService()
    
    try:
        await service.initialize()
        await service.start()
    except KeyboardInterrupt:
        logger.info("Received shutdown signal")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
    finally:
        await service.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
