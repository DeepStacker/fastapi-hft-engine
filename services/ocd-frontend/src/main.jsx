import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Import logger first to disable console.log in production
import './utils/logger';
import App from "./App.jsx";
import "./index.css";
import { AppWrapper } from "./context/AppProvider.jsx";
import { Provider } from "react-redux";
import { store } from "./context/store.js";

const rootElement = document.getElementById("root");

createRoot(rootElement).render(
  <StrictMode>
    <Provider store={store}>
      <AppWrapper>
        <App />
      </AppWrapper>
    </Provider>
  </StrictMode>
);
