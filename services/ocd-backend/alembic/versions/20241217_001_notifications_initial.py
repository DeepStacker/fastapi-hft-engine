"""create notifications table

Revision ID: 001_notifications
Revises: 
Create Date: 2024-12-17
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '001_notifications'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create notification type enum
    notification_type = postgresql.ENUM(
        'info', 'success', 'warning', 'error', 'trade', 'price',
        name='notificationtype',
        create_type=False
    )
    notification_type.create(op.get_bind(), checkfirst=True)
    
    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', postgresql.ENUM('info', 'success', 'warning', 'error', 'trade', 'price', name='notificationtype', create_type=False), nullable=False, server_default='info'),
        sa.Column('is_read', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('link', sa.String(255), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), onupdate=sa.text('now()'), nullable=False),
    )
    
    # Create indexes
    op.create_index('ix_notifications_user_unread', 'notifications', ['user_id', 'is_read'])
    op.create_index('ix_notifications_user_created', 'notifications', ['user_id', 'created_at'])
    op.create_index('ix_notifications_id', 'notifications', ['id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_notifications_user_created')
    op.drop_index('ix_notifications_user_unread')
    op.drop_index('ix_notifications_id')
    
    # Drop table
    op.drop_table('notifications')
    
    # Drop enum type
    op.execute('DROP TYPE IF EXISTS notificationtype')
