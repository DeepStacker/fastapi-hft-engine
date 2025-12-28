"""add_phase1_tables_fii_dii_market_mood_pcr_sr_levels

Revision ID: phase1_20251201
Revises: c6729d6b9573, create_api_gateway_tables
Create Date: 2025-12-01 10:50:00.000000+05:30

Phase 1: Core Data Infrastructure
- Add FII/DII data table for institutional trading activity
- Add Market Mood Index table for sentiment calculations
- Add PCR History table for Put-Call Ratio tracking
- Add Support/Resistance Levels table for level detection
- Add exchange column to instruments table for multi-exchange support
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'phase1_20251201'
down_revision = ('c6729d6b9573', 'create_api_gateway_tables')  # Merge point
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Add exchange column to instruments table
    op.add_column('instruments',
        sa.Column('exchange', sa.String(10), server_default='NSE', nullable=False))
    op.create_index('idx_instrument_exchange', 'instruments', ['exchange'])
    
    # 2. Create fii_dii_data table
    op.create_table(
        'fii_dii_data',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('date', sa.DateTime(), nullable=False),
        sa.Column('category', sa.String(10), nullable=False),
        sa.Column('buy_value', sa.Float(), nullable=True),
        sa.Column('sell_value', sa.Float(), nullable=True),
        sa.Column('net_value', sa.Float(), nullable=True),
        sa.Column('buy_contracts', sa.BigInteger(), nullable=True),
        sa.Column('sell_contracts', sa.BigInteger(), nullable=True),
        sa.Column('oi_contracts', sa.BigInteger(), nullable=True),
        sa.Column('source', sa.String(50), server_default='NSE', nullable=True),
        sa.Column('raw_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("category IN ('FII', 'DII', 'PRO', 'CLIENT')", name='chk_valid_category')
    )
    op.create_index('idx_fiidii_date', 'fii_dii_data', ['date'])
    op.create_index('idx_fiidii_category', 'fii_dii_data', ['category'])
    op.create_index('idx_fiidii_date_category', 'fii_dii_data', ['date', 'category'])
    
    # 3. Create market_mood_index table
    op.create_table(
        'market_mood_index',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('mood_score', sa.Float(), nullable=False),
        sa.Column('sentiment', sa.String(20), nullable=False),
        sa.Column('pcr_score', sa.Float(), nullable=True),
        sa.Column('oi_distribution_score', sa.Float(), nullable=True),
        sa.Column('fii_activity_score', sa.Float(), nullable=True),
        sa.Column('price_momentum_score', sa.Float(), nullable=True),
        sa.Column('iv_change_score', sa.Float(), nullable=True),
        sa.Column('pcr', sa.Float(), nullable=True),
        sa.Column('vix_value', sa.Float(), nullable=True),
        sa.Column('advance_decline_ratio', sa.Float(), nullable=True),
        sa.Column('fii_activity', sa.Float(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('version', sa.String(10), server_default='1.0'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['symbol_id'], ['instruments.symbol_id'], ondelete='CASCADE'),
        sa.CheckConstraint('mood_score >= -100 AND mood_score <= 100', name='chk_mood_score_range'),
        sa.CheckConstraint(
            "sentiment IN ('EXTREME_FEAR', 'FEAR', 'NEUTRAL', 'GREED', 'EXTREME_GREED')",
            name='chk_valid_sentiment'
        )
    )
    op.create_index('idx_mood_time_symbol', 'market_mood_index', ['timestamp', 'symbol_id'])
    op.create_index('idx_mood_sentiment', 'market_mood_index', ['sentiment'])
    
    # 4. Create pcr_history table
    op.create_table(
        'pcr_history',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('expiry', sa.String(20), nullable=False),
        sa.Column('pcr_oi', sa.Float(), nullable=False),
        sa.Column('pcr_volume', sa.Float(), nullable=False),
        sa.Column('total_call_oi', sa.BigInteger(), server_default='0'),
        sa.Column('total_put_oi', sa.BigInteger(), server_default='0'),
        sa.Column('total_call_volume', sa.BigInteger(), server_default='0'),
        sa.Column('total_put_volume', sa.BigInteger(), server_default='0'),
        sa.Column('pcr_oi_change', sa.Float(), nullable=True),
        sa.Column('pcr_volume_change', sa.Float(), nullable=True),
        sa.Column('strike_distribution', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('max_pain_strike', sa.Float(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['symbol_id'], ['instruments.symbol_id'], ondelete='CASCADE'),
        sa.CheckConstraint('pcr_oi >= 0', name='chk_pcr_oi_nonneg'),
        sa.CheckConstraint('pcr_volume >= 0', name='chk_pcr_volume_nonneg')
    )
    op.create_index('idx_pcr_time_symbol', 'pcr_history', ['timestamp', 'symbol_id'])
    op.create_index('idx_pcr_symbol_expiry', 'pcr_history', ['symbol_id', 'expiry'])
    op.create_index('idx_pcr_timestamp', 'pcr_history', ['timestamp'])
    
    # 5. Create support_resistance_levels table
    op.create_table(
        'support_resistance_levels',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('timestamp', sa.DateTime(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('expiry', sa.String(20), nullable=False),
        sa.Column('level_type', sa.String(10), nullable=False),
        sa.Column('price', sa.Float(), nullable=False),
        sa.Column('strength', sa.Integer(), nullable=False),
        sa.Column('confidence', sa.Float(), server_default='50.0'),
        sa.Column('source', sa.String(20), nullable=False),
        sa.Column('total_oi', sa.BigInteger(), nullable=True),
        sa.Column('call_oi', sa.BigInteger(), nullable=True),
        sa.Column('put_oi', sa.BigInteger(), nullable=True),
        sa.Column('oi_buildup_pct', sa.Float(), nullable=True),
        sa.Column('zone_lower', sa.Float(), nullable=True),
        sa.Column('zone_upper', sa.Float(), nullable=True),
        sa.Column('metadata', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('is_breached', sa.Boolean(), server_default='false'),
        sa.Column('breached_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['symbol_id'], ['instruments.symbol_id'], ondelete='CASCADE'),
        sa.CheckConstraint("level_type IN ('SUPPORT', 'RESISTANCE')", name='chk_valid_level_type'),
        sa.CheckConstraint('strength >= 1 AND strength <= 10', name='chk_strength_range'),
        sa.CheckConstraint('confidence >= 0 AND confidence <= 100', name='chk_confidence_range'),
        sa.CheckConstraint(
            "source IN ('OI_MAX', 'OI_BUILDUP', 'PRICE_ACTION', 'COMBINED')",
            name='chk_valid_source'
        )
    )
    op.create_index('idx_sr_time_symbol', 'support_resistance_levels', ['timestamp', 'symbol_id'])
    op.create_index('idx_sr_symbol_expiry_type', 'support_resistance_levels', ['symbol_id', 'expiry', 'level_type'])
    op.create_index('idx_sr_active_levels', 'support_resistance_levels', ['is_active', 'symbol_id'])
    op.create_index('idx_sr_price', 'support_resistance_levels', ['price'])
    
    # 6. Convert tables to TimescaleDB hypertables (for time-series optimization)
    # Note: This requires TimescaleDB extension to be enabled
    op.execute("""
        SELECT create_hypertable('market_mood_index', 'timestamp', 
            if_not_exists => TRUE,
            migrate_data => TRUE
        );
    """)
    
    op.execute("""
        SELECT create_hypertable('pcr_history', 'timestamp',
            if_not_exists => TRUE,
            migrate_data => TRUE
        );
    """)
    
    op.execute("""
        SELECT create_hypertable('support_resistance_levels', 'timestamp',
            if_not_exists => TRUE,
            migrate_data => TRUE
        );
    """)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_table('support_resistance_levels')
    op.drop_table('pcr_history')
    op.drop_table('market_mood_index')
    op.drop_table('fii_dii_data')
    
    # Drop exchange column from instruments
    op.drop_index('idx_instrument_exchange', 'instruments')
    op.drop_column('instruments', 'exchange')
