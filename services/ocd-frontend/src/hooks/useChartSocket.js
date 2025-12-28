/**
 * Chart WebSocket Hook - Real-time OHLCV streaming
 * Connects to /ws/charts endpoint with msgpack binary decoding
 * Features: Auto-reconnect, polling fallback, connection quality tracking
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { decode } from '@msgpack/msgpack';
import logger from '../utils/logger';

// Get WebSocket URL from Redux config or fallback
const getWsUrl = (baseURL) => {
    if (!baseURL) {
        return 'ws://localhost:8000/ws/charts';
    }
    // Convert http(s) to ws(s)
    return baseURL.replace(/^http/, 'ws').replace('/api/v1', '') + '/ws/charts';
};

/**
 * Chart WebSocket Hook
 * @param {Function} onTickReceived - Callback when new tick data arrives
 * @param {Object} options - Configuration options
 * @returns {Object} - Connection state and control functions
 */
const useChartSocket = (onTickReceived, options = {}) => {
    const socketRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const heartbeatIntervalRef = useRef(null);
    const onTickReceivedRef = useRef(onTickReceived);

    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [connectionQuality, setConnectionQuality] = useState('unknown');

    const reconnectAttemptsRef = useRef(0);
    const lastPongTimeRef = useRef(Date.now());

    const { baseURL } = useSelector((state) => state.config);

    const {
        autoConnect = true,
        maxReconnectAttempts = 10,
        heartbeatInterval = 15000,
    } = options;

    // Keep callback ref updated
    useEffect(() => {
        onTickReceivedRef.current = onTickReceived;
    }, [onTickReceived]);

    // Decode msgpack or JSON message
    const decodeMessage = useCallback(async (data) => {
        if (data instanceof Blob) {
            const buffer = await data.arrayBuffer();
            return decode(new Uint8Array(buffer));
        } else if (data instanceof ArrayBuffer) {
            return decode(new Uint8Array(data));
        } else if (typeof data === 'string') {
            return JSON.parse(data);
        }
        return data;
    }, []);

    // Start heartbeat monitoring
    const startHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
        }

        heartbeatIntervalRef.current = setInterval(() => {
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                socketRef.current.send(JSON.stringify({ type: 'ping' }));

                // Check connection quality
                const timeSinceLastPong = Date.now() - lastPongTimeRef.current;
                if (timeSinceLastPong > 30000) {
                    setConnectionQuality('poor');
                } else if (timeSinceLastPong > 15000) {
                    setConnectionQuality('fair');
                } else {
                    setConnectionQuality('good');
                }
            }
        }, heartbeatInterval);
    }, [heartbeatInterval]);

    // Stop heartbeat
    const stopHeartbeat = useCallback(() => {
        if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
            heartbeatIntervalRef.current = null;
        }
    }, []);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        const wsUrl = getWsUrl(baseURL);
        logger.log('🔌 Charts WS connecting to:', wsUrl);

        try {
            socketRef.current = new WebSocket(wsUrl);

            socketRef.current.onopen = () => {
                logger.log('✅ Charts WS Connected');
                setIsConnected(true);
                setError(null);
                setConnectionQuality('good');
                reconnectAttemptsRef.current = 0;
                startHeartbeat();
            };

            socketRef.current.onmessage = async (event) => {
                try {
                    const data = await decodeMessage(event.data);

                    if (data.type === 'connected') {
                        logger.log('📡 Charts WS confirmed:', data.client_id);
                    } else if (data.type === 'subscribed') {
                        logger.log('📊 Charts subscribed:', data.symbol, data.interval);
                        setSubscription({ symbol: data.symbol, interval: data.interval });
                    } else if (data.type === 'pong') {
                        lastPongTimeRef.current = Date.now();
                    } else if (data.type === 'tick') {
                        // Pass tick data to callback
                        if (onTickReceivedRef.current) {
                            onTickReceivedRef.current(data);
                        }
                    } else if (data.type === 'error') {
                        logger.error('Charts WS error:', data.message);
                        setError(data.message);
                    }
                } catch (err) {
                    logger.error('Charts WS message decode error:', err);
                }
            };

            socketRef.current.onclose = (event) => {
                logger.log('📴 Charts WS closed:', event.code, event.reason);
                setIsConnected(false);
                setSubscription(null);
                stopHeartbeat();

                // Auto-reconnect with exponential backoff
                if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
                    const jitter = Math.random() * 1000;

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttemptsRef.current++;
                        logger.log(`🔄 Charts WS reconnecting (attempt ${reconnectAttemptsRef.current})...`);
                        connect();
                    }, delay + jitter);
                } else {
                    setError('Max reconnection attempts reached');
                    setConnectionQuality('disconnected');
                }
            };

            socketRef.current.onerror = (event) => {
                logger.error('Charts WS error:', event);
                setError('WebSocket connection error');
            };
        } catch (err) {
            logger.error('Charts WS connection failed:', err);
            setError(err.message);
        }
    }, [baseURL, startHeartbeat, stopHeartbeat, decodeMessage, maxReconnectAttempts]);

    // Disconnect from WebSocket
    const disconnect = useCallback(() => {
        stopHeartbeat();

        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = null;
        }

        if (socketRef.current) {
            socketRef.current.close(1000, 'Client disconnect');
            socketRef.current = null;
        }

        setIsConnected(false);
        setSubscription(null);
        reconnectAttemptsRef.current = maxReconnectAttempts; // Prevent auto-reconnect
    }, [stopHeartbeat, maxReconnectAttempts]);

    // Subscribe to symbol/interval
    const subscribe = useCallback((symbol, interval) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            logger.log('📊 Subscribing to chart:', symbol, interval);
            socketRef.current.send(JSON.stringify({
                type: 'subscribe',
                symbol: symbol.toUpperCase(),
                interval: interval,
            }));
        } else {
            logger.warn('Charts WS not connected, cannot subscribe');
        }
    }, []);

    // Unsubscribe
    const unsubscribe = useCallback(() => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'unsubscribe' }));
            setSubscription(null);
        }
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [autoConnect, connect, disconnect]);

    return {
        isConnected,
        error,
        subscription,
        connectionQuality,
        connect,
        disconnect,
        subscribe,
        unsubscribe,
    };
};

export default useChartSocket;
