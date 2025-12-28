"""
Symbol Partitioner for Horizontal Ingestion Scaling

Distributes 6000+ symbols across multiple ingestion service instances
using consistent hashing for balanced load distribution.

Each ingestion instance only fetches data for its assigned symbol subset,
enabling horizontal scaling without data duplication.

Usage:
    partitioner = SymbolPartitioner(instance_id=1, total_instances=3)
    my_symbols = partitioner.get_assigned_symbols(all_symbols)
    # Instance 1 gets ~2000 symbols
    # Instance 2 gets ~2000 symbols
    # Instance 3 gets ~2000 symbols
"""

import hashlib
from typing import List, Dict, Set
from core.logging.logger import get_logger

logger = get_logger(__name__)


class SymbolPartitioner:
    """
    Consistent hash-based symbol partitioner for multi-instance ingestion.
    
    Ensures:
    - Even distribution of symbols across instances
    - Consistent assignment (same symbol always goes to same instance)
    - Minimal reshuffling when instances are added/removed
    """
    
    def __init__(self, instance_id: int, total_instances: int):
        """
        Initialize partitioner for this instance.
        
        Args:
            instance_id: ID of this instance (1-indexed, e.g., 1, 2, 3)
            total_instances: Total number of ingestion instances running
        """
        if instance_id < 1 or instance_id > total_instances:
            raise ValueError(
                f"instance_id must be between 1 and {total_instances}, got {instance_id}"
            )
        
        self.instance_id = instance_id
        self.total_instances = total_instances
        
        logger.info(
            f"Initialized SymbolPartitioner: instance {instance_id}/{total_instances}"
        )
    
    def _hash_symbol(self, symbol_id: int) -> int:
        """
        Consistent hash function for symbol assignment.
        
        Args:
            symbol_id: Symbol ID to hash
            
        Returns:
            Hash value modulo total_instances
        """
        # Use MD5 for fast, consistent hashing
        hash_obj = hashlib.md5(str(symbol_id).encode())
        hash_int = int(hash_obj.hexdigest(), 16)
        return hash_int % self.total_instances
    
    def is_my_symbol(self, symbol_id: int) -> bool:
        """
        Check if this symbol should be processed by this instance.
        
        Args:
            symbol_id: Symbol ID to check
            
        Returns:
            True if this instance should process this symbol
        """
        assigned_instance = self._hash_symbol(symbol_id) + 1  # Convert to 1-indexed
        return assigned_instance == self.instance_id
    
    def get_assigned_symbols(self, all_symbols: List[Dict]) -> List[Dict]:
        """
        Filter symbol list to only include symbols assigned to this instance.
        
        Args:
            all_symbols: List of all symbol dicts (must have 'security_id' key)
            
        Returns:
            Filtered list of symbols for this instance
        """
        assigned = [
            symbol for symbol in all_symbols
            if self.is_my_symbol(symbol['security_id'])
        ]
        
        total_count = len(all_symbols)
        assigned_count = len(assigned)
        percentage = (assigned_count / total_count * 100) if total_count > 0 else 0
        
        logger.info(
            f"Instance {self.instance_id}/{self.total_instances} assigned "
            f"{assigned_count}/{total_count} symbols ({percentage:.1f}%)"
        )
        
        return assigned
    
    def get_partition_stats(self, all_symbols: List[Dict]) -> Dict[int, int]:
        """
        Get distribution statistics across all instances.
        
        Args:
            all_symbols: List of all symbols
            
        Returns:
            Dict mapping instance_id to symbol count
        """
        stats = {i: 0 for i in range(1, self.total_instances + 1)}
        
        for symbol in all_symbols:
            instance = self._hash_symbol(symbol['security_id']) + 1
            stats[instance] += 1
        
        return stats
    
    def log_distribution(self, all_symbols: List[Dict]):
        """Log symbol distribution across all instances for debugging."""
        stats = self.get_partition_stats(all_symbols)
        total = len(all_symbols)
        
        logger.info("Symbol distribution across instances:")
        for instance_id, count in sorted(stats.items()):
            percentage = (count / total * 100) if total > 0 else 0
            marker = "👉" if instance_id == self.instance_id else "  "
            logger.info(
                f"{marker} Instance {instance_id}: {count:4d} symbols ({percentage:5.1f}%)"
            )


class RangePartitioner:
    """
    Simple range-based partitioner (alternative to consistent hashing).
    
    Divides symbols into equal ranges by security_id.
    Simpler but less flexible than consistent hashing.
    
    Example for 6000 symbols with 3 instances:
    - Instance 1: symbols 0-1999
    - Instance 2: symbols 2000-3999
    - Instance 3: symbols 4000-5999
    """
    
    def __init__(self, instance_id: int, total_instances: int):
        if instance_id < 1 or instance_id > total_instances:
            raise ValueError(
                f"instance_id must be between 1 and {total_instances}, got {instance_id}"
            )
        
        self.instance_id = instance_id
        self.total_instances = total_instances
        
        logger.info(
            f"Initialized RangePartitioner: instance {instance_id}/{total_instances}"
        )
    
    def is_my_symbol(self, symbol_id: int, total_symbols: int) -> bool:
        """
        Check if symbol belongs to this instance's range.
        
        Args:
            symbol_id: Symbol ID to check
            total_symbols: Total number of symbols in dataset
            
        Returns:
            True if symbol is in this instance's range
        """
        symbols_per_instance = total_symbols // self.total_instances
        remainder = total_symbols % self.total_instances
        
        # Calculate range for this instance
        start_idx = (self.instance_id - 1) * symbols_per_instance
        end_idx = start_idx + symbols_per_instance
        
        # Distribute remainder across first instances
        if self.instance_id <= remainder:
            start_idx += (self.instance_id - 1)
            end_idx += self.instance_id
        else:
            start_idx += remainder
            end_idx += remainder
        
        return start_idx <= symbol_id < end_idx
    
    def get_assigned_symbols(self, all_symbols: List[Dict]) -> List[Dict]:
        """
        Filter symbols by range for this instance.
        
        Args:
            all_symbols: List of all symbol dicts (sorted by security_id)
            
        Returns:
            Subset for this instance
        """
        # Sort by security_id for range partitioning
        sorted_symbols = sorted(all_symbols, key=lambda x: x['security_id'])
        total = len(sorted_symbols)
        
        symbols_per_instance = total // self.total_instances
        remainder = total % self.total_instances
        
        start_idx = (self.instance_id - 1) * symbols_per_instance
        end_idx = start_idx + symbols_per_instance
        
        if self.instance_id <= remainder:
            start_idx += (self.instance_id - 1)
            end_idx += self.instance_id
        else:
            start_idx += remainder
            end_idx += remainder
        
        assigned = sorted_symbols[start_idx:end_idx]
        
        logger.info(
            f"Instance {self.instance_id}/{self.total_instances} assigned "
            f"{len(assigned)}/{total} symbols "
            f"(range: {start_idx}-{end_idx})"
        )
        
        return assigned


def create_partitioner(
    instance_id: int,
    total_instances: int,
    strategy: str = "consistent_hash"
) -> SymbolPartitioner:
    """
    Factory function to create partitioner with specified strategy.
    
    Args:
        instance_id: This instance ID (1-indexed)
        total_instances: Total number of instances
        strategy: "consistent_hash" (recommended) or "range"
        
    Returns:
        Partitioner instance
    """
    if strategy == "consistent_hash":
        return SymbolPartitioner(instance_id, total_instances)
    elif strategy == "range":
        return RangePartitioner(instance_id, total_instances)
    else:
        raise ValueError(f"Unknown partitioning strategy: {strategy}")
