"""Add COA history table for Chart of Accuracy timeseries

Revision ID: 20260114_1600_add_coa_history
Revises: 20260114_1530_add_percentage_fields
Create Date: 2026-01-14 16:00:00
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260114_1600_add_coa_history'
down_revision = '20260114_1530_add_percentage_fields'
branch_labels = None
depends_on = None


def upgrade():
    # Create COA history table
    op.create_table(
        'coa_history',
        sa.Column('id', sa.BigInteger(), primary_key=True),
        sa.Column('timestamp', sa.DateTime(), nullable=False, index=True),
        sa.Column('trade_date', sa.DateTime(), nullable=True, index=True),
        sa.Column('symbol_id', sa.Integer(), sa.ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('expiry', sa.String(20), nullable=True, index=True),
        
        # Scenario
        sa.Column('scenario_id', sa.String(10), nullable=False),
        sa.Column('scenario_name', sa.String(50), nullable=True),
        sa.Column('scenario_bias', sa.String(20), nullable=True),
        
        # Support
        sa.Column('support_strength', sa.String(10), nullable=False),
        sa.Column('support_strike', sa.Float(), nullable=True),
        sa.Column('support_strike2nd', sa.Float(), nullable=True),
        sa.Column('support_oi', sa.BigInteger(), nullable=True),
        sa.Column('support_oi_change', sa.BigInteger(), nullable=True),
        sa.Column('support_oi_pct', sa.Float(), nullable=True),
        
        # Resistance
        sa.Column('resistance_strength', sa.String(10), nullable=False),
        sa.Column('resistance_strike', sa.Float(), nullable=True),
        sa.Column('resistance_strike2nd', sa.Float(), nullable=True),
        sa.Column('resistance_oi', sa.BigInteger(), nullable=True),
        sa.Column('resistance_oi_change', sa.BigInteger(), nullable=True),
        sa.Column('resistance_oi_pct', sa.Float(), nullable=True),
        
        # Levels
        sa.Column('eos', sa.Float(), nullable=True),
        sa.Column('eor', sa.Float(), nullable=True),
        sa.Column('spot_price', sa.Float(), nullable=True),
        sa.Column('atm_strike', sa.Float(), nullable=True),
        
        # Flags
        sa.Column('trade_at_eos', sa.Boolean(), default=False),
        sa.Column('trade_at_eor', sa.Boolean(), default=False),
    )
    
    # Create indexes
    op.create_index('idx_coa_symbol_time', 'coa_history', ['symbol_id', 'timestamp'])
    op.create_index('idx_coa_time_symbol', 'coa_history', ['timestamp', 'symbol_id'])
    op.create_index('idx_coa_scenario', 'coa_history', ['symbol_id', 'scenario_id'])
    
    # Convert to TimescaleDB hypertable (if available)
    op.execute("""
        SELECT create_hypertable('coa_history', 'timestamp', 
            if_not_exists => TRUE,
            migrate_data => TRUE
        );
    """)


def downgrade():
    op.drop_table('coa_history')
