"""
Phase 2 Analytics: Cache and Pattern Tables

Creates tables for:
1. Analytics cache - for caching expensive calculations
2. Buildup patterns - for tracking OI/Volume buildups over time
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = '20251202_1109_phase_2_analytics'
down_revision = 'fab0a8b6b28c'  # Previous migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create analytics cache table
    op.create_table(
        'analytics_cache',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cache_key', sa.String(length=255), nullable=False),
        sa.Column('endpoint', sa.String(length=100), nullable=False),
        sa.Column('data', postgresql.JSONB(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=False),
        sa.Column('hit_count', sa.Integer(), server_default='0', nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cache_key')
    )
    op.create_index('idx_analytics_cache_key', 'analytics_cache', ['cache_key'])
    op.create_index('idx_analytics_cache_expires', 'analytics_cache', ['expires_at'])
    op.create_index('idx_analytics_cache_endpoint', 'analytics_cache', ['endpoint'])
    
    # Create buildup patterns table
    op.create_table(
        'buildup_patterns',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('strike', sa.Float(), nullable=False),
        sa.Column('option_type', sa.String(length=2), nullable=False),
        sa.Column('expiry', sa.Date(), nullable=False),
        sa.Column('pattern', sa.String(length=2), nullable=False),  # LB/SB/LU/SU
        sa.Column('confidence', sa.Float(), nullable=False),
        sa.Column('oi_change_pct', sa.Float(), nullable=False),
        sa.Column('price_change_pct', sa.Float(), nullable=False),
        sa.Column('volume_surge', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('detected_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('metadata', postgresql.JSONB(), server_default='{}', nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_buildup_patterns_symbol', 'buildup_patterns', ['symbol_id', 'expiry'])
    op.create_index('idx_buildup_patterns_strike', 'buildup_patterns', ['strike', 'option_type'])
    op.create_index('idx_buildup_patterns_detected', 'buildup_patterns', ['detected_at'])
    op.create_index('idx_buildup_patterns_active', 'buildup_patterns', ['is_active'])


def downgrade() -> None:
    # Drop buildup patterns table
    op.drop_index('idx_buildup_patterns_active', table_name='buildup_patterns')
    op.drop_index('idx_buildup_patterns_detected', table_name='buildup_patterns')
    op.drop_index('idx_buildup_patterns_strike', table_name='buildup_patterns')
    op.drop_index('idx_buildup_patterns_symbol', table_name='buildup_patterns')
    op.drop_table('buildup_patterns')
    
    # Drop analytics cache table
    op.drop_index('idx_analytics_cache_endpoint', table_name='analytics_cache')
    op.drop_index('idx_analytics_cache_expires', table_name='analytics_cache')
    op.drop_index('idx_analytics_cache_key', table_name='analytics_cache')
    op.drop_table('analytics_cache')
