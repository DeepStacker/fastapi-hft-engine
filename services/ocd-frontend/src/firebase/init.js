// src/firebase/init.js
import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { firebaseConfig } from './config';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

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

export {
  app,
  auth,
  listenToAuthChanges,
  signInWithGoogle,
  registerWithEmail,
  loginWithEmail,
  sendPasswordReset,
  confirmPasswordReset
};
