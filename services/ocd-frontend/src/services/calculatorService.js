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
};

export default calculatorService;
