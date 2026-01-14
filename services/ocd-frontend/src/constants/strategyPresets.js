/**
 * Strategy Presets Configuration
 * Expanded preset library including single and multi-expiry strategies
 */

export const STRATEGY_CATEGORIES = {
    VOLATILITY: 'volatility',
    NEUTRAL: 'neutral',
    DIRECTIONAL: 'directional',
    CALENDAR: 'calendar',
    INCOME: 'income'
};

export const STRATEGY_PRESETS = [
    // Volatility Strategies
    {
        id: 'long_straddle',
        name: 'Long Straddle',
        description: 'Buy ATM Call + Put. Profit from large moves in either direction.',
        category: STRATEGY_CATEGORIES.VOLATILITY,
        maxProfit: 'Unlimited',
        maxLoss: 'Premium Paid',
        breakeven: '2 points (Strike ± Premium)',
        idealFor: 'High volatility expectation',
        legs: [
            { strikeOffset: 0, type: 'CE', action: 'BUY', qty: 1 },
            { strikeOffset: 0, type: 'PE', action: 'BUY', qty: 1 }
        ]
    },
    {
        id: 'short_straddle',
        name: 'Short Straddle',
        description: 'Sell ATM Call + Put. Profit from range-bound markets.',
        category: STRATEGY_CATEGORIES.VOLATILITY,
        maxProfit: 'Premium Received',
        maxLoss: 'Unlimited',
        breakeven: '2 points (Strike ± Premium)',
        idealFor: 'Low volatility expectation',
        legs: [
            { strikeOffset: 0, type: 'CE', action: 'SELL', qty: 1 },
            { strikeOffset: 0, type: 'PE', action: 'SELL', qty: 1 }
        ]
    },
    {
        id: 'long_strangle',
        name: 'Long Strangle',
        description: 'Buy OTM Call + Put. Cheaper than straddle, needs larger move.',
        category: STRATEGY_CATEGORIES.VOLATILITY,
        maxProfit: 'Unlimited',
        maxLoss: 'Premium Paid',
        breakeven: '2 points',
        idealFor: 'Expecting big move, unsure of direction',
        legs: [
            { strikeOffset: 100, type: 'CE', action: 'BUY', qty: 1 },
            { strikeOffset: -100, type: 'PE', action: 'BUY', qty: 1 }
        ]
    },
    {
        id: 'short_strangle',
        name: 'Short Strangle',
        description: 'Sell OTM Call + Put. Wider breakeven range than short straddle.',
        category: STRATEGY_CATEGORIES.VOLATILITY,
        maxProfit: 'Premium Received',
        maxLoss: 'Unlimited',
        breakeven: '2 points',
        idealFor: 'Range-bound market expectation',
        legs: [
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1 },
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1 }
        ]
    },

    // Neutral Strategies
    {
        id: 'iron_condor',
        name: 'Iron Condor',
        description: 'Sell OTM Call Spread + Put Spread. Limited risk, limited reward.',
        category: STRATEGY_CATEGORIES.NEUTRAL,
        maxProfit: 'Net Credit',
        maxLoss: 'Wing Width - Credit',
        breakeven: '2 points',
        idealFor: 'Range-bound, low volatility',
        legs: [
            { strikeOffset: -200, type: 'PE', action: 'BUY', qty: 1 },
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1 },
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1 },
            { strikeOffset: 200, type: 'CE', action: 'BUY', qty: 1 }
        ]
    },
    {
        id: 'iron_butterfly',
        name: 'Iron Butterfly',
        description: 'Sell ATM Straddle + Buy OTM Strangle. Higher credit, narrower range.',
        category: STRATEGY_CATEGORIES.NEUTRAL,
        maxProfit: 'Net Credit',
        maxLoss: 'Wing Width - Credit',
        breakeven: '2 points at ATM ± Credit',
        idealFor: 'Pinning at strike expectation',
        legs: [
            { strikeOffset: 0, type: 'CE', action: 'SELL', qty: 1 },
            { strikeOffset: 0, type: 'PE', action: 'SELL', qty: 1 },
            { strikeOffset: 100, type: 'CE', action: 'BUY', qty: 1 },
            { strikeOffset: -100, type: 'PE', action: 'BUY', qty: 1 }
        ]
    },
    {
        id: 'jade_lizard',
        name: 'Jade Lizard',
        description: 'Sell OTM Put + OTM Call Spread. No upside risk if credit > call spread width.',
        category: STRATEGY_CATEGORIES.NEUTRAL,
        maxProfit: 'Net Credit',
        maxLoss: 'Put Strike - Credit (downside)',
        breakeven: '1 point on downside',
        idealFor: 'Slight bullish bias with premium collection',
        legs: [
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1 },
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1 },
            { strikeOffset: 200, type: 'CE', action: 'BUY', qty: 1 }
        ]
    },
    {
        id: 'broken_wing_butterfly',
        name: 'Broken Wing Butterfly',
        description: 'Asymmetric butterfly with reduced/no risk on one side.',
        category: STRATEGY_CATEGORIES.NEUTRAL,
        maxProfit: 'At middle strike',
        maxLoss: 'Reduced on one wing',
        breakeven: '2 points',
        idealFor: 'Directional bias with butterfly structure',
        legs: [
            { strikeOffset: -100, type: 'PE', action: 'BUY', qty: 1 },
            { strikeOffset: 0, type: 'PE', action: 'SELL', qty: 2 },
            { strikeOffset: 200, type: 'PE', action: 'BUY', qty: 1 }
        ]
    },

    // Directional Strategies
    {
        id: 'bull_call_spread',
        name: 'Bull Call Spread',
        description: 'Buy ATM Call + Sell OTM Call. Defined risk bullish play.',
        category: STRATEGY_CATEGORIES.DIRECTIONAL,
        maxProfit: 'Strike Diff - Debit',
        maxLoss: 'Net Debit',
        breakeven: 'Lower Strike + Debit',
        idealFor: 'Moderate bullish view',
        legs: [
            { strikeOffset: 0, type: 'CE', action: 'BUY', qty: 1 },
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1 }
        ]
    },
    {
        id: 'bear_put_spread',
        name: 'Bear Put Spread',
        description: 'Buy ATM Put + Sell OTM Put. Defined risk bearish play.',
        category: STRATEGY_CATEGORIES.DIRECTIONAL,
        maxProfit: 'Strike Diff - Debit',
        maxLoss: 'Net Debit',
        breakeven: 'Higher Strike - Debit',
        idealFor: 'Moderate bearish view',
        legs: [
            { strikeOffset: 0, type: 'PE', action: 'BUY', qty: 1 },
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1 }
        ]
    },
    {
        id: 'bull_put_spread',
        name: 'Bull Put Spread',
        description: 'Sell ATM Put + Buy OTM Put. Credit spread with bullish bias.',
        category: STRATEGY_CATEGORIES.DIRECTIONAL,
        maxProfit: 'Net Credit',
        maxLoss: 'Strike Diff - Credit',
        breakeven: 'Higher Strike - Credit',
        idealFor: 'Bullish with income focus',
        legs: [
            { strikeOffset: 0, type: 'PE', action: 'SELL', qty: 1 },
            { strikeOffset: -100, type: 'PE', action: 'BUY', qty: 1 }
        ]
    },
    {
        id: 'bear_call_spread',
        name: 'Bear Call Spread',
        description: 'Sell ATM Call + Buy OTM Call. Credit spread with bearish bias.',
        category: STRATEGY_CATEGORIES.DIRECTIONAL,
        maxProfit: 'Net Credit',
        maxLoss: 'Strike Diff - Credit',
        breakeven: 'Lower Strike + Credit',
        idealFor: 'Bearish with income focus',
        legs: [
            { strikeOffset: 0, type: 'CE', action: 'SELL', qty: 1 },
            { strikeOffset: 100, type: 'CE', action: 'BUY', qty: 1 }
        ]
    },

    // Calendar Strategies (Multi-Expiry)
    {
        id: 'calendar_spread_call',
        name: 'Calendar Spread (Call)',
        description: 'Sell near-expiry Call + Buy far-expiry Call. Time decay play.',
        category: STRATEGY_CATEGORIES.CALENDAR,
        multiExpiry: true,
        maxProfit: 'At strike near front expiry',
        maxLoss: 'Net Debit',
        breakeven: 'Depends on IV',
        idealFor: 'Neutral with falling near-term IV',
        legs: [
            { strikeOffset: 0, type: 'CE', action: 'SELL', qty: 1, expiryIndex: 0 },
            { strikeOffset: 0, type: 'CE', action: 'BUY', qty: 1, expiryIndex: 1 }
        ]
    },
    {
        id: 'calendar_spread_put',
        name: 'Calendar Spread (Put)',
        description: 'Sell near-expiry Put + Buy far-expiry Put.',
        category: STRATEGY_CATEGORIES.CALENDAR,
        multiExpiry: true,
        maxProfit: 'At strike near front expiry',
        maxLoss: 'Net Debit',
        breakeven: 'Depends on IV',
        idealFor: 'Neutral with time decay focus',
        legs: [
            { strikeOffset: 0, type: 'PE', action: 'SELL', qty: 1, expiryIndex: 0 },
            { strikeOffset: 0, type: 'PE', action: 'BUY', qty: 1, expiryIndex: 1 }
        ]
    },
    {
        id: 'diagonal_spread_call',
        name: 'Diagonal Spread (Call)',
        description: 'Sell near OTM Call + Buy far ATM/ITM Call. Directional calendar.',
        category: STRATEGY_CATEGORIES.CALENDAR,
        multiExpiry: true,
        maxProfit: 'At short strike near front expiry',
        maxLoss: 'Net Debit',
        breakeven: 'Dynamic',
        idealFor: 'Bullish with time decay',
        legs: [
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1, expiryIndex: 0 },
            { strikeOffset: 0, type: 'CE', action: 'BUY', qty: 1, expiryIndex: 1 }
        ]
    },
    {
        id: 'diagonal_spread_put',
        name: 'Diagonal Spread (Put)',
        description: 'Sell near OTM Put + Buy far ATM/ITM Put. Bearish diagonal.',
        category: STRATEGY_CATEGORIES.CALENDAR,
        multiExpiry: true,
        maxProfit: 'At short strike near front expiry',
        maxLoss: 'Net Debit',
        breakeven: 'Dynamic',
        idealFor: 'Bearish with time decay',
        legs: [
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1, expiryIndex: 0 },
            { strikeOffset: 0, type: 'PE', action: 'BUY', qty: 1, expiryIndex: 1 }
        ]
    },
    {
        id: 'double_diagonal',
        name: 'Double Diagonal',
        description: 'Diagonal call spread + Diagonal put spread. Neutral with wider range.',
        category: STRATEGY_CATEGORIES.CALENDAR,
        multiExpiry: true,
        maxProfit: 'At either short strike',
        maxLoss: 'Net Debit',
        breakeven: '2 points (approximate)',
        idealFor: 'Neutral, range-bound with dual time decay',
        legs: [
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1, expiryIndex: 0 },
            { strikeOffset: -200, type: 'PE', action: 'BUY', qty: 1, expiryIndex: 1 },
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1, expiryIndex: 0 },
            { strikeOffset: 200, type: 'CE', action: 'BUY', qty: 1, expiryIndex: 1 }
        ]
    },

    // Income Strategies
    {
        id: 'covered_call',
        name: 'Covered Call (Synthetic)',
        description: 'Long stock (simulated) + Sell OTM Call.',
        category: STRATEGY_CATEGORIES.INCOME,
        maxProfit: 'Strike - Entry + Premium',
        maxLoss: 'Stock drops to zero',
        breakeven: 'Entry - Premium',
        idealFor: 'Income on existing position',
        legs: [
            { strikeOffset: 100, type: 'CE', action: 'SELL', qty: 1 }
        ],
        notes: 'Requires underlying position'
    },
    {
        id: 'cash_secured_put',
        name: 'Cash Secured Put',
        description: 'Sell OTM Put with cash to cover assignment.',
        category: STRATEGY_CATEGORIES.INCOME,
        maxProfit: 'Premium Received',
        maxLoss: 'Strike - Premium (if assigned)',
        breakeven: 'Strike - Premium',
        idealFor: 'Willing to own at lower price',
        legs: [
            { strikeOffset: -100, type: 'PE', action: 'SELL', qty: 1 }
        ]
    }
];

