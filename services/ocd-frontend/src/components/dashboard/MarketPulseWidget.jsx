import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    ChartBarIcon
} from '@heroicons/react/24/outline';
import {
    selectOptionChain, selectSpotPrice, selectATMStrike,
    selectLotSize, selectATMIV, selectPCR, selectDaysToExpiry
} from '../../context/selectors';
import { analyzeBuildup, NIFTY_CONFIG } from '../../services/buildupAnalytics';
import BuildupSummaryCard from '../analytics/BuildupSummaryCard';

/**
 * Market Pulse Widget
 * 
 * Aggregates all analysis signals into a single sentiment view:
 * - Overall market sentiment (BULLISH/BEARISH/NEUTRAL)
 * - Key metrics summary
 * - Signal strength meter
 */
const MarketPulseWidget = () => {
    const theme = useSelector((state) => state.theme.theme);
    const isDark = theme === 'dark';

    // Selectors for Buildup Analysis
    const optionChain = useSelector(selectOptionChain);
    const spotPrice = useSelector(selectSpotPrice);
    const atmStrike = useSelector(selectATMStrike);
    const lotSize = useSelector(selectLotSize) || NIFTY_CONFIG.lotSize;
    const atmIV = useSelector(selectATMIV);
    const pcr = useSelector(selectPCR);
    const dte = useSelector(selectDaysToExpiry);

    // Use our shared sophisticated logic
    const { summary, insights, marketState } = useMemo(() => {
        return analyzeBuildup(optionChain, spotPrice, atmStrike, lotSize, atmIV, pcr, dte);
    }, [optionChain, spotPrice, atmStrike, lotSize, atmIV, pcr, dte]);

    if (!summary) {
        return (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border overflow-hidden p-8 text-center text-gray-400 h-full flex flex-col items-center justify-center ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
            >
                <div className="animate-pulse">
                    <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Analyzing Market Pulse...</p>
                </div>
            </motion.div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl border overflow-hidden h-full ${isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200'}`}
        >
            <BuildupSummaryCard
                summary={summary}
                marketState={marketState}
                insights={insights}
                isDark={isDark}
            />
        </motion.div>
    );
};

export default MarketPulseWidget;
