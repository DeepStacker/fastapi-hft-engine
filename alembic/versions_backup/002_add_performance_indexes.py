"""
Critical Database Indexes for Real-Time Performance

Run with: alembic revision --autogenerate -m "add_performance_indexes"
Then: alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # CRITICAL: Covering indexes for hot queries
    # These indexes include all columns needed by the query (no table lookup)
    
    op.create_index(
        'idx_market_snapshots_symbol_time_covering',
        'market_snapshots',
        ['symbol_id', 'timestamp'],
        postgresql_include=['ltp', 'volume', 'oi'],  # Covering index
        postgresql_using='btree',
        postgres_ops={'timestamp': 'DESC'}
    )
    
    op.create_index(
        'idx_options_lookup_covering',
        'option_contracts',
        ['symbol_id', 'expiry', 'option_type', 'strike_price'],
        postgresql_include=['ltp', 'volume', 'oi', 'iv'],
        postgresql_using='btree'
    )
    
    # Partial indexes for active data only (smaller, faster)
    op.execute("""
        CREATE INDEX CONCURRENTLY idx_market_snapshots_recent
        ON market_snapshots(symbol_id, timestamp DESC)
        WHERE timestamp > NOW() - INTERVAL '24 hours';
    """)
    
    op.execute("""
        CREATE INDEX CONCURRENTLY idx_active_instruments_only
        ON instruments(symbol_id)
        INCLUDE (symbol, exchange, segment)
        WHERE is_active = 1;
    """)
    
    # Composite indexes for common filter combinations
    op.create_index(
        'idx_options_active_ce',
        'option_contracts',
        ['symbol_id', 'timestamp'],
        postgresql_where="option_type = 'CE'",
        postgresql_using='btree'
    )
    
    op.create_index(
        'idx_options_active_pe',
        'option_contracts',
        ['symbol_id', 'timestamp'],
        postgresql_where="option_type = 'PE'",
        postgresql_using='btree'
    )
    
   # BRIN indexes for timestamp columns (ultra-fast for time-series)
    op.execute("""
        CREATE INDEX CONCURRENTLY idx_market_snapshots_timestamp_brin
        ON market_snapshots USING BRIN (timestamp)
        WITH (pages_per_range = 128);
    """)
    
    op.execute("""
        CREATE INDEX CONCURRENTLY idx_options_timestamp_brin
        ON option_contracts USING BRIN (timestamp)
        WITH (pages_per_range = 128);
    """)


def downgrade() -> None:
    op.drop_index('idx_market_snapshots_symbol_time_covering')
    op.drop_index('idx_options_lookup_covering')
    op.drop_index('idx_market_snapshots_recent')
    op.drop_index('idx_active_instruments_only')
    op.drop_index('idx_options_active_ce')
    op.drop_index('idx_options_active_pe')
    op.drop_index('idx_market_snapshots_timestamp_brin')
    op.drop_index('idx_options_timestamp_brin')
