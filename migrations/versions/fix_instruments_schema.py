"""
Alembic Migration: Fix Instruments Schema

Revision ID: fix_instruments_schema
Create Date: 2025-11-29

Changes:
- Rename 'segment' column to 'segment_id' 
- Change type from VARCHAR(10) to INTEGER
- Remove columns: exchange, isin, company_name, sector, industry, lot_size, tick_size
- Add constraint: segment_id IN (0, 1, 5)
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# Revision identifiers
revision = 'fix_instruments_schema'
down_revision = None  # Replace with actual down revision if exists
branch_labels = None
depends_on = None


def upgrade():
    # 1. Drop old indexes that reference columns we're removing
    op.drop_index('idx_instrument_exchange_segment', table_name='instruments')
    
    # 2. Drop check constraint if it exists
    try:
        op.drop_constraint('chk_lot_size_positive', 'instruments', type_='check')
    except:
        pass
    
    # 3. Remove unnecessary columns
    with op.batch_alter_table('instruments', schema=None) as batch_op:
        batch_op.drop_column('exchange')
        batch_op.drop_column('isin', if_exists=True)
        batch_op.drop_column('company_name', if_exists=True)
        batch_op.drop_column('sector', if_exists=True)
        batch_op.drop_column('industry', if_exists=True)
        batch_op.drop_column('lot_size', if_exists=True)
        batch_op.drop_column('tick_size', if_exists=True)
    
    #4. Rename and change segment column type
    # Step 1: Add new column
    op.add_column('instruments', sa.Column('segment_id', sa.Integer(), nullable=True))
    
    # Step 2: Migrate data (if any exists)
    # Map string segments to integers:
    # 'FO', 'IDX' -> 0 (Indices)
    # 'EQ', 'STK' -> 1 (Stocks)
    # 'COM', 'MCX' -> 5 (Commodities)
    op.execute("""
        UPDATE instruments
        SET segment_id = CASE
            WHEN segment IN ('FO', 'IDX', 'INDEX') THEN 0
            WHEN segment IN ('EQ', 'STK', 'STOCK') THEN 1
            WHEN segment IN ('COM', 'MCX', 'COMMODITY') THEN 5
            ELSE 1
        END
        WHERE segment_id IS NULL
    """)
    
    # Step 3: Make it non-nullable and add constraint
    op.alter_column('instruments', 'segment_id', nullable=False)
    op.create_check_constraint(
        'chk_valid_segment',
        'instruments',
        'segment_id IN (0, 1, 5)'
    )
    
    # Step 4: Remove old segment column
    op.drop_column('instruments', 'segment')
    
    # 5. Create new index on segment_id
    op.create_index('idx_instrument_segment', 'instruments', ['segment_id'])


def downgrade():
    """Revert changes"""
    # 1. Drop new index
    op.drop_index('idx_instrument_segment', table_name='instruments')
    
    # 2. Drop check constraint
    op.drop_constraint('chk_valid_segment', 'instruments', type_='check')
    
    # 3. Add back segment as VARCHAR and migrate data
    op.add_column('instruments', sa.Column('segment', sa.VARCHAR(length=10), nullable=True))
    
    op.execute("""
        UPDATE instruments
        SET segment = CASE
            WHEN segment_id = 0 THEN 'IDX'
            WHEN segment_id = 1 THEN 'EQ'
            WHEN segment_id = 5 THEN 'COM'
            ELSE 'EQ'
        END
    """)
    
    op.alter_column('instruments', 'segment', nullable=False)
    
    # 4. Drop segment_id
    op.drop_column('instruments', 'segment_id')
    
    # 5. Add back removed columns (with default/null values)
    op.add_column('instruments', sa.Column('exchange', sa.VARCHAR(length=10), nullable=True))
    op.add_column('instruments', sa.Column('lot_size', sa.Integer(), server_default='1'))
    op.add_column('instruments', sa.Column('tick_size', sa.Float(), server_default='0.05'))
    
    # Make exchange non-nullable and set default
    op.execute("UPDATE instruments SET exchange = 'NSE' WHERE exchange IS NULL")
    op.alter_column('instruments', 'exchange', nullable=False)
    
    # 6. Recreate old indexes and constraints
    op.create_index('idx_instrument_exchange_segment', 'instruments', ['exchange', 'segment'])
    op.create_check_constraint('chk_lot_size_positive', 'instruments', 'lot_size > 0')
