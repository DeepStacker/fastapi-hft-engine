"""Add percentage fields to option_contracts

Revision ID: 20260114_1530_add_percentage_fields
Revises: 20260103_1429_2a40ea397f7b_add_community_tables
Create Date: 2026-01-14 15:30:00

Adds oi_pct, volume_pct, oichng_pct, oi_rank columns to option_contracts
for Chart of Accuracy percentage-based analysis.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260114_1530_add_percentage_fields'
down_revision = '2a40ea397f7b'
branch_labels = None
depends_on = None


def upgrade():
    """Add percentage columns to option_contracts"""
    # Add oi_pct column
    op.add_column(
        'option_contracts',
        sa.Column('oi_pct', sa.Float(), nullable=True)
    )
    
    # Add volume_pct column
    op.add_column(
        'option_contracts',
        sa.Column('volume_pct', sa.Float(), nullable=True)
    )
    
    # Add oichng_pct column
    op.add_column(
        'option_contracts',
        sa.Column('oichng_pct', sa.Float(), nullable=True)
    )
    
    # Add oi_rank column
    op.add_column(
        'option_contracts',
        sa.Column('oi_rank', sa.Integer(), nullable=True)
    )


def downgrade():
    """Remove percentage columns from option_contracts"""
    op.drop_column('option_contracts', 'oi_rank')
    op.drop_column('option_contracts', 'oichng_pct')
    op.drop_column('option_contracts', 'volume_pct')
    op.drop_column('option_contracts', 'oi_pct')
