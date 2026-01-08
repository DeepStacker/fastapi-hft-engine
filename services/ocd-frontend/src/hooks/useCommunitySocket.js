/**
 * useCommunitySocket Hook
 * Real-time WebSocket connection for community updates
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';

const WS_BASE = import.meta.env.VITE_WS_URL || 'ws://localhost/api/v1';

export const useCommunitySocket = (roomSlug) => {
    const [newPosts, setNewPosts] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState(0);
    const wsRef = useRef(null);
    const token = useSelector((state) => state.auth?.token);

    const connect = useCallback(() => {
        if (!roomSlug || !token) return;

        const wsUrl = `${WS_BASE}/community/rooms/${roomSlug}/ws?token=${token}`;
        console.log('[Community WS] Connecting to:', wsUrl);

        try {
            wsRef.current = new WebSocket(wsUrl);

            wsRef.current.onopen = () => {
                console.log('[Community WS] Connected');
                setIsConnected(true);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    switch (message.type) {
                        case 'new_post':
                            setNewPosts((prev) => [message.data, ...prev]);
                            break;
                        case 'online_count':
                            setOnlineUsers(message.data.count);
                            break;
                        case 'post_updated':
                            // Could be used to update reactions in real-time
                            break;
                        default:
                            console.log('[Community WS] Unknown message:', message);
                    }
                } catch (err) {
                    console.error('[Community WS] Parse error:', err);
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('[Community WS] Error:', error);
            };

            wsRef.current.onclose = () => {
                console.log('[Community WS] Disconnected');
                setIsConnected(false);
            };
        } catch (err) {
            console.error('[Community WS] Connection failed:', err);
        }
    }, [roomSlug, token]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const clearNewPosts = useCallback(() => {
        setNewPosts([]);
    }, []);

    useEffect(() => {
        connect();
        return () => disconnect();
    }, [connect, disconnect]);

    return {
        newPosts,
        newPostCount: newPosts.length,
        isConnected,
        onlineUsers,
        clearNewPosts,
        reconnect: connect,
    };
};

export default useCommunitySocket;
