// Firebase Cloud Messaging Service Worker
// This service worker handles push notifications when the app is in background

// Import Firebase scripts for service workers
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration - must match the app config
// Note: In production, these should be injected during build
const firebaseConfig = {
    apiKey: self.VITE_FIREBASE_API_KEY || '',
    authDomain: self.VITE_FIREBASE_AUTH_DOMAIN || '',
    projectId: self.VITE_FIREBASE_PROJECT_ID || '',
    storageBucket: self.VITE_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: self.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message:', payload);

    const notificationTitle = payload.notification?.title || 'Stockify Alert';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge-icon.png',
        tag: payload.data?.tag || 'stockify-notification',
        data: payload.data || {},
        actions: [
            { action: 'open', title: 'Open' },
            { action: 'dismiss', title: 'Dismiss' },
        ],
        vibrate: [100, 50, 100],
        requireInteraction: payload.data?.priority === 'urgent',
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    console.log('[firebase-messaging-sw.js] Notification clicked:', event);

    event.notification.close();

    if (event.action === 'dismiss') {
        return;
    }

    // Get the action URL from notification data
    const urlToOpen = event.notification.data?.action_url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If an existing window is available, focus it
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(urlToOpen);
                    return client.focus();
                }
            }
            // Otherwise, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});

// Handle service worker installation
self.addEventListener('install', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker installed');
    self.skipWaiting();
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
    console.log('[firebase-messaging-sw.js] Service Worker activated');
    event.waitUntil(clients.claim());
});
