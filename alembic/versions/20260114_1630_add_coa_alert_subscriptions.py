"""Add COA alert subscriptions table

Revision ID: 20260114_1630
Create Date: 2026-01-14 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '20260114_1630'
down_revision = '20260114_1600_add_coa_history'  # Previous COA history migration
branch_labels = None
depends_on = None


def upgrade():
    """Create coa_alert_subscriptions table"""
    op.create_table(
        'coa_alert_subscriptions',
        sa.Column('id', sa.BigInteger(), primary_key=True, index=True),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('app_users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('symbol_id', sa.Integer(), sa.ForeignKey('instruments.symbol_id', ondelete='CASCADE'), nullable=False, index=True),
        
        # Alert settings
        sa.Column('enabled', sa.Boolean(), default=True, nullable=False),
        sa.Column('alert_on_scenario_change', sa.Boolean(), default=True),
        sa.Column('alert_on_strength_change', sa.Boolean(), default=False),
        sa.Column('alert_on_eos_eor_breach', sa.Boolean(), default=False),
        
        # Thresholds
        sa.Column('min_scenario_change', sa.Float(), default=0.1),
        
        # Notification preferences
        sa.Column('notify_in_app', sa.Boolean(), default=True),
        sa.Column('notify_push', sa.Boolean(), default=True),
        sa.Column('notify_email', sa.Boolean(), default=False),
        
        # Tracking
        sa.Column('last_scenario', sa.String(10), nullable=True),
        sa.Column('last_alert_at', sa.DateTime(), nullable=True),
        
        # Timestamps
        sa.Column('created_at', sa.DateTime(), default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create unique index for user+symbol combination
    op.create_index(
        'idx_coa_sub_user_symbol',
        'coa_alert_subscriptions',
        ['user_id', 'symbol_id'],
        unique=True
    )
    
    # Create index for enabled subscriptions by symbol
    op.create_index(
        'idx_coa_sub_enabled',
        'coa_alert_subscriptions',
        ['enabled', 'symbol_id']
    )


def downgrade():
    """Drop coa_alert_subscriptions table"""
    op.drop_index('idx_coa_sub_enabled', table_name='coa_alert_subscriptions')
    op.drop_index('idx_coa_sub_user_symbol', table_name='coa_alert_subscriptions')
    op.drop_table('coa_alert_subscriptions')
