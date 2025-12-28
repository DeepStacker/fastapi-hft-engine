"""Phase 1: User authentication and management tables

Revision ID: fab0a8b6b28c
Revises: 7452307c7653
Create Date: 2025-12-02 03:29:25.219692+00:00

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fab0a8b6b28c'
down_revision = '7452307c7653'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create end_users table
    op.create_table(
        'end_users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('firebase_uid', sa.String(length=128), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('display_name', sa.String(length=255), nullable=True),
        sa.Column('subscription_tier', sa.String(length=50), server_default='free', nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('last_login', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('firebase_uid'),
        sa.UniqueConstraint('email')
    )
    op.create_index('idx_end_users_firebase_uid', 'end_users', ['firebase_uid'])
    op.create_index('idx_end_users_email', 'end_users', ['email'])
    
    # Create end_user_api_keys table
    op.create_table(
        'end_user_api_keys',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('key_hash', sa.String(length=255), nullable=False),
        sa.Column('key_prefix', sa.String(length=20), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=True),
        sa.Column('tier', sa.String(length=50), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('rate_limit', sa.Integer(), server_default='100', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column('last_used', sa.TIMESTAMP(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['end_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('key_hash')
    )
    op.create_index('idx_end_user_api_keys_user_id', 'end_user_api_keys', ['user_id'])
    op.create_index('idx_end_user_api_keys_key_hash', 'end_user_api_keys', ['key_hash'])
    
    # Create end_user_preferences table
    op.create_table(
        'end_user_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('default_symbol_id', sa.Integer(), server_default='13', nullable=False),
        sa.Column('default_expiry_offset', sa.Integer(), server_default='0', nullable=False),
        sa.Column('theme', sa.String(length=20), server_default='system', nullable=False),
        sa.Column('auto_refresh_interval', sa.Integer(), server_default='5000', nullable=False),
        sa.Column('notification_email', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('notification_push', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('timezone', sa.String(length=50), server_default='Asia/Kolkata', nullable=False),
        sa.Column('preferences_json', sa.JSON(), server_default='{}', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['end_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
    )
    op.create_index('idx_end_user_preferences_user_id', 'end_user_preferences', ['user_id'])
    
    # Create end_user_watchlists table
    op.create_table(
        'end_user_watchlists',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('is_default', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['end_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'name')
    )
    op.create_index('idx_end_user_watchlists_user_id', 'end_user_watchlists', ['user_id'])
    
    # Create end_user_watchlist_items table
    op.create_table(
        'end_user_watchlist_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('watchlist_id', sa.Integer(), nullable=False),
        sa.Column('symbol_id', sa.Integer(), nullable=False),
        sa.Column('added_at', sa.TIMESTAMP(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['watchlist_id'], ['end_user_watchlists.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('watchlist_id', 'symbol_id')
    )
    op.create_index('idx_end_user_watchlist_items_watchlist_id', 'end_user_watchlist_items', ['watchlist_id'])


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('idx_end_user_watchlist_items_watchlist_id', table_name='end_user_watchlist_items')
    op.drop_table('end_user_watchlist_items')
    
    op.drop_index('idx_end_user_watchlists_user_id', table_name='end_user_watchlists')
    op.drop_table('end_user_watchlists')
    
    op.drop_index('idx_end_user_preferences_user_id', table_name='end_user_preferences')
    op.drop_table('end_user_preferences')
    
    op.drop_index('idx_end_user_api_keys_key_hash', table_name='end_user_api_keys')
    op.drop_index('idx_end_user_api_keys_user_id', table_name='end_user_api_keys')
    op.drop_table('end_user_api_keys')
    
    op.drop_index('idx_end_users_email', table_name='end_users')
    op.drop_index('idx_end_users_firebase_uid', table_name='end_users')
    op.drop_table('end_users')

