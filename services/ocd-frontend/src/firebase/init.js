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

import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { googleProvider } from './providers';

const listenToAuthChanges = (callback) => {
  return onAuthStateChanged(auth, callback);
};

const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // The signed-in user info.
    const user = result.user;
    // This gives you a Google Access Token. You can use it to access the Google API.
    // const credential = GoogleAuthProvider.credentialFromResult(result);
    console.log("Google Sign-in successful:", user);
    return user;
  } catch (error) {
    console.error("Google Sign-in Error:", error.message);
    throw error;
  }
};


export { app, auth, listenToAuthChanges, signInWithGoogle };
