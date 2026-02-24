-- Strategy Position Tracking Tables Migration
-- Created: 2026-02-01
-- Purpose: Add tables for tracking strategy positions, adjustments, alerts, and recommendation history

-- ============================================================
-- TRACKED POSITIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tracked_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(128) NOT NULL,
    
    -- Strategy metadata
    strategy_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    expiry VARCHAR(20) NOT NULL,
    
    -- The legs as JSONB array
    legs JSONB NOT NULL,
    
    -- Entry conditions snapshot
    entry_spot FLOAT NOT NULL,
    entry_atm_iv FLOAT,
    entry_pcr FLOAT,
    entry_time TIMESTAMPTZ DEFAULT NOW(),
    
    -- Market context at entry
    entry_context JSONB,
    
    -- Calculated metrics at entry
    entry_metrics JSONB,
    
    -- Current tracking
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    current_pnl FLOAT DEFAULT 0.0,
    current_pnl_pct FLOAT DEFAULT 0.0,
    peak_pnl FLOAT DEFAULT 0.0,
    drawdown_pnl FLOAT DEFAULT 0.0,
    
    -- Exit conditions
    exit_spot FLOAT,
    exit_time TIMESTAMPTZ,
    exit_reason VARCHAR(100),
    final_pnl FLOAT,
    
    -- User notes
    notes TEXT,
    tags JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for tracked_positions
CREATE INDEX IF NOT EXISTS idx_tracked_positions_user_id ON tracked_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_positions_symbol ON tracked_positions(symbol);
CREATE INDEX IF NOT EXISTS idx_tracked_positions_status ON tracked_positions(status);
CREATE INDEX IF NOT EXISTS idx_tracked_positions_created_at ON tracked_positions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tracked_positions_user_status ON tracked_positions(user_id, status);

-- ============================================================
-- POSITION ADJUSTMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS position_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES tracked_positions(id) ON DELETE CASCADE,
    
    adjustment_type VARCHAR(50) NOT NULL,
    trigger_reason VARCHAR(200) NOT NULL,
    
    spot_at_adjustment FLOAT NOT NULL,
    
    -- Before and after legs
    old_legs JSONB NOT NULL,
    new_legs JSONB NOT NULL,
    
    -- Cost/credit of adjustment
    adjustment_cost FLOAT DEFAULT 0.0,
    realized_pnl FLOAT DEFAULT 0.0,
    
    -- Whether system recommended
    is_system_recommended BOOLEAN DEFAULT TRUE,
    executed_by VARCHAR(128),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for adjustments
CREATE INDEX IF NOT EXISTS idx_position_adjustments_position_id ON position_adjustments(position_id);
CREATE INDEX IF NOT EXISTS idx_position_adjustments_created_at ON position_adjustments(created_at DESC);

-- ============================================================
-- POSITION ALERTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS position_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position_id UUID NOT NULL REFERENCES tracked_positions(id) ON DELETE CASCADE,
    
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) DEFAULT 'info',
    
    message TEXT NOT NULL,
    recommended_action VARCHAR(200),
    suggested_adjustment JSONB,
    
    is_read BOOLEAN DEFAULT FALSE,
    is_dismissed BOOLEAN DEFAULT FALSE,
    
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    market_snapshot JSONB,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for alerts
CREATE INDEX IF NOT EXISTS idx_position_alerts_position_id ON position_alerts(position_id);
CREATE INDEX IF NOT EXISTS idx_position_alerts_is_read ON position_alerts(is_read) WHERE is_read = FALSE;
CREATE INDEX IF NOT EXISTS idx_position_alerts_severity ON position_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_position_alerts_created_at ON position_alerts(created_at DESC);

-- ============================================================
-- RECOMMENDATION HISTORY TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS recommendation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What was recommended
    strategy_type VARCHAR(50) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    expiry VARCHAR(20) NOT NULL,
    
    -- The recommended legs
    legs JSONB NOT NULL,
    
    -- Metrics at recommendation time
    metrics JSONB NOT NULL,
    
    -- Market context
    market_context JSONB NOT NULL,
    
    -- Confidence score
    confidence FLOAT NOT NULL,
    
    -- User action
    user_action VARCHAR(20) DEFAULT 'ignored',
    
    -- If tracked, link to position
    tracked_position_id UUID,
    
    -- Outcome (filled later if tracked)
    outcome_pnl FLOAT,
    outcome_pop_actual BOOLEAN,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes for recommendation history
CREATE INDEX IF NOT EXISTS idx_recommendation_history_symbol ON recommendation_history(symbol);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_strategy ON recommendation_history(strategy_type);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_created_at ON recommendation_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendation_history_user_action ON recommendation_history(user_action);

-- ============================================================
-- ADD update_at TRIGGER
-- ============================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
DROP TRIGGER IF EXISTS update_tracked_positions_updated_at ON tracked_positions;
CREATE TRIGGER update_tracked_positions_updated_at
    BEFORE UPDATE ON tracked_positions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_position_adjustments_updated_at ON position_adjustments;
CREATE TRIGGER update_position_adjustments_updated_at
    BEFORE UPDATE ON position_adjustments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_position_alerts_updated_at ON position_alerts;
CREATE TRIGGER update_position_alerts_updated_at
    BEFORE UPDATE ON position_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recommendation_history_updated_at ON recommendation_history;
CREATE TRIGGER update_recommendation_history_updated_at
    BEFORE UPDATE ON recommendation_history
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE tracked_positions IS 'User-tracked strategy positions with entry conditions and current P&L';
COMMENT ON TABLE position_adjustments IS 'History of adjustments made to tracked positions (rolls, hedges)';
COMMENT ON TABLE position_alerts IS 'Risk alerts generated by the adjustment engine';
COMMENT ON TABLE recommendation_history IS 'All strategy recommendations for accountability tracking';
