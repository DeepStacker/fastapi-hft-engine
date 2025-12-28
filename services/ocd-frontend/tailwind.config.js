/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "itm-highlight": "#ded18e5e",
      },
      screens: {
        xs: "475px",
      },
    },
  },
  plugins: [],
};
