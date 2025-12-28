// slices/themeSlice.js
import { createSlice } from "@reduxjs/toolkit";

const applyThemeToDOM = (theme) => {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

export const themeSlice = createSlice({
  name: "theme",
  initialState: {
    theme: 'dark', // Let redux-persist handle restoration
    isReversed: true,
    isHighlighting: true,
    isItmHighlighting: false,
  },
  reducers: {
    setDarkTheme: (state) => {
      state.theme = 'dark';
      applyThemeToDOM('dark');
    },
    setLightTheme: (state) => {
      state.theme = 'light';
      applyThemeToDOM('light');
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      applyThemeToDOM(state.theme);
    },
    setIsItmHighlighting: (state) => {
      state.isItmHighlighting = !state.isItmHighlighting;
    },
    // Add rehydrate handler if needed or rely on component side effect
    applyStoredTheme: (state) => {
      applyThemeToDOM(state.theme)
    }
  },
});

export const { toggleTheme, setDarkTheme, setLightTheme, setIsItmHighlighting, applyStoredTheme } = themeSlice.actions;
export default themeSlice.reducer;

