"""create_analytics_tables

Revision ID: create_analytics_tables
Create Date: 2025-11-30

Create analytics tables for post-storage stateful analysis.
Optimized for charting and time-series queries.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'create_analytics_tables'
down_revision = 'add_performance_indexes'  # Previous migration
branch_labels = None
depends_on = None


def upgrade():
    """Create analytics tables"""
    
    # 1. Cumulative OI metrics
    op.create_table(
        'analytics_cumulative_oi',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('strike_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('option_type', sa.String(2), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        
        sa.Column('current_oi', sa.BigInteger(), nullable=False),
        sa.Column('opening_oi', sa.BigInteger()),
        sa.Column('cumulative_oi_change', sa.BigInteger()),
        sa.Column('cumulative_volume', sa.BigInteger()),
        sa.Column('session_high_oi', sa.BigInteger()),
        sa.Column('session_low_oi', sa.BigInteger()),
        sa.Column('oi_change_pct', sa.Numeric(10, 4)),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('timestamp', 'symbol_id', 'strike_price', 'option_type')
    )
    
    op.create_index('idx_cumoi_symbol_expiry_time', 'analytics_cumulative_oi', 
                    ['symbol_id', 'expiry', 'timestamp'])
    op.create_index('idx_cumoi_strike_type_time', 'analytics_cumulative_oi',
                    ['strike_price', 'option_type', 'timestamp'])
    
    # 2. Velocity metrics
    op.create_table(
        'analytics_velocity',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('strike_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('option_type', sa.String(2), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        
        sa.Column('oi_velocity', sa.Numeric(15, 2)),
        sa.Column('volume_velocity', sa.Numeric(15, 2)),
        sa.Column('price_velocity', sa.Numeric(10, 4)),
        sa.Column('oi_acceleration', sa.Numeric(15, 4)),
        sa.Column('is_spike', sa.Boolean(), default=False),
        sa.Column('spike_magnitude', sa.Numeric(10, 2)),
        sa.Column('time_delta_seconds', sa.Integer()),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('timestamp', 'symbol_id', 'strike_price', 'option_type')
    )
    
    op.create_index('idx_velocity_symbol_expiry_time', 'analytics_velocity',
                    ['symbol_id', 'expiry', 'timestamp'])
    op.create_index('idx_velocity_spikes', 'analytics_velocity',
                    ['is_spike', 'timestamp'])
    
    # 3. Support/Resistance zones
    op.create_table(
        'analytics_zones',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        sa.Column('zone_type', sa.String(20), nullable=False),
        sa.Column('strike_price', sa.Numeric(10, 2), nullable=False),
        
        sa.Column('strength', sa.Numeric(5, 2)),
        sa.Column('oi_concentration', sa.BigInteger()),
        sa.Column('upper_bound', sa.Numeric(10, 2)),
        sa.Column('lower_bound', sa.Numeric(10, 2)),
        sa.Column('zone_age_minutes', sa.Integer()),
        sa.Column('is_new', sa.Boolean(), default=True),
        sa.Column('is_broken', sa.Boolean(), default=False),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('timestamp', 'symbol_id', 'expiry', 'zone_type', 'strike_price')
    )
    
    op.create_index('idx_zones_symbol_expiry_type', 'analytics_zones',
                    ['symbol_id', 'expiry', 'zone_type', 'timestamp'])
    
    # 4. Pattern detection
    op.create_table(
        'analytics_patterns',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        
        sa.Column('pattern_type', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Numeric(5, 2)),
        sa.Column('metadata', postgresql.JSONB()),
        sa.Column('signal_type', sa.String(20)),
        sa.Column('signal_strength', sa.Numeric(5, 2)),
        sa.Column('strikes_involved', postgresql.JSONB()),
        sa.Column('price_level', sa.Numeric(10, 2)),
        
        sa.Column('is_confirmed', sa.Boolean(), default=False),
        sa.Column('outcome_profit_pct', sa.Numeric(10, 4)),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'))
    )
    
    op.create_index('idx_patterns_symbol_type_time', 'analytics_patterns',
                    ['symbol_id', 'pattern_type', 'timestamp'])
    op.create_index('idx_patterns_timestamp', 'analytics_patterns', ['timestamp'])
    
    # 5. Greeks timeline
    op.create_table(
        'analytics_greeks_timeline',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('strike_price', sa.Numeric(10, 2), nullable=False),
        sa.Column('option_type', sa.String(2), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        
        sa.Column('delta', sa.Numeric(10, 6)),
        sa.Column('gamma', sa.Numeric(10, 8)),
        sa.Column('theta', sa.Numeric(10, 6)),
        sa.Column('vega', sa.Numeric(10, 6)),
        sa.Column('rho', sa.Numeric(10, 6)),
        sa.Column('delta_change', sa.Numeric(10, 6)),
        sa.Column('gamma_change', sa.Numeric(10, 8)),
        sa.Column('delta_flip', sa.Boolean(), default=False),
        sa.Column('gamma_peak', sa.Boolean(), default=False),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('timestamp', 'symbol_id', 'strike_price', 'option_type')
    )
    
    op.create_index('idx_greeks_symbol_strike_time', 'analytics_greeks_timeline',
                    ['symbol_id', 'strike_price', 'timestamp'])
    
    # 6. OI Distribution snapshots
    op.create_table(
        'analytics_oi_distribution',
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        
        sa.Column('total_call_oi', sa.BigInteger()),
        sa.Column('total_put_oi', sa.BigInteger()),
        sa.Column('pcr_oi', sa.Numeric(10, 4)),
        sa.Column('atm_strike', sa.Numeric(10, 2)),
        sa.Column('atm_call_oi', sa.BigInteger()),
        sa.Column('atm_put_oi', sa.BigInteger()),
        sa.Column('max_call_oi_strike', sa.Numeric(10, 2)),
        sa.Column('max_call_oi', sa.BigInteger()),
        sa.Column('max_put_oi_strike', sa.Numeric(10, 2)),
        sa.Column('max_put_oi', sa.BigInteger()),
        sa.Column('strike_wise_distribution', postgresql.JSONB()),
        sa.Column('spot_price', sa.Numeric(10, 2)),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()')),
        
        sa.PrimaryKeyConstraint('timestamp', 'symbol_id', 'expiry')
    )
    
    op.create_index('idx_oi_dist_symbol_expiry_time', 'analytics_oi_distribution',
                    ['symbol_id', 'expiry', 'timestamp'])
    
    # 7. Trading opportunities
    op.create_table(
        'analytics_opportunities',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        
        sa.Column('opportunity_type', sa.String(30), nullable=False),
        sa.Column('strategy', sa.String(50)),
        sa.Column('entry_strikes', postgresql.JSONB()),
        sa.Column('entry_price', sa.Numeric(10, 2)),
        sa.Column('spot_at_entry', sa.Numeric(10, 2)),
        sa.Column('max_profit', sa.Numeric(12, 2)),
        sa.Column('max_loss', sa.Numeric(12, 2)),
        sa.Column('risk_reward_ratio', sa.Numeric(6, 2)),
        sa.Column('target_price', sa.Numeric(10, 2)),
        sa.Column('stop_loss', sa.Numeric(10, 2)),
        sa.Column('confidence_score', sa.Numeric(5, 2)),
        sa.Column('time_horizon_minutes', sa.Integer()),
        
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('exit_timestamp', sa.DateTime()),
        sa.Column('exit_price', sa.Numeric(10, 2)),
        sa.Column('actual_profit_loss', sa.Numeric(12, 2)),
        sa.Column('outcome_type', sa.String(20)),
        
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'))
    )
    
    op.create_index('idx_opp_symbol_type_time', 'analytics_opportunities',
                    ['symbol_id', 'opportunity_type', 'timestamp'])
    op.create_index('idx_opp_timestamp', 'analytics_opportunities', ['timestamp'])
    
    # Create hypertables for time-series data
    op.execute("""
        SELECT create_hypertable('analytics_cumulative_oi', 'timestamp',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        );
    """)
    
    op.execute("""
        SELECT create_hypertable('analytics_velocity', 'timestamp',
            chunk_time_interval => INTERVAL '1 day',
            if_not_exists => TRUE
        );
    """)
    
    # ===== Continuous Aggregates for Performance =====
    
    # 1-minute rollup for OI change
    op.execute("""
        CREATE MATERIALIZED VIEW analytics_cumoi_1min
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 minute', timestamp) AS bucket,
            symbol_id,
            strike_price,
            option_type,
            expiry,
            AVG(cumulative_oi_change) AS avg_oi_change,
            MAX(cumulative_oi_change) AS max_oi_change,
            MIN(cumulative_oi_change) AS min_oi_change,
            LAST(current_oi, timestamp) AS latest_oi
        FROM analytics_cumulative_oi
        GROUP BY bucket, symbol_id, strike_price, option_type, expiry;
    """)
    
    # 5-minute rollup
    op.execute("""
        CREATE MATERIALIZED VIEW analytics_cumoi_5min
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('5 minutes', timestamp) AS bucket,
            symbol_id,
            strike_price,
            option_type,
            expiry,
            AVG(cumulative_oi_change) AS avg_oi_change,
            MAX(cumulative_oi_change) AS max_oi_change,
            MIN(cumulative_oi_change) AS min_oi_change,
            LAST(current_oi, timestamp) AS latest_oi
        FROM analytics_cumulative_oi
        GROUP BY bucket, symbol_id, strike_price, option_type, expiry;
    """)
    
    # 15-minute rollup
    op.execute("""
        CREATE MATERIALIZED VIEW analytics_cumoi_15min
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('15 minutes', timestamp) AS bucket,
            symbol_id,
            strike_price,
            option_type,
            expiry,
            AVG(cumulative_oi_change) AS avg_oi_change,
            MAX(cumulative_oi_change) AS max_oi_change,
            MIN(cumulative_oi_change) AS min_oi_change,
            LAST(current_oi, timestamp) AS latest_oi
        FROM analytics_cumulative_oi
        GROUP BY bucket, symbol_id, strike_price, option_type, expiry;
    """)
    
    # 1-hour rollup
    op.execute("""
        CREATE MATERIALIZED VIEW analytics_cumoi_1hour
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('1 hour', timestamp) AS bucket,
            symbol_id,
            strike_price,
            option_type,
            expiry,
            AVG(cumulative_oi_change) AS avg_oi_change,
            MAX(cumulative_oi_change) AS max_oi_change,
            MIN(cumulative_oi_change) AS min_oi_change,
            LAST(current_oi, timestamp) AS latest_oi
        FROM analytics_cumulative_oi
        GROUP BY bucket, symbol_id, strike_price, option_type, expiry;
    """)
    
    # Velocity continuous aggregates
    op.execute("""
        CREATE MATERIALIZED VIEW analytics_velocity_5min
        WITH (timescaledb.continuous) AS
        SELECT
            time_bucket('5 minutes', timestamp) AS bucket,
            symbol_id,
            strike_price,
            option_type,
            expiry,
            AVG(oi_velocity) AS avg_oi_velocity,
            MAX(oi_velocity) AS max_oi_velocity,
            COUNT(*) FILTER (WHERE is_spike = true) AS spike_count
        FROM analytics_velocity
        GROUP BY bucket, symbol_id, strike_price, option_type, expiry;
    """)
    
    # Refresh policies (auto-refresh)
    op.execute("""
        SELECT add_continuous_aggregate_policy('analytics_cumoi_1min',
            start_offset => INTERVAL '1 hour',
            end_offset => INTERVAL '1 minute',
            schedule_interval => INTERVAL '1 minute'
        );
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('analytics_cumoi_5min',
            start_offset => INTERVAL '2 hours',
            end_offset => INTERVAL '5 minutes',
            schedule_interval => INTERVAL '5 minutes'
        );
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('analytics_cumoi_15min',
            start_offset => INTERVAL '6 hours',
            end_offset => INTERVAL '15 minutes',
            schedule_interval => INTERVAL '15 minutes'
        );
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('analytics_cumoi_1hour',
            start_offset => INTERVAL '1 day',
            end_offset => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour'
        );
    """)
    
    op.execute("""
        SELECT add_continuous_aggregate_policy('analytics_velocity_5min',
            start_offset => INTERVAL '2 hours',
            end_offset => INTERVAL '5 minutes',
            schedule_interval => INTERVAL '5 minutes'
        );
    """)
    
    # Compression policies (compress old data)
    op.execute("""
        SELECT add_compression_policy('analytics_cumulative_oi',
            INTERVAL '7 days'
        );
    """)
    
    op.execute("""
        SELECT add_compression_policy('analytics_velocity',
            INTERVAL '7 days'
        );
    """)
    
    # Retention policies (delete very old data)
    op.execute("""
        SELECT add_retention_policy('analytics_cumulative_oi',
            INTERVAL '90 days'
        );
    """)
    
    op.execute("""
        SELECT add_retention_policy('analytics_velocity',
            INTERVAL '90 days'
        );
    """)


def downgrade():
    """Drop analytics tables and hypertables"""
    
    # Drop continuous aggregates first
    op.execute("DROP MATERIALIZED VIEW IF EXISTS analytics_velocity_5min CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS analytics_cumoi_1hour CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS analytics_cumoi_15min CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS analytics_cumoi_5min CASCADE;")
    op.execute("DROP MATERIALIZED VIEW IF EXISTS analytics_cumoi_1min CASCADE;")
    
    # Drop tables
    op.drop_table('analytics_opportunities')
    op.drop_table('analytics_oi_distribution')
    op.drop_table('analytics_greeks_timeline')
    op.drop_table('analytics_patterns')
    op.drop_table('analytics_zones')
    op.drop_table('analytics_velocity')
    op.drop_table('analytics_cumulative_oi')

