// slices/themeSlice.js
import { createSlice } from "@reduxjs/toolkit";

// Helper to apply theme to HTML element for Tailwind
const applyThemeToDOM = (theme) => {
  if (typeof document !== 'undefined') {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
};

// Initialize theme from localStorage on load
const getInitialTheme = () => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('theme');
    if (saved) {
      applyThemeToDOM(saved);
      return saved;
    }
  }
  // Default to dark
  applyThemeToDOM('dark');
  return 'dark';
};

export const themeSlice = createSlice({
  name: "theme",
  initialState: {
    theme: getInitialTheme(),
    isReversed: true,
    isHighlighting: true,
    isItmHighlighting: false,
  },
  reducers: {
    setDarkTheme: (state) => {
      state.theme = 'dark';
      localStorage.setItem('theme', 'dark');
      applyThemeToDOM('dark');
    },
    setLightTheme: (state) => {
      state.theme = 'light';
      localStorage.setItem('theme', 'light');
      applyThemeToDOM('light');
    },
    toggleTheme: (state) => {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      state.theme = newTheme;
      localStorage.setItem('theme', newTheme);
      applyThemeToDOM(newTheme);
    },
    setIsItmHighlighting: (state) => {
      state.isItmHighlighting = state.isItmHighlighting === true ? false : true;
    },
  },
});

export const { toggleTheme, setIsReversed, setIsHighlighting, setIsItmHighlighting } =
  themeSlice.actions;
export default themeSlice.reducer;

