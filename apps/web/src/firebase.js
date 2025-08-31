import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { firebaseConfig } from './config/firebase.js';

// Initialize Firebase with direct config
let app = null;
let auth = null;
let googleProvider = null;

export const initializeFirebase = async () => {
  if (app) {
    return { app, auth, googleProvider };
  }

  // Use the config directly - no need to fetch from backend
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  googleProvider = new GoogleAuthProvider();

  return { app, auth, googleProvider };
};

// Export getters for backward compatibility
export const getAuthInstance = () => auth;
export const getGoogleProvider = () => googleProvider;
export const getApp = () => app;

// Legacy exports (will be null until initialized)
export { auth, googleProvider };
export default app;
