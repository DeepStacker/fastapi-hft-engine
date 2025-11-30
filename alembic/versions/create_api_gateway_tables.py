"""create_api_gateway_tables

Revision ID: create_api_gateway_tables
Create Date: 2025-11-30

Create API Gateway tables for B2B data distribution:
- api_keys: API key management with tiered access
- api_usage_logs: Request logging for analytics
- api_tiers: Tier configuration
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from datetime import datetime

# revision identifiers
revision = 'create_api_gateway_tables'
down_revision = 'create_analytics_tables'
branch_labels = None
depends_on = None


def upgrade():
    """Create API Gateway tables"""
    
    # 1. API Tiers configuration
    op.create_table(
        'api_tiers',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('tier_name', sa.String(20), unique=True, nullable=False),
        sa.Column('display_name', sa.String(50)),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=False),
        sa.Column('rate_limit_per_day', sa.Integer()),
        sa.Column('max_historical_days', sa.Integer(), default=7),
        sa.Column('realtime_access', sa.Boolean(), default=True),
        sa.Column('historical_access', sa.Boolean(), default=True),
        sa.Column('analytics_access', sa.Boolean(), default=True),
        sa.Column('webhook_support', sa.Boolean(), default=False),
        sa.Column('monthly_price_usd', sa.Numeric(10, 2)),
        sa.Column('description', sa.String(500)),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'))
    )
    
    # 2. API Keys
    op.create_table(
        'api_keys',
        sa.Column('id', sa.Integer(), autoincrement=True, primary_key=True),
        sa.Column('key', sa.String(64), unique=True, nullable=False),
        sa.Column('key_name', sa.String(100), nullable=False),
        sa.Column('client_name', sa.String(100), nullable=False),
        sa.Column('contact_email', sa.String(200)),
        sa.Column('tier', sa.String(20), nullable=False),
        sa.Column('rate_limit_per_minute', sa.Integer(), nullable=False),
        sa.Column('rate_limit_per_day', sa.Integer()),
        sa.Column('allowed_symbols', postgresql.JSONB()),
        sa.Column('allowed_endpoints', postgresql.JSONB()),
        sa.Column('max_historical_days', sa.Integer(), default=7),
        sa.Column('total_requests', sa.BigInteger(), default=0),
        sa.Column('total_bytes_transferred', sa.BigInteger(), default=0),
        sa.Column('last_used_at', sa.DateTime()),
        sa.Column('requests_today', sa.Integer(), default=0),
        sa.Column('last_reset_date', sa.DateTime(), server_default=sa.text('now()')),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime()),
        sa.Column('notes', sa.String(500)),
        sa.Column('created_by', sa.String(100))
    )
    
    # Indexes for api_keys
    op.create_index('idx_api_keys_key', 'api_keys', ['key'])
    op.create_index('idx_api_keys_tier', 'api_keys', ['tier'])
    op.create_index('idx_api_keys_active', 'api_keys', ['is_active'])
    
    # 3. API Usage Logs
    op.create_table(
        'api_usage_logs',
        sa.Column('id', sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column('api_key_id', sa.Integer(), nullable=False),
        sa.Column('timestamp', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('endpoint', sa.String(200), nullable=False),
        sa.Column('method', sa.String(10)),
        sa.Column('query_params', postgresql.JSONB()),
        sa.Column('path_params', postgresql.JSONB()),
        sa.Column('status_code', sa.Integer()),
        sa.Column('response_time_ms', sa.Integer()),
        sa.Column('bytes_transferred', sa.Integer()),
        sa.Column('ip_address', sa.String(45)),
        sa.Column('user_agent', sa.String(500)),
        sa.Column('error_message', sa.String(500))
    )
    
    # Indexes for api_usage_logs
    op.create_index('idx_usage_logs_api_key', 'api_usage_logs', ['api_key_id'])
    op.create_index('idx_usage_logs_timestamp', 'api_usage_logs', ['timestamp'])
    op.create_index('idx_usage_logs_endpoint', 'api_usage_logs', ['endpoint'])
    
    # Insert default tiers
    connection = op.get_bind()
    connection.execute(
        sa.text("""
            INSERT INTO api_tiers (tier_name, display_name, rate_limit_per_minute, rate_limit_per_day, 
                                   max_historical_days, realtime_access, historical_access, analytics_access, 
                                   webhook_support, monthly_price_usd, description, is_active)
            VALUES 
                ('free', 'Free Tier', 10, 1000, 0, true, false, false, false, 0, 
                 'Limited access for testing and evaluation', true),
                ('basic', 'Basic', 100, 10000, 7, true, true, true, false, 99, 
                 'Standard access for small applications', true),
                ('pro', 'Professional', 1000, 100000, 30, true, true, true, true, 499, 
                 'Advanced features for professional traders', true),
                ('enterprise', 'Enterprise', 10000, NULL, 365, true, true, true, true, NULL, 
                 'Unlimited access with dedicated support and SLA', true)
        """)
    )


def downgrade():
    """Drop API Gateway tables"""
    op.drop_table('api_usage_logs')
    op.drop_table('api_keys')
    op.drop_table('api_tiers')
