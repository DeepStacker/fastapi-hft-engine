"""add_analysis_columns

Revision ID: c6729d6b9573
Revises: b13bd82eabba
Create Date: 2025-11-30 02:52:08.525376+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'c6729d6b9573'
down_revision = 'b13bd82eabba'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add JSON columns to option_contracts table
    op.add_column('option_contracts', 
        sa.Column('order_flow_analysis', sa.JSON(), nullable=True))
    op.add_column('option_contracts', 
        sa.Column('smart_money_analysis', sa.JSON(), nullable=True))
    op.add_column('option_contracts', 
        sa.Column('liquidity_analysis', sa.JSON(), nullable=True))
    
    # Add JSON columns to market_snapshots table
    op.add_column('market_snapshots', 
        sa.Column('gex_analysis', sa.JSON(), nullable=True))
    op.add_column('market_snapshots', 
        sa.Column('iv_skew_analysis', sa.JSON(), nullable=True))
    op.add_column('market_snapshots', 
        sa.Column('pcr_analysis', sa.JSON(), nullable=True))
    op.add_column('market_snapshots', 
        sa.Column('market_wide_analysis', sa.JSON(), nullable=True))
    
    # Create GIN indexes for fast JSON queries (PostgreSQL-specific)
    # Note: CONCURRENTLY requires running outside transaction, skip for now
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_option_order_flow_gin 
        ON option_contracts USING GIN (order_flow_analysis);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_option_smart_money_gin 
        ON option_contracts USING GIN (smart_money_analysis);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_option_liquidity_gin 
        ON option_contracts USING GIN (liquidity_analysis);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_snapshot_gex_gin 
        ON market_snapshots USING GIN (gex_analysis);
    """)


def downgrade() -> None:
    # Drop indexes
    op.execute("DROP INDEX IF EXISTS idx_option_order_flow_gin")
    op.execute("DROP INDEX IF EXISTS idx_option_smart_money_gin")
    op.execute("DROP INDEX IF EXISTS idx_option_liquidity_gin")
    op.execute("DROP INDEX IF EXISTS idx_snapshot_gex_gin")
    
    # Drop columns from market_snapshots
    op.drop_column('market_snapshots', 'market_wide_analysis')
    op.drop_column('market_snapshots', 'pcr_analysis')
    op.drop_column('market_snapshots', 'iv_skew_analysis')
    op.drop_column('market_snapshots', 'gex_analysis')
    
    # Drop columns from option_contracts
    op.drop_column('option_contracts', 'liquidity_analysis')
    op.drop_column('option_contracts', 'smart_money_analysis')
    op.drop_column('option_contracts', 'order_flow_analysis')
