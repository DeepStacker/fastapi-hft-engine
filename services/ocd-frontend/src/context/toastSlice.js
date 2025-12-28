import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  toasts: [],
};

export const toastSlice = createSlice({
  name: 'toast',
  initialState,
  reducers: {
    addToast: (state, action) => {
      const toast = {
        id: Date.now(),
        message: action.payload.message,
        type: action.payload.type || 'info',
        duration: action.payload.duration || 3000,
      };
      state.toasts.push(toast);
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { addToast, removeToast } = toastSlice.actions;

// Thunk to add and automatically remove toast
export const showToast = (toastData) => (dispatch) => {
  const id = Date.now();
  dispatch(addToast({ ...toastData, id }));
  
  setTimeout(() => {
    dispatch(removeToast(id));
  }, toastData.duration || 3000);
};

export default toastSlice.reducer;
