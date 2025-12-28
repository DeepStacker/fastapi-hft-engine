-- Stockify Trading Platform - PostgreSQL Initialization
-- This script runs on first container startup

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create extension for better text search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- You can add initial data or additional setup here
-- The actual tables are created by SQLAlchemy/Alembic migrations
