-- ============================================================================
-- Database Index Optimization Script for Stockify HFT Engine
-- ============================================================================
-- Purpose: Optimize query performance for time-series data
-- Expected Impact: 50-70% faster queries
-- Execution Time: ~5-10 minutes (CONCURRENTLY prevents table locks)
-- ============================================================================

-- Enable timing to see execution duration
\timing on

-- Show current database stats
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

\echo '\n====== Creating Composite Indexes ======\n'

-- ============================================================================
-- 1. Market Snapshots Indexes
-- ============================================================================

\echo 'Creating index: idx_market_snapshots_symbol_time...'
-- Most common query pattern: WHERE symbol_id = X ORDER BY timestamp DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_snapshots_symbol_time 
ON market_snapshots (symbol_id, timestamp DESC);

\echo 'Creating index: idx_market_snapshots_time_symbol...'
-- Time-range queries across all symbols
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_snapshots_time_symbol 
ON market_snapshots (timestamp DESC, symbol_id);

-- ============================================================================
-- 2. Option Contracts Indexes
-- ============================================================================

\echo 'Creating index: idx_option_contracts_composite...'
-- Common option chain queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_option_contracts_composite
ON option_contracts (
    underlying_symbol_id,
    expiry_date,
    strike_price,
    option_type,
    timestamp DESC
);

\echo 'Creating index: idx_option_contracts_time...'
-- Time-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_option_contracts_time 
ON option_contracts (timestamp DESC);

-- ============================================================================
-- 3. BRIN Indexes for Time-Series Columns
-- ============================================================================
-- BRIN (Block Range INdex) is very efficient for time-series data
-- Uses minimal storage while providing good performance

\echo 'Creating BRIN index: idx_market_snapshots_time_brin...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_snapshots_time_brin 
ON market_snapshots USING BRIN (timestamp);

\echo 'Creating BRIN index: idx_option_contracts_time_brin...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_option_contracts_time_brin 
ON option_contracts USING BRIN (timestamp);

-- ============================================================================
-- 4. Partial Indexes for Recent Data (Most Queried)
-- ============================================================================
-- Index only last 7 days of data for ultra-fast recent queries

\echo 'Creating partial index: idx_market_snapshots_recent...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_market_snapshots_recent 
ON market_snapshots (symbol_id, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '7 days';

\echo 'Creating partial index: idx_option_contracts_recent...'
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_option_contracts_recent 
ON option_contracts (underlying_symbol_id, expiry_date, timestamp DESC)
WHERE timestamp > NOW() - INTERVAL '7 days';

-- ============================================================================
-- 5. Enable Parallel Query Execution
-- ============================================================================

\echo 'Enabling parallel workers...'
ALTER TABLE market_snapshots SET (parallel_workers = 4);
ALTER TABLE option_contracts SET (parallel_workers = 4);

-- ============================================================================
-- 6. Update Table Statistics for Query Planner
-- ============================================================================

\echo 'Analyzing tables to update statistics...'
ANALYZE market_snapshots;
ANALYZE option_contracts;

-- ============================================================================
-- 7. Show Index Information
-- ============================================================================

\echo '\n====== Index Summary ======\n'

SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) AS index_size,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched
FROM pg_indexes
JOIN pg_stat_user_indexes USING (schemaname, tablename, indexname)
WHERE schemaname = 'public'
  AND tablename IN ('market_snapshots', 'option_contracts')
ORDER BY tablename, indexname;

-- ============================================================================
-- 8. Verify TimescaleDB Hypertable Settings
-- ============================================================================

\echo '\n====== Hypertable Information ======\n'

SELECT
    hypertable_name,
    num_dimensions,
    num_chunks,
    compression_enabled,
    pg_size_pretty(total_bytes) AS total_size,
    pg_size_pretty(index_bytes) AS index_size
FROM timescaledb_information.hypertables
LEFT JOIN timescaledb_information.compressed_hypertable_stats USING (hypertable_name);

-- ============================================================================
-- Performance Testing Queries
-- ============================================================================

\echo '\n====== Running Test Queries ======\n'

-- Test 1: Latest snapshot for symbol (should use idx_market_snapshots_symbol_time)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM market_snapshots
WHERE symbol_id = 13
ORDER BY timestamp DESC
LIMIT 1;

-- Test 2: Time range query (should use BRIN or composite index)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM market_snapshots
WHERE symbol_id = 13
  AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;

-- Test 3: Option chain query (should use idx_option_contracts_composite)
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM option_contracts
WHERE underlying_symbol_id = 13
  AND expiry_date = '2025-12-05'
  AND timestamp > NOW() - INTERVAL '1 day'
ORDER BY strike_price;

\echo '\n====== Optimization Complete ======\n'
\echo 'Expected improvements:'
\echo '- Query execution time: 50-70% faster'
\echo '- Index scan efficiency: +70%'
\echo '- Recent data queries: 80%+ faster (partial indexes)'
\echo '\n'
\echo 'Monitor query performance in Grafana dashboard'
\echo 'Check slow query logs: SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;'
