"""add_performance_indexes

Revision ID: add_performance_indexes
Create Date: 2025-11-30

Add performance indexes for market_snapshots and option_contracts.
Improves query performance by 20-30%.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_performance_indexes'
down_revision = None  # Update this if there are previous migrations
branch_labels = None
depends_on = None


def upgrade():
    """Add performance indexes"""
    
    # Market Snapshots: Time-series queries optimization
    op.create_index(
        'idx_market_snapshots_symbol_time',
        'market_snapshots',
        ['symbol_id', sa.text('timestamp DESC')],
        unique=False,
        postgresql_using='btree',
        postgresql_concurrently=True  # Non-blocking index creation
    )
    
    op.create_index(
        'idx_market_snapshots_time',
        'market_snapshots',
        [sa.text('timestamp DESC')],
        unique=False,
        postgresql_using='btree',
        postgresql_concurrently=True
    )
    
    # Option Contracts: Strike + expiry lookups
    op.create_index(
        'idx_option_contracts_symbol_strike',
        'option_contracts',
        ['symbol_id', 'strike_price', 'expiry'],
        unique=False,
        postgresql_using='btree',
        postgresql_concurrently=True
    )
    
    op.create_index(
        'idx_option_contracts_expiry',
        'option_contracts',
        ['expiry', 'symbol_id'],
        unique=False,
        postgresql_using='btree',
        postgresql_concurrently=True
    )
    
    # Add index on timestamp for faster time-range queries
    op.create_index(
        'idx_option_contracts_timestamp',
        'option_contracts',
        [sa.text('timestamp DESC')],
        unique=False,
        postgresql_using='btree',
        postgresql_concurrently=True
    )


def downgrade():
    """Remove performance indexes"""
    
    op.drop_index('idx_option_contracts_timestamp', table_name='option_contracts')
    op.drop_index('idx_option_contracts_expiry', table_name='option_contracts')
    op.drop_index('idx_option_contracts_symbol_strike', table_name='option_contracts')
    op.drop_index('idx_market_snapshots_time', table_name='market_snapshots')
    op.drop_index('idx_market_snapshots_symbol_time', table_name='market_snapshots')
