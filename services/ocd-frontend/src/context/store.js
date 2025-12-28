// store.js
import { configureStore } from '@reduxjs/toolkit';
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

const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['auth'] // only persist the auth reducer
};

const persistedAuthReducer = persistReducer(persistConfig, authReducer);



export const store = configureStore({
  reducer: {
    user: userReducer,
    theme: themeReducer,
    data: dataReducer,
    optionChain: optionChainReducer,
    tca: tcaReducer,
    config: configReducer,
    auth: persistedAuthReducer,
    toast: toastReducer,
    chart: chartReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export const persistor = persistStore(store);

export default store;
