"""merge_heads

Revision ID: 7246071af42f
Revises: c6729d6b9573, create_api_gateway_tables
Create Date: 2025-12-01 05:23:17.209542+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7246071af42f'
down_revision = ('c6729d6b9573', 'create_api_gateway_tables')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
