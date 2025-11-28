"""Add indexes and constraints to database tables

Revision ID: 001
Revises: 
Create Date: 2025-11-28 09:06:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add indexes for better query performance
    op.create_index('idx_market_snapshots_exchange', 'market_snapshots', ['exchange'])
    op.create_index('idx_market_snapshots_segment', 'market_snapshots', ['segment'])
    
    op.create_index('idx_option_contracts_option_type', 'option_contracts', ['option_type'])
    op.create_index('idx_option_contracts_expiry', 'option_contracts', ['expiry'])
    
    # Add foreign key constraints
    op.create_foreign_key(
        'fk_market_snapshots_symbol_id',
        'market_snapshots', 'instruments',
        ['symbol_id'], ['symbol_id'],
        ondelete='CASCADE'
    )
    
    op.create_foreign_key(
        'fk_option_contracts_symbol_id',
        'option_contracts', 'instruments',
        ['symbol_id'], ['symbol_id'],
        ondelete='CASCADE'
    )
    
    op.create_foreign_key(
        'fk_future_contracts_symbol_id',
        'future_contracts', 'instruments',
        ['symbol_id'], ['symbol_id'],
        ondelete='CASCADE'
    )
    
    # Add CHECK constraints for data integrity
    op.create_check_constraint(
        'chk_market_snapshots_ltp_positive',
        'market_snapshots',
        'ltp >= 0'
    )
    
    op.create_check_constraint(
        'chk_market_snapshots_volume_nonneg',
        'market_snapshots',
        'volume >= 0'
    )
    
    op.create_check_constraint(
        'chk_option_contracts_ltp_positive',
        'option_contracts',
        'ltp >= 0'
    )
    
    op.create_check_constraint(
        'chk_option_contracts_strike_positive',
        'option_contracts',
        'strike_price > 0'
    )
    
    op.create_check_constraint(
        'chk_option_contracts_type',
        'option_contracts',
        "option_type IN ('CE', 'PE')"
    )


def downgrade() -> None:
    # Drop CHECK constraints
    op.drop_constraint('chk_option_contracts_type', 'option_contracts')
    op.drop_constraint('chk_option_contracts_strike_positive', 'option_contracts')
    op.drop_constraint('chk_option_contracts_ltp_positive', 'option_contracts')
    op.drop_constraint('chk_market_snapshots_volume_nonneg', 'market_snapshots')
    op.drop_constraint('chk_market_snapshots_ltp_positive', 'market_snapshots')
    
    # Drop foreign key constraints
    op.drop_constraint('fk_future_contracts_symbol_id', 'future_contracts')
    op.drop_constraint('fk_option_contracts_symbol_id', 'option_contracts')
    op.drop_constraint('fk_market_snapshots_symbol_id', 'market_snapshots')
    
    # Drop indexes
    op.drop_index('idx_option_contracts_expiry', 'option_contracts')
    op.drop_index('idx_option_contracts_option_type', 'option_contracts')
    op.drop_index('idx_market_snapshots_segment', 'market_snapshots')
    op.drop_index('idx_market_snapshots_exchange', 'market_snapshots')
