import { createSlice } from "@reduxjs/toolkit";

// Default dev URLs
const localURLs = {
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  socketURL: import.meta.env.VITE_SOCKET_URL || "ws://localhost:8000",
};

const initialState = localURLs;

const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setURLs: (state, action) => {
      state.baseURL = action.payload.baseURL;
      state.socketURL = action.payload.socketURL;
    },
    resetURLs: (state) => {
      state.baseURL = localURLs.baseURL;
      state.socketURL = localURLs.socketURL;
    },
  },
});

export const { setURLs, resetURLs } = configSlice.actions;
export default configSlice.reducer;
