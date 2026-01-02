-- Performance Indexes for Historical Data Queries
-- Target: Sub-millisecond response times
-- Run this migration on TimescaleDB

-- 1. Covering index for market_snapshots queries
-- Optimizes: get_available_dates, get_available_times, get_snapshot_at_time
CREATE INDEX IF NOT EXISTS idx_market_snapshots_symbol_timestamp 
ON market_snapshots (symbol_id, timestamp DESC);

-- 2. Index for option_contracts time-range queries
-- Optimizes: get_snapshot_at_time contract fetching
CREATE INDEX IF NOT EXISTS idx_option_contracts_symbol_expiry_time 
ON option_contracts (symbol_id, expiry, timestamp DESC);

-- 3. Index for strike-level queries
CREATE INDEX IF NOT EXISTS idx_option_contracts_strike_lookup 
ON option_contracts (symbol_id, strike_price, option_type, timestamp DESC);

-- 4. Symbol lookup index (if not exists)
CREATE INDEX IF NOT EXISTS idx_instruments_symbol 
ON instruments (symbol);

-- 5. TimescaleDB hypertable compression (for older data)
-- Uncomment if using TimescaleDB compression
-- SELECT add_compression_policy('market_snapshots', INTERVAL '7 days');
-- SELECT add_compression_policy('option_contracts', INTERVAL '7 days');

-- Analyze tables to update query planner statistics
ANALYZE market_snapshots;
ANALYZE option_contracts;
ANALYZE instruments;
