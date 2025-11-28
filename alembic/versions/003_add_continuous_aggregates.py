"""
TimescaleDB Continuous Aggregates for Real-Time Analytics

Creates materialized views that auto-refresh for instant query results.
Run with: alembic revision --autogenerate -m "add_continuous_aggregates"
"""

def upgrade() -> None:
    """Create continuous aggregates for real-time analytics"""
    
    # 1-minute OHLCV candles (refreshes every 10 seconds)
    op.execute("""
        CREATE MATERIALIZED VIEW one_minute_candles
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 minute', timestamp) AS bucket,
            symbol_id,
            FIRST(ltp, timestamp) as open,
            MAX(ltp) as high,
            MIN(ltp) as low,
            LAST(ltp, timestamp) as close,
            SUM(volume) as volume,
            COUNT(*) as tick_count
        FROM market_snapshots
        GROUP BY bucket, symbol_id
        WITH NO DATA;
    """)
    
    # Add refresh policy (auto-refresh every 10 seconds)
    op.execute("""
        SELECT add_continuous_aggregate_policy('one_minute_candles',
            start_offset => INTERVAL '2 hours',
            end_offset => INTERVAL '10 seconds',
            schedule_interval => INTERVAL '10 seconds');
    """)
    
    # 5-minute candles
    op.execute("""
        CREATE MATERIALIZED VIEW five_minute_candles
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('5 minutes', timestamp) AS bucket,
            symbol_id,
            FIRST(ltp, timestamp) as open,
            MAX(ltp) as high,
            MIN(ltp) as low,
            LAST(ltp, timestamp) as close,
            SUM(volume) as volume
        FROM market_snapshots
        GROUP BY bucket, symbol_id
        WITH NO DATA;
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('five_minute_candles',
            start_offset => INTERVAL '1 day',
            end_offset => INTERVAL '30 seconds',
            schedule_interval => INTERVAL '30 seconds');
    """)
    
    # Option Greeks aggregation (every minute)
    op.execute("""
        CREATE MATERIALIZED VIEW option_greeks_minutely
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 minute', timestamp) AS bucket,
            symbol_id,
            option_type,
            strike_price,
            AVG(iv) as avg_iv,
            SUM(volume) as total_volume,
            SUM(oi) as total_oi,
            LAST(ltp, timestamp) as last_price
        FROM option_contracts
        WHERE iv IS NOT NULL
        GROUP BY bucket, symbol_id, option_type, strike_price
        WITH NO DATA;
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('option_greeks_minutely',
            start_offset => INTERVAL '2 hours',
            end_offset => INTERVAL '15 seconds',
            schedule_interval => INTERVAL '15 seconds');
    """)
    
    # Market statistics (daily aggregates)
    op.execute("""
        CREATE MATERIALIZED VIEW daily_market_stats
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 day', timestamp) AS day,
            symbol_id,
            FIRST(ltp, timestamp) as open,
            MAX(ltp) as high,
            MIN(ltp) as low,
            LAST(ltp, timestamp) as close,
            SUM(volume) as total_volume,
            AVG(ltp) as avg_price,
            STDDEV(ltp) as volatility
        FROM market_snapshots
        GROUP BY day, symbol_id
        WITH NO DATA;
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('daily_market_stats',
            start_offset => INTERVAL '7 days',
            end_offset => INTERVAL '1 minute',
            schedule_interval => INTERVAL '1 minute');
    """)
    
    # Create indexes on materialized views for fast queries
    op.create_index(
        'idx_one_minute_candles_lookup',
        'one_minute_candles',
        ['symbol_id', 'bucket'],
        postgresql_using='btree'
    )
    
    op.create_index(
        'idx_five_minute_candles_lookup',
        'five_minute_candles',
        ['symbol_id', 'bucket'],
        postgresql_using='btree'
    )
    
    op.create_index(
        'idx_option_greeks_lookup',
        'option_greeks_minutely',
        ['symbol_id', 'bucket', 'option_type', 'strike_price'],
        postgresql_using='btree'
    )


def downgrade() -> None:
    """Remove continuous aggregates"""
    # Remove policies first
    op.execute("SELECT remove_continuous_aggregate_policy('one_minute_candles')")
    op.execute("SELECT remove_continuous_aggregate_policy('five_minute_candles')")
    op.execute("SELECT remove_continuous_aggregate_policy('option_greeks_minutely')")
    op.execute("SELECT remove_continuous_aggregate_policy('daily_market_stats')")
    
    # Drop materialized views
    op.execute("DROP MATERIALIZED VIEW IF EXISTS one_minute_candles CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS five_minute_candles CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS option_greeks_minutely CASCADE")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS daily_market_stats CASCADE")
