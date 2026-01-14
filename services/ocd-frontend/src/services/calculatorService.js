/**
 * Calculator Service
 * Centralized service for all calculator-related API calls
 * Migrated from api/calculatorApi.js for consistent API layer
 */
import apiClient from './apiClient';

const CALC_BASE = '/calculators';

/**
 * Calculator Service with all API methods
 */
export const calculatorService = {
    /**
     * Calculate option price and Greeks using Black-Scholes
     * @param {Object} params - Calculation parameters
     * @param {number} params.spot - Current spot price
     * @param {number} params.strike - Strike price
     * @param {number} params.timeToExpiry - Time to expiry in years
     * @param {number} [params.riskFreeRate=0.07] - Annual risk-free rate
     * @param {number} params.volatility - Annual volatility
     * @param {number} [params.dividendYield=0] - Annual dividend yield
     */
    calculateOptionPrice: async ({
        spot,
        strike,
        timeToExpiry,
        riskFreeRate = 0.07,
        volatility,
        dividendYield = 0,
    }) => {
        const response = await apiClient.post(`${CALC_BASE}/option-price`, {
            spot,
            strike,
            time_to_expiry: timeToExpiry,
            risk_free_rate: riskFreeRate,
            volatility,
            dividend_yield: dividendYield,
        });
        return response.data;
    },

    /**
     * Calculate implied volatility from option price
     * @param {Object} params - Calculation parameters
     * @param {number} params.optionPrice - Market price of the option
     * @param {number} params.spot - Current spot price
     * @param {number} params.strike - Strike price
     * @param {number} params.timeToExpiry - Time to expiry in years
     * @param {number} [params.riskFreeRate=0.07] - Annual risk-free rate
     * @param {string} [params.optionType='CE'] - Option type (CE/PE)
     * @param {number} [params.dividendYield=0] - Annual dividend yield
     */
    calculateIV: async ({
        optionPrice,
        spot,
        strike,
        timeToExpiry,
        riskFreeRate = 0.07,
        optionType = 'CE',
        dividendYield = 0,
    }) => {
        const response = await apiClient.post(`${CALC_BASE}/implied-volatility`, {
            option_price: optionPrice,
            spot,
            strike,
            time_to_expiry: timeToExpiry,
            risk_free_rate: riskFreeRate,
            option_type: optionType,
            dividend_yield: dividendYield,
        });
        return response.data;
    },

    /**
     * Calculate SIP returns
     * @param {Object} params - SIP parameters
     * @param {number} params.monthlyInvestment - Monthly investment amount
     * @param {number} params.annualReturn - Expected annual return percentage
     * @param {number} params.years - Investment duration in years
     */
    calculateSIP: async ({ monthlyInvestment, annualReturn, years }) => {
        const response = await apiClient.post(`${CALC_BASE}/sip`, {
            monthly_investment: monthlyInvestment,
            annual_return: annualReturn,
            years,
        });
        return response.data;
    },

    /**
     * Calculate Lumpsum returns
     * @param {Object} params - Lumpsum parameters
     * @param {number} params.principal - Initial investment amount
     * @param {number} params.annualReturn - Expected annual return percentage
     * @param {number} params.years - Investment duration in years
     */
    calculateLumpsum: async ({ principal, annualReturn, years }) => {
        const response = await apiClient.post(`${CALC_BASE}/lumpsum`, {
            principal,
            annual_return: annualReturn,
            years,
        });
        return response.data;
    },

    /**
     * Calculate SWP results
     * @param {Object} params - SWP parameters
     * @param {number} params.initialInvestment - Initial corpus
     * @param {number} params.monthlyWithdrawal - Monthly withdrawal amount
     * @param {number} params.annualReturn - Expected annual return percentage
     * @param {number} params.years - Duration in years
     */
    calculateSWP: async ({
        initialInvestment,
        monthlyWithdrawal,
        annualReturn,
        years,
    }) => {
        const response = await apiClient.post(`${CALC_BASE}/swp`, {
            initial_investment: initialInvestment,
            monthly_withdrawal: monthlyWithdrawal,
            annual_return: annualReturn,
            years,
        });
        return response.data;
    },

    /**
     * Calculate margin required
     * @param {Object} params - Margin parameters
     * @param {number} params.spot - Spot price
     * @param {number} params.strike - Strike price
     * @param {string} [params.optionType='CE'] - Option type (CE/PE)
     * @param {number} params.premium - Option premium
     * @param {number} params.lotSize - Lot size
     * @param {boolean} [params.isBuy=true] - True for buy, false for sell
     */
    calculateMargin: async ({
        spot,
        strike,
        optionType = 'CE',
        premium,
        lotSize,
        isBuy = true,
    }) => {
        const response = await apiClient.post(`${CALC_BASE}/margin`, {
            spot,
            strike,
            option_type: optionType,
            premium,
            lot_size: lotSize,
            is_buy: isBuy,
        });
        return response.data;
    },

    // ============== Strategy Simulation API ==============

    /**
     * Simulate strategy P&L and Greeks at a specific point
     * @param {Object} params - Simulation parameters
     * @param {Array} params.legs - Strategy legs with strike, option_type, action, qty, entry_price, iv, expiry, lot_size
     * @param {number} params.spotPrice - Simulated spot price
     * @param {string} [params.simulationDate] - Simulation date (ISO format)
     * @param {number} [params.ivChange=0] - IV change as decimal
     * @param {number} [params.riskFreeRate=0.07] - Risk-free rate
     */
    simulateStrategy: async ({
        legs,
        spotPrice,
        simulationDate = null,
        ivChange = 0,
        riskFreeRate = 0.07,
    }) => {
        const response = await apiClient.post('/strategy-simulation/simulate', {
            legs: legs.map(leg => ({
                strike: leg.strike,
                option_type: leg.optionType || leg.option_type || leg.type,
                action: leg.action,
                qty: leg.qty,
                entry_price: leg.entryPrice || leg.entry_price || leg.ltp,
                iv: leg.iv,
                expiry: leg.expiry,
                lot_size: leg.lotSize || leg.lot_size || 1,
            })),
            spot_price: spotPrice,
            simulation_date: simulationDate,
            iv_change: ivChange,
            risk_free_rate: riskFreeRate,
        });
        return response.data;
    },

    /**
     * Generate payoff surface for time × price
     * @param {Object} params - Surface parameters
     * @param {Array} params.legs - Strategy legs
     * @param {number} params.currentSpot - Current spot price
     * @param {string} [params.currentDate] - Current date (ISO format)
     * @param {Array} [params.priceRangePct=[-0.15, 0.15]] - Price range as [min%, max%]
     * @param {number} [params.timeSteps=10] - Number of time steps
     * @param {number} [params.priceSteps=50] - Number of price steps
     * @param {number} [params.ivChange=0] - IV change
     */
    getPayoffSurface: async ({
        legs,
        currentSpot,
        currentDate = null,
        priceRangePct = [-0.15, 0.15],
        timeSteps = 10,
        priceSteps = 50,
        ivChange = 0,
    }) => {
        const response = await apiClient.post('/strategy-simulation/payoff-surface', {
            legs: legs.map(leg => ({
                strike: leg.strike,
                option_type: leg.optionType || leg.option_type || leg.type,
                action: leg.action,
                qty: leg.qty,
                entry_price: leg.entryPrice || leg.entry_price || leg.ltp,
                iv: leg.iv,
                expiry: leg.expiry,
                lot_size: leg.lotSize || leg.lot_size || 1,
            })),
            current_spot: currentSpot,
            current_date: currentDate,
            price_range_pct: priceRangePct,
            time_steps: timeSteps,
            price_steps: priceSteps,
            iv_change: ivChange,
        });
        return response.data;
    },

    /**
     * Generate Greeks sensitivity surface for price × IV
     * @param {Object} params - Surface parameters
     */
    getGreeksSurface: async ({
        legs,
        currentSpot,
        currentDate = null,
        priceRangePct = [-0.10, 0.10],
        ivRangePct = [-0.10, 0.10],
        priceSteps = 25,
        ivSteps = 25,
    }) => {
        const response = await apiClient.post('/strategy-simulation/greeks-surface', {
            legs: legs.map(leg => ({
                strike: leg.strike,
                option_type: leg.optionType || leg.option_type || leg.type,
                action: leg.action,
                qty: leg.qty,
                entry_price: leg.entryPrice || leg.entry_price || leg.ltp,
                iv: leg.iv,
                expiry: leg.expiry,
                lot_size: leg.lotSize || leg.lot_size || 1,
            })),
            current_spot: currentSpot,
            current_date: currentDate,
            price_range_pct: priceRangePct,
            iv_range_pct: ivRangePct,
            price_steps: priceSteps,
            iv_steps: ivSteps,
        });
        return response.data;
    },

    /**
     * Run scenario analysis
     * @param {Object} params - Scenario parameters
     * @param {Array} params.legs - Strategy legs
     * @param {number} params.currentSpot - Current spot price
     * @param {Array} params.scenarios - Scenario definitions
     */
    runScenarioAnalysis: async ({
        legs,
        currentSpot,
        currentDate = null,
        scenarios,
    }) => {
        const response = await apiClient.post('/strategy-simulation/scenario-analysis', {
            legs: legs.map(leg => ({
                strike: leg.strike,
                option_type: leg.optionType || leg.option_type || leg.type,
                action: leg.action,
                qty: leg.qty,
                entry_price: leg.entryPrice || leg.entry_price || leg.ltp,
                iv: leg.iv,
                expiry: leg.expiry,
                lot_size: leg.lotSize || leg.lot_size || 1,
            })),
            current_spot: currentSpot,
            current_date: currentDate,
            scenarios: scenarios.map(s => ({
                name: s.name,
                spot_change: s.spotChange || 0,
                days_forward: s.daysForward || 0,
                iv_change: s.ivChange || 0,
            })),
        });
        return response.data;
    },

    /**
     * Get strategy presets
     */
    getStrategyPresets: async () => {
        const response = await apiClient.get('/strategy-simulation/presets');
        return response.data;
    },

    // ============== PROFESSIONAL API METHODS ==============

    /**
     * Helper to format legs for API
     */
    _formatLegs: (legs) => legs.map(leg => ({
        strike: leg.strike,
        option_type: leg.optionType || leg.option_type || leg.type,
        action: leg.action,
        qty: leg.qty,
        entry_price: leg.entryPrice || leg.entry_price || leg.ltp,
        iv: leg.iv,
        expiry: leg.expiry,
        lot_size: leg.lotSize || leg.lot_size || 1,
    })),

    /**
     * Calculate Probability of Profit (POP)
     */
    calculatePOP: async ({ legs, currentSpot, currentDate = null, averageIV = null }) => {
        const response = await apiClient.post('/strategy-simulation/probability-of-profit', {
            legs: calculatorService._formatLegs(legs),
            current_spot: currentSpot,
            current_date: currentDate,
            average_iv: averageIV,
        });
        return response.data;
    },

    /**
     * Calculate P&L at price slices
     */
    getPriceSlices: async ({
        legs,
        currentSpot,
        currentDate = null,
        priceChanges = [-0.05, -0.02, 0, 0.02, 0.05],
        timeOffsets = [0, 3, 7, null]
    }) => {
        const response = await apiClient.post('/strategy-simulation/price-slices', {
            legs: calculatorService._formatLegs(legs),
            current_spot: currentSpot,
            current_date: currentDate,
            price_changes: priceChanges,
            time_offsets: timeOffsets,
        });
        return response.data;
    },

    /**
     * Calculate margin requirement
     */
    calculateMargin: async ({ legs, currentSpot }) => {
        const response = await apiClient.post('/strategy-simulation/margin-requirement', {
            legs: calculatorService._formatLegs(legs),
            current_spot: currentSpot,
        });
        return response.data;
    },

    /**
     * Calculate max profit/loss
     */
    calculateMaxProfitLoss: async ({ legs, currentSpot }) => {
        const response = await apiClient.post('/strategy-simulation/max-profit-loss', {
            legs: calculatorService._formatLegs(legs),
            current_spot: currentSpot,
        });
        return response.data;
    },

    /**
     * Generate scenario matrix (spot × IV)
     */
    getScenarioMatrix: async ({
        legs,
        currentSpot,
        currentDate = null,
        spotChanges = [-0.05, -0.025, 0, 0.025, 0.05],
        ivChanges = [-0.10, -0.05, 0, 0.05, 0.10]
    }) => {
        const response = await apiClient.post('/strategy-simulation/scenario-matrix', {
            legs: calculatorService._formatLegs(legs),
            current_spot: currentSpot,
            current_date: currentDate,
            spot_changes: spotChanges,
            iv_changes: ivChanges,
        });
        return response.data;
    },

    /**
     * Get full strategy metrics in one call
     * Returns: POP, max profit/loss, margin, breakevens, Greeks
     */
    getFullMetrics: async ({ legs, currentSpot, currentDate = null }) => {
        const response = await apiClient.post('/strategy-simulation/full-metrics', {
            legs: calculatorService._formatLegs(legs),
            current_spot: currentSpot,
            current_date: currentDate,
        });
        return response.data;
    },
};

export default calculatorService;
