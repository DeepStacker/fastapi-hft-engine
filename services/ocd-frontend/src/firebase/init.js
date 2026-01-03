// src/firebase/init.js
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { firebaseConfig } from './config';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Firebase Cloud Messaging (for push notifications)
let messaging = null;
try {
  // Only initialize messaging in browser environment with service worker support
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    messaging = getMessaging(app);
  }
} catch (error) {
  console.warn('FCM not available:', error.message);
}

// ✅ Set persistent auth state
const setAuthPersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log("Auth persistence set.");
  } catch (error) {
    console.error("Auth persistence error:", error.message);
  }
};

setAuthPersistence();

import {
  onAuthStateChanged,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset as firebaseConfirmPasswordReset,
  updateProfile
} from 'firebase/auth';
import { googleProvider } from './providers';

const listenToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, callback);
};

const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    console.log("Google Sign-in successful:", user);
    return user;
  } catch (error) {
    console.error("Google Sign-in Error:", error.message);
    throw error;
  }
};

const registerWithEmail = async (email, password, displayName) => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    if (displayName) {
      await updateProfile(user, { displayName });
    }
    console.log("Email Registration successful:", user);
    return user;
  } catch (error) {
    console.error("Email Registration Error:", error.message);
    throw error;
  }
};

const loginWithEmail = async (email, password) => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    console.log("Email Login successful:", user);
    return user;
  } catch (error) {
    console.error("Email Login Error:", error.message);
    throw error;
  }
};

const sendPasswordReset = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    console.log("Password reset email sent to:", email);
  } catch (error) {
    console.error("Password Reset Error:", error.message);
    throw error;
  }
};

const confirmPasswordReset = async (oobCode, newPassword) => {
  try {
    await firebaseConfirmPasswordReset(auth, oobCode, newPassword);
    console.log("Password reset confirmed.");
  } catch (error) {
    console.error("Confirm Password Reset Error:", error.message);
    throw error;
  }
};

// ============== Push Notifications (FCM) ==============

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM token or null if denied
 */
const requestNotificationPermission = async () => {
  if (!messaging) {
    console.warn('FCM not initialized');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined,
      });

      console.log('FCM Token obtained:', token?.slice(0, 20) + '...');
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Listen for foreground messages
 * @param {Function} callback - Called when message received
 * @returns {Function} Unsubscribe function
 */
const onForegroundMessage = (callback) => {
  if (!messaging) {
    console.warn('FCM not initialized');
    return () => { };
  }

  return onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    callback(payload);
  });
};

/**
 * Setup push notifications with backend registration
 * @param {Function} registerTokenFn - Function to register token with backend
 */
const setupPushNotifications = async (registerTokenFn) => {
  const token = await requestNotificationPermission();

  if (token && registerTokenFn) {
    try {
      await registerTokenFn(token);
      console.log('FCM token registered with backend');
    } catch (error) {
      console.error('Failed to register FCM token:', error);
    }
  }

  return token;
};

export {
  app,
  auth,
  messaging,
  listenToAuthChanges,
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  sendPasswordReset,
  confirmPasswordReset,
  // Push notification exports
  requestNotificationPermission,
  onForegroundMessage,
  setupPushNotifications,
};

