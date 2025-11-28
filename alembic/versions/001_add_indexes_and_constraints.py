"""
Initial Schema

Revision ID: 5a55fb6f07b6
Revises: 
Create Date: 2025-11-28 03:37:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '133b19ff9bd6'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # Assuming schema is already created by initial setup or previous runs
    pass

def downgrade() -> None:
    pass
