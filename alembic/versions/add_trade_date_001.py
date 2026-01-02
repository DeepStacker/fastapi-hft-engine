"""add_trade_date_columns

Revision ID: add_trade_date_001
Revises: 
Create Date: 2026-01-02

Adds trade_date column to option_contracts and market_snapshots tables
for proper historical data querying by trading day.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_trade_date_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Add trade_date column to option_contracts
    op.add_column(
        'option_contracts',
        sa.Column('trade_date', sa.DateTime(), nullable=True)
    )
    
    # Add trade_date column to market_snapshots
    op.add_column(
        'market_snapshots',
        sa.Column('trade_date', sa.DateTime(), nullable=True)
    )
    
    # Create indexes for efficient historical queries
    op.create_index(
        'idx_options_symbol_expiry_date',
        'option_contracts',
        ['symbol_id', 'expiry', 'trade_date']
    )
    
    op.create_index(
        'idx_snapshots_symbol_date',
        'market_snapshots',
        ['symbol_id', 'trade_date']
    )
    
    # Backfill trade_date from timestamp for existing data
    op.execute("""
        UPDATE option_contracts 
        SET trade_date = DATE(timestamp) 
        WHERE trade_date IS NULL
    """)
    
    op.execute("""
        UPDATE market_snapshots 
        SET trade_date = DATE(timestamp) 
        WHERE trade_date IS NULL
    """)


def downgrade():
    # Drop indexes
    op.drop_index('idx_options_symbol_expiry_date', table_name='option_contracts')
    op.drop_index('idx_snapshots_symbol_date', table_name='market_snapshots')
    
    # Drop columns
    op.drop_column('option_contracts', 'trade_date')
    op.drop_column('market_snapshots', 'trade_date')
