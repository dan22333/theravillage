import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeFirebase } from '../firebase';
import { signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';

const AuthContext = createContext();

// Get API URL from environment variables (REQUIRED)
const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is required. Please check your .env file.');
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRegistered, setIsRegistered] = useState(false);
  const [auth, setAuth] = useState(null);
  const [googleProvider, setGoogleProvider] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { auth: authInstance, googleProvider: provider } = await initializeFirebase();
        setAuth(authInstance);
        setGoogleProvider(provider);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
          setUser(user);
          if (user) {
            await checkUserRegistration(user);
          } else {
            setIsAdmin(false);
            setIsRegistered(false);
          }
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Failed to initialize Firebase:', error);
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const checkUserRegistration = async (user) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setIsRegistered(true);
        setIsAdmin(userData.is_admin || false);
        return { exists: true, userData };
      } else if (response.status === 404) {
        setIsRegistered(false);
        setIsAdmin(false);
        return { exists: false };
      } else {
        // Handle other error statuses
        setIsRegistered(false);
        setIsAdmin(false);
        return { exists: false };
      }
    } catch (error) {
      console.error('Error checking registration:', error);
      setIsRegistered(false);
      setIsAdmin(false);
      return { exists: false };
    }
  };

  const signInWithGoogle = async () => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase not initialized');
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // First check if user is already registered
      const userCheckResult = await checkUserRegistration(user);
      
      // If user not found, try to register them
      if (!userCheckResult?.exists) {
        await registerUser(user);
      }
      
      return result;
    } catch (error) {
      console.error('Sign-in error:', error);
      throw error;
    }
  };

  const registerUser = async (user) => {
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token })
      });

      if (response.ok) {
        setIsRegistered(true);
        await checkUserRegistration(user);
        return { success: true, message: 'Registration successful! Welcome to TheraVillage!' };
      } else if (response.status === 400) {
        // User already registered
        setIsRegistered(true);
        await checkUserRegistration(user);
        return { success: true, message: 'Welcome back!' };
      } else {
        throw new Error('Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  };

  const signOutUser = async () => {
    if (!auth) {
      console.error('Firebase not initialized');
      return;
    }

    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const value = {
    user,
    isAdmin,
    isRegistered,
    loading,
    signInWithGoogle,
    signOut: signOutUser,
    checkUserRegistration
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
