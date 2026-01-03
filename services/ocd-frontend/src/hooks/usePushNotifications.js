import { useEffect, useCallback, useState } from 'react';
import { useDispatch } from 'react-redux';
import { addToast } from '../context/toastSlice';
import { setupPushNotifications, onForegroundMessage } from '../firebase/init';
import notificationService from '../services/notificationService';

/**
 * Hook for managing push notifications
 * Sets up FCM, registers token with backend, and handles incoming messages
 */
const usePushNotifications = (isAuthenticated = false) => {
    const dispatch = useDispatch();
    const [permission, setPermission] = useState(Notification?.permission || 'default');
    const [fcmToken, setFcmToken] = useState(null);
    const [isSupported, setIsSupported] = useState(false);

    // Check browser support
    useEffect(() => {
        const supported =
            typeof window !== 'undefined' &&
            'Notification' in window &&
            'serviceWorker' in navigator;
        setIsSupported(supported);

        if (supported) {
            setPermission(Notification.permission);
        }
    }, []);

    // Setup push notifications when authenticated
    useEffect(() => {
        if (!isAuthenticated || !isSupported) return;

        let unsubscribe = () => { };

        const setup = async () => {
            try {
                // Setup and register token with backend
                const token = await setupPushNotifications(notificationService.registerFCMToken);
                setFcmToken(token);

                if (token) {
                    setPermission('granted');
                }

                // Listen for foreground messages
                unsubscribe = onForegroundMessage((payload) => {
                    // Show toast for foreground notifications
                    const { notification, data } = payload;

                    dispatch(addToast({
                        title: notification?.title || 'Notification',
                        message: notification?.body || '',
                        type: data?.type || 'notification',
                        duration: data?.priority === 'urgent' ? 10000 : 5000,
                        action: data?.action_url ? {
                            label: data?.action_label || 'View',
                            onClick: () => window.location.href = data.action_url,
                        } : undefined,
                    }));

                    // Play sound if enabled
                    if (data?.sound_enabled !== 'false') {
                        notificationService.playSound(data?.priority || 'normal', true);
                    }
                });
            } catch (error) {
                console.error('Error setting up push notifications:', error);
            }
        };

        setup();

        return () => {
            unsubscribe();
        };
    }, [isAuthenticated, isSupported, dispatch]);

    // Request permission manually
    const requestPermission = useCallback(async () => {
        if (!isSupported) {
            console.warn('Push notifications not supported');
            return null;
        }

        try {
            const token = await setupPushNotifications(notificationService.registerFCMToken);
            setFcmToken(token);
            setPermission(token ? 'granted' : 'denied');
            return token;
        } catch (error) {
            console.error('Error requesting permission:', error);
            return null;
        }
    }, [isSupported]);

    return {
        isSupported,
        permission,
        fcmToken,
        requestPermission,
    };
};

export default usePushNotifications;
