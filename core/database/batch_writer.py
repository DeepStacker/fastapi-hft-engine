"""
Batch Writer for High-Throughput Database Writes

Batches database writes to reduce database load by 10-100x.
Essential for millions of transactions per second.
"""

import asyncio
from typing import List, Any, Callable
from datetime import datetime
import structlog
from collections import defaultdict

logger = structlog.get_logger("batch-writer")


class BatchWriter:
    """
    Batches database writes for high performance.
    
    Benefits:
    - 10-100x fewer database round-trips
    - Reduced transaction overhead
    - Better throughput under load
    
    Use Cases:
    - Storage Service: Batch insert option chain snapshots
    - Analytics Service: Batch insert analytics results
    - Any high-volume writes
    """
    
    def __init__(
        self,
        batch_size: int = 1000,
        flush_interval: float = 5.0,
        write_callback: Callable = None
    ):
        """
        Initialize batch writer.
        
        Args:
            batch_size: Max items per batch before auto-flush
            flush_interval: Max seconds before auto-flush
            write_callback: Async function to call for batch writes
        """
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.write_callback = write_callback
        
        # Batches by table/model (for different insert types)
        self.batches = defaultdict(list)
        self.batch_locks = defaultdict(asyncio.Lock)
        self.last_flush_times = defaultdict(lambda: datetime.now())
        
        # Auto-flush task
        self.flush_task = None
        self.running = False
        
        # Stats
        self._stats = {
            'total_items': 0,
            'total_batches': 0,
            'total_flushes': 0,
            'items_per_batch_avg': 0
        }
    
    async def start(self):
        """Start auto-flush background task"""
        self.running = True
        self.flush_task = asyncio.create_task(self._auto_flush_loop())
        logger.info("Batch writer started", 
                   batch_size=self.batch_size,
                   flush_interval=self.flush_interval)
    
    async def stop(self):
        """Stop batch writer and flush remaining items"""
        self.running = False
        if self.flush_task:
            self.flush_task.cancel()
            try:
                await self.flush_task
            except asyncio.CancelledError:
                pass
        
        # Final flush
        await self.flush_all()
        logger.info("Batch writer stopped")
    
    async def add(self, item: Any, batch_key: str = "default"):
        """
        Add item to batch.
        
        Args:
            item: Item to batch (dict, ORM model, etc.)
            batch_key: Key to group batches by table/type
        """
        async with self.batch_locks[batch_key]:
            self.batches[batch_key].append(item)
            batch_len = len(self.batches[batch_key])
            
            # Auto-flush if batch is full
            if batch_len >= self.batch_size:
                await self._flush_batch(batch_key)
    
    async def _flush_batch(self, batch_key: str):
        """Flush a specific batch"""
        if not self.batches[batch_key]:
            return
        
        batch = self.batches[batch_key].copy()
        self.batches[batch_key].clear()
        self.last_flush_times[batch_key] = datetime.now()
        
        if self.write_callback:
            try:
                await self.write_callback(batch, batch_key)
                
                # Update stats
                self._stats['total_items'] += len(batch)
                self._stats['total_batches'] += 1
                self._stats['total_flushes'] += 1
                
                # Calculate average items per batch
                self._stats['items_per_batch_avg'] = (
                    self._stats['total_items'] / self._stats['total_batches']
                )
                
                logger.debug(f"Flushed batch", 
                           batch_key=batch_key,
                           items=len(batch))
            except Exception as e:
                logger.error(f"Batch write failed: {e}",
                           batch_key=batch_key,
                           items=len(batch))
                # Re-add failed items for retry
                async with self.batch_locks[batch_key]:
                    self.batches[batch_key].extend(batch)
    
    async def flush_all(self):
        """Flush all pending batches"""
        for batch_key in list(self.batches.keys()):
            async with self.batch_locks[batch_key]:
                await self._flush_batch(batch_key)
    
    async def _auto_flush_loop(self):
        """Background task to auto-flush based on time"""
        while self.running:
            await asyncio.sleep(1)  # Check every second
            
            now = datetime.now()
            for batch_key in list(self.batches.keys()):
                time_since_flush = (now - self.last_flush_times[batch_key]).total_seconds()
                
                if time_since_flush >= self.flush_interval:
                    async with self.batch_locks[batch_key]:
                        if self.batches[batch_key]:  # Only flush if has items
                            await self._flush_batch(batch_key)
    
    def get_stats(self) -> dict:
        """Get batch writer statistics"""
        pending_items = sum(len(batch) for batch in self.batches.values())
        
        return {
            'pending_items': pending_items,
            'pending_batches': len(self.batches),
            **self._stats
        }


# Example usage for Storage Service
class OptionChainBatchWriter:
    """Specialized batch writer for option chain snapshots"""
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.writer = BatchWriter(
            batch_size=1000,
            flush_interval=5.0,
            write_callback=self._write_option_chains
        )
    
    async def _write_option_chains(self, batch: List[Any], batch_key: str):
        """Write batch of option chains to database"""
        from core.database.models import OptionChainSnapshotDB
        from sqlalchemy import insert
        
        async with self.db_session_factory() as session:
            # Bulk insert (much faster than individual inserts)
            stmt = insert(OptionChainSnapshotDB).values([
                item if isinstance(item, dict) else item.__dict__
                for item in batch
            ])
            
            await session.execute(stmt)
            await session.commit()
            
            logger.info(f"Bulk inserted {len(batch)} option chain snapshots")
    
    async def add_snapshot(self, snapshot: Any):
        """Add snapshot to batch"""
        await self.writer.add(snapshot, batch_key="option_chains")
    
    async def start(self):
        """Start batch writer"""
        await self.writer.start()
    
    async def stop(self):
        """Stop and flush"""
        await self.writer.stop()


# Example usage for Analytics Service
class AnalyticsBatchWriter:
    """Specialized batch writer for analytics results"""
    
    def __init__(self, db_session_factory):
        self.db_session_factory = db_session_factory
        self.writer = BatchWriter(
            batch_size=500,
            flush_interval=10.0,
            write_callback=self._write_analytics
        )
    
    async def _write_analytics(self, batch: List[Any], batch_key: str):
        """Write batch of analytics to appropriate table"""
        from sqlalchemy import insert
        
        # Map batch_key to table model
        model_map = {
            'cumulative_oi': 'AnalyticsCumulativeOIDB',
            'velocity': 'AnalyticsVelocityDB',
            'patterns': 'AnalyticsBuildupPatternsDB',
            'zones': 'AnalyticsZonesDB'
        }
        
        if batch_key in model_map:
            async with self.db_session_factory() as session:
                # Get model dynamically
                from core.database import models
                model = getattr(models, model_map[batch_key])
                
                stmt = insert(model).values([
                    item if isinstance(item, dict) else item.__dict__
                    for item in batch
                ])
                
                await session.execute(stmt)
                await session.commit()
                
                logger.info(f"Bulk inserted {len(batch)} {batch_key} records")
    
    async def add_result(self, result: Any, result_type: str):
        """Add analytics result to batch"""
        await self.writer.add(result, batch_key=result_type)
    
    async def start(self):
        """Start batch writer"""
        await self.writer.start()
    
    async def stop(self):
        """Stop and flush"""
        await self.writer.stop()