/**
 * Get presets by category
 */
export const getPresetsByCategory = (category) => {
    return STRATEGY_PRESETS.filter(p => p.category === category);
};

/**
 * Get multi-expiry presets only
 */
export const getCalendarPresets = () => {
    return STRATEGY_PRESETS.filter(p => p.multiExpiry);
};

/**
 * Build legs from preset
 */
export const buildLegsFromPreset = (preset, atmStrike, optionChain, expiries = [], lotSize = 1) => {
    const legs = [];

    for (const legDef of preset.legs) {
        const strike = atmStrike + (legDef.strikeOffset || 0);
        const expiryIndex = legDef.expiryIndex || 0;
        const expiry = expiries[expiryIndex] || expiries[0];

        // Get option data from chain
        const chainData = optionChain?.[strike];
        const optionData = legDef.type === 'CE' ? chainData?.ce : chainData?.pe;

        legs.push({
            id: Date.now() + Math.random(),
            strike,
            type: legDef.type,
            action: legDef.action,
            qty: legDef.qty || 1,
            expiry,
            ltp: optionData?.ltp || 0,
            iv: optionData?.iv || 0.15,
            delta: optionData?.optgeeks?.delta || 0,
            theta: optionData?.optgeeks?.theta || 0,
            gamma: optionData?.optgeeks?.gamma || 0,
            vega: optionData?.optgeeks?.vega || 0,
            lotSize
        });
    }

    return legs;
};

export default STRATEGY_PRESETS;
