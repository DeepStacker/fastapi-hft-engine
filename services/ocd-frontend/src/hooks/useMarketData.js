import { useState, useCallback } from 'react';
import { marketDataService } from '../services/marketDataService';

export const useMarketData = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Get live market data
    const getLiveData = useCallback(async (symbol, expiry) => {
        setLoading(true);
        setError(null);
        try {
            const data = await marketDataService.getLiveData(symbol, expiry);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    // Get expiry dates
    const getExpiryDates = useCallback(async (symbol) => {
        setLoading(true);
        setError(null);
        try {
            const data = await marketDataService.getExpiryDates(symbol);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    // Get percentage data
    const getPercentageData = useCallback(async (symbol, expiry, isCe, strike) => {
        setLoading(true);
        setError(null);
        try {
            const data = await marketDataService.getPercentageData(symbol, expiry, isCe, strike);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    // Get IV data
    const getIVData = useCallback(async (symbol, expiry, isCe, strike) => {
        setLoading(true);
        setError(null);
        try {
            const data = await marketDataService.getIVData(symbol, expiry, isCe, strike);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    // Get delta data
    const getDeltaData = useCallback(async (symbol, expiry, strike) => {
        setLoading(true);
        setError(null);
        try {
            const data = await marketDataService.getDeltaData(symbol, expiry, strike);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    // Get futures data
    const getFuturesData = useCallback(async (symbol, expiry) => {
        setLoading(true);
        setError(null);
        try {
            const data = await marketDataService.getFuturesData(symbol, expiry);
            setLoading(false);
            return data;
        } catch (err) {
            setError(err.message);
            setLoading(false);
            throw err;
        }
    }, []);

    return {
        loading,
        error,
        getLiveData,
        getExpiryDates,
        getPercentageData,
        getIVData,
        getDeltaData,
        getFuturesData
    };
};
