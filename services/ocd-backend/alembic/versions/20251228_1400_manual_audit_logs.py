"""add admin_audit_logs table

Revision ID: manual_audit_logs
Revises: 001_notifications_initial
Create Date: 2025-12-28 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'manual_audit_logs'
down_revision = '001_notifications'
branch_labels = None
depends_on = None

def upgrade():
    op.create_table('admin_audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('timestamp', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('actor_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('resource_type', sa.String(50), nullable=False),
        sa.Column('resource_id', sa.String(128), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='success'),
    )
    op.create_index('ix_admin_audit_actor_time', 'admin_audit_logs', ['actor_id', 'timestamp'])
    op.create_index('ix_admin_audit_resource', 'admin_audit_logs', ['resource_type', 'resource_id'])

def downgrade():
    op.drop_table('admin_audit_logs')
