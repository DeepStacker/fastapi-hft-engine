// store.js
import { configureStore, combineReducers } from '@reduxjs/toolkit';
import userReducer from './userSlice';
import themeReducer from './themeSlice';
import dataReducer from './dataSlice';
import optionChainReducer from './optionData';
import tcaReducer from './tcaSlice';
import authReducer from './authSlice';
import toastReducer from './toastSlice';
import configReducer from './configSlice';
import chartReducer from "./chartSlice";
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage'; // defaults to localStorage for web

// Define data persist config (nested)
const dataPersistConfig = {
  key: 'data',
  storage,
  whitelist: ['sid', 'exp_sid'] // Only persist symbol and selected expiry
};

// Define root reducer
const rootReducer = combineReducers({
  user: userReducer,
  theme: themeReducer,
  data: persistReducer(dataPersistConfig, dataReducer), // Nested persistence
  optionChain: optionChainReducer,
  tca: tcaReducer,
  config: configReducer,
  auth: authReducer,
  toast: toastReducer,
  chart: chartReducer,
});

// Configure persistence
const persistConfig = {
  key: 'root',
  storage,
  // Whitelist: slices we WANT to persist
  // Note: 'data' is included, but its internal storage is managed by its own config effectively
  whitelist: ['auth', 'theme', 'config', 'user', 'tca', 'chart', 'data']
};

const persistedReducer = persistReducer(persistConfig, rootReducer);


export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore redux-persist actions
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE', 'persist/REGISTER'],
      },
    }),
});

export const persistor = persistStore(store);

export default store;
