import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  symbols: [],
  currentSymbol: "INR",
  timeframe: "10",
  chartData: [],
  connectionStatus: "disconnected",
  weekly: true,
  daily: false,
  avg: false,
};

const chartSlice = createSlice({
  name: "chart",
  initialState,
  reducers: {
    setSymbols: (state, action) => {
      state.symbols = action.payload;
    },
    setWeekly: (state, action) => {
      state.weekly = action.payload; // expect true/false directly
    },
    setDaily: (state, action) => {
      state.daily = action.payload; // expect true/false directly
    },
    setAvg: (state, action) => {
      state.avg = action.payload; // expect true/false directly
    },
    setCurrentSymbol: (state, action) => {
      state.currentSymbol = action.payload;
    },
    setTimeframe: (state, action) => {
      state.timeframe = action.payload === "1" ? "" : action.payload;
    },
    setChartData: (state, action) => {
      state.chartData = Array.isArray(action.payload) ? action.payload : [];
    },
    setConnectionStatus: (state, action) => {
      state.connectionStatus = action.payload;
    },
    appendLiveCandle: (state, action) => {
      const newCandle = action.payload;
      if (!newCandle || !newCandle.time) return;

      const lastCandle = state.chartData[state.chartData.length - 1];

      if (lastCandle?.time === newCandle.time) {
        // Update existing candle
        state.chartData[state.chartData.length - 1] = newCandle;
      } else {
        // Append new candle
        state.chartData.push(newCandle);
      }
    },
  },
});

export const {
  setSymbols,
  setDaily,
  setWeekly,
  setAvg,
  setCurrentSymbol,
  setTimeframe,
  setChartData,
  setConnectionStatus,
  appendLiveCandle,
} = chartSlice.actions;

export default chartSlice.reducer;
