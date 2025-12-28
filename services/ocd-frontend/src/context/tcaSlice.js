import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    tradePerDay: 3,
    ndtpc: 20,
    tradeAmount: 500,
    riskReward: 2,
    chancePercent: 50,
    chargesPerTrade: 56,
    results: 0,
    profitLossChart: 0,
};

const tcaSlice = createSlice({
    name: 'tca',
    initialState,
    reducers: {
        setTradePerDay: (state, action) => {
            state.tradePerDay = action.payload;
        },
        setNdtpc: (state, action) => {
            state.ndtpc = action.payload;
        },
        setTradeAmount: (state, action) => {
            state.tradeAmount = action.payload;
        },
        setRiskReward: (state, action) => {
            state.riskReward = action.payload;
        },
        setChancePercent: (state, action) => {
            state.chancePercent = action.payload;
        },
        setChargesPerTrade: (state, action) => {
            state.chargesPerTrade = action.payload;
        },
        setResults: (state, action) => {
            state.results = action.payload;
        },
        setProfitLossChart: (state, action) => {
            state.profitLossChart = action.payload;
        },
    },
});

export const {
    setTradePerDay,
    setNdtpc,
    setTradeAmount,
    setRiskReward,
    setChancePercent,
    setChargesPerTrade,
    setResults,
    setProfitLossChart,
} = tcaSlice.actions;

export default tcaSlice.reducer;
