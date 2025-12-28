import { createSlice } from "@reduxjs/toolkit";

// Default dev URLs
const localURLs = {
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  socketURL: import.meta.env.VITE_SOCKET_URL || "ws://localhost:8000",
};

// Load from localStorage or fallback to dev URLs
let savedConfig = JSON.parse(localStorage.getItem("appConfig"));

// Fix for stale port 10001 or double api path
if (savedConfig?.baseURL?.includes("10001") || savedConfig?.baseURL?.includes("/api/api")) {
  localStorage.removeItem("appConfig");
  savedConfig = null;
}

const initialState = savedConfig || localURLs;

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setURLs: (state, action) => {
      state.baseURL = action.payload.baseURL;
      state.socketURL = action.payload.socketURL;
      localStorage.setItem("appConfig", JSON.stringify(state)); // persist
    },
    resetURLs: (state) => {
      state.baseURL = localURLs.baseURL;
      state.socketURL = localURLs.socketURL;
      localStorage.setItem("appConfig", JSON.stringify(state)); // persist
    },
  },
});

export const { setURLs, resetURLs } = configSlice.actions;
export default configSlice.reducer;
