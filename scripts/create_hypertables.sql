-- TimescaleDB Optimized Schema
-- Run this after DROP TABLE commands complete

-- 1. Create option_contracts as hypertable
CREATE TABLE option_contracts (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    trade_date DATE NOT NULL,
    symbol_id INTEGER NOT NULL,
    expiry VARCHAR(20) NOT NULL,
    strike_price FLOAT NOT NULL,
    option_type VARCHAR(2) NOT NULL,
    
    -- Price data
    ltp FLOAT DEFAULT 0,
    open_price FLOAT,
    high FLOAT,
    low FLOAT,
    close FLOAT,
    prev_close FLOAT,
    bid FLOAT,
    ask FLOAT,
    mid_price FLOAT,
    price_change FLOAT,
    price_change_pct FLOAT,
    avg_traded_price FLOAT,
    
    -- Volume & OI
    volume BIGINT DEFAULT 0,
    prev_volume BIGINT,
    volume_change BIGINT,
    volume_change_pct FLOAT,
    oi BIGINT DEFAULT 0,
    prev_oi BIGINT,
    oi_change BIGINT DEFAULT 0,
    oi_change_pct FLOAT,
    
    -- Greeks
    iv FLOAT,
    delta FLOAT,
    gamma FLOAT,
    theta FLOAT,
    vega FLOAT,
    rho FLOAT,
    
    -- Market data
    bid_price FLOAT,
    ask_price FLOAT,
    bid_qty BIGINT DEFAULT 0,
    ask_qty BIGINT DEFAULT 0,
    
    -- Calculated fields
    theoretical_price FLOAT,
    intrinsic_value FLOAT,
    time_value FLOAT,
    moneyness FLOAT,
    moneyness_type VARCHAR(3),
    
    -- Classification
    buildup_type VARCHAR(2),
    buildup_name VARCHAR(50),
    
    -- Reversal
    reversal_price FLOAT,
    support_price FLOAT,
    resistance_price FLOAT,
    resistance_range_price FLOAT,
    weekly_reversal_price FLOAT,
    future_reversal_price FLOAT,
    
    -- Flags
    is_liquid BOOLEAN DEFAULT TRUE,
    is_valid BOOLEAN DEFAULT TRUE,
    
    -- Analysis (JSONB for compression)
    order_flow_analysis JSONB,
    smart_money_analysis JSONB,
    liquidity_analysis JSONB,
    
    PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable with daily chunks
SELECT create_hypertable('option_contracts', 'timestamp',
    chunk_time_interval => INTERVAL '1 day'
);

-- Create indexes AFTER hypertable conversion
CREATE INDEX idx_oc_symbol_expiry ON option_contracts(symbol_id, expiry, timestamp DESC);
CREATE INDEX idx_oc_trade_date ON option_contracts(symbol_id, expiry, trade_date);
CREATE INDEX idx_oc_strike ON option_contracts(strike_price, option_type);

-- Enable compression
ALTER TABLE option_contracts SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol_id,expiry,strike_price,option_type',
    timescaledb.compress_orderby = 'timestamp DESC'
);

-- Compress chunks older than 3 days  
SELECT add_compression_policy('option_contracts', INTERVAL '3 days');


-- 2. Create market_snapshots as hypertable
CREATE TABLE market_snapshots (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    trade_date DATE NOT NULL,
    symbol_id INTEGER NOT NULL,
    exchange VARCHAR(10) NOT NULL,
    segment VARCHAR(10) NOT NULL,
    
    -- Price data
    ltp FLOAT NOT NULL,
    open_price FLOAT,
    high FLOAT,
    low FLOAT,
    close FLOAT,
    prev_close FLOAT,
    
    -- Volume
    volume BIGINT DEFAULT 0,
    traded_value FLOAT DEFAULT 0,
    total_buy_qty BIGINT DEFAULT 0,
    total_sell_qty BIGINT DEFAULT 0,
    
    -- OI
    oi BIGINT DEFAULT 0,
    oi_change BIGINT DEFAULT 0,
    
    -- Market depth (JSONB for compression)
    market_depth JSONB,
    
    -- Circuit limits
    upper_circuit FLOAT,
    lower_circuit FLOAT,
    vwap FLOAT,
    
    -- Global context
    spot_change FLOAT,
    spot_change_pct FLOAT,
    total_call_oi BIGINT,
    total_put_oi BIGINT,
    pcr_ratio FLOAT,
    atm_iv FLOAT,
    atm_iv_change FLOAT,
    max_pain_strike FLOAT,
    days_to_expiry INTEGER,
    lot_size INTEGER,
    tick_size FLOAT,
    
    -- Raw data
    raw_data JSONB,
    
    -- Analysis
    gex_analysis JSONB,
    iv_skew_analysis JSONB,
    pcr_analysis JSONB,
    market_wide_analysis JSONB,
    
    -- Option chain snapshot for historical mode
    option_chain JSONB,
    atm_strike FLOAT,
    pcr FLOAT,
    max_pain FLOAT,
    
    PRIMARY KEY (id, timestamp)
);

-- Convert to hypertable
SELECT create_hypertable('market_snapshots', 'timestamp',
    chunk_time_interval => INTERVAL '1 day'
);

-- Indexes
CREATE INDEX idx_ms_symbol_time ON market_snapshots(symbol_id, timestamp DESC);
CREATE INDEX idx_ms_trade_date ON market_snapshots(symbol_id, trade_date);

-- Compression
ALTER TABLE market_snapshots SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol_id',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('market_snapshots', INTERVAL '3 days');


-- 3. Create future_contracts as hypertable
CREATE TABLE future_contracts (
    id BIGSERIAL,
    timestamp TIMESTAMPTZ NOT NULL,
    trade_date DATE NOT NULL,
    symbol_id INTEGER NOT NULL,
    expiry VARCHAR(20) NOT NULL,
    
    ltp FLOAT NOT NULL,
    open_price FLOAT,
    high FLOAT,
    low FLOAT,
    close FLOAT,
    prev_close FLOAT,
    volume BIGINT DEFAULT 0,
    oi BIGINT DEFAULT 0,
    oi_change BIGINT DEFAULT 0,
    basis FLOAT,
    basis_pct FLOAT,
    
    PRIMARY KEY (id, timestamp)
);

SELECT create_hypertable('future_contracts', 'timestamp',
    chunk_time_interval => INTERVAL '1 day'
);

CREATE INDEX idx_fc_symbol ON future_contracts(symbol_id, expiry, timestamp DESC);

ALTER TABLE future_contracts SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'symbol_id,expiry',
    timescaledb.compress_orderby = 'timestamp DESC'
);

SELECT add_compression_policy('future_contracts', INTERVAL '3 days');


-- Verify hypertables created
SELECT hypertable_name, num_chunks, compression_enabled 
FROM timescaledb_information.hypertables;
