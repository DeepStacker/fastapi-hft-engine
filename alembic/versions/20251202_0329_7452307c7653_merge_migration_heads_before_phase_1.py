"""Merge migration heads before Phase 1

Revision ID: 7452307c7653
Revises: 7246071af42f, phase1_20251201
Create Date: 2025-12-02 03:29:15.454040+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '7452307c7653'
down_revision = ('7246071af42f', 'phase1_20251201')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
