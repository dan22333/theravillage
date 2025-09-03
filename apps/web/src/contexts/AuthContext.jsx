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
  // Initialize with cached data for immediate rendering
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(() => {
    // If we have cached data, don't show loading
    try {
      const cached = localStorage.getItem('theravillage_user_data');
      return !cached; // Only show loading if no cached data
    } catch {
      return true;
    }
  });
  const [isRegistered, setIsRegistered] = useState(false);
  const [userData, setUserData] = useState(() => {
    // Try to get cached user data for immediate rendering
    try {
      const cached = localStorage.getItem('theravillage_user_data');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [auth, setAuth] = useState(null);
  const [googleProvider, setGoogleProvider] = useState(null);
  const [isStable, setIsStable] = useState(false);

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
            setUserData(null);
            // Clear cached data if user signs out
            localStorage.removeItem('theravillage_user_data');
          }
          setLoading(false);
          setIsStable(true);
        });

        // If we have cached data, assume user is logged in and skip initial loading
        try {
          const cached = localStorage.getItem('theravillage_user_data');
          if (cached) {
            setLoading(false); // Skip loading screen
            setIsStable(true);
          }
        } catch (error) {
          console.warn('Failed to read cached data:', error);
        }

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
      // Get Firebase token for authenticated request
      const token = await user.getIdToken();
      
      // Use authenticated endpoint to check current user
      const response = await fetch(`${API_URL}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        console.log('AuthContext: User exists, role:', userData.role);
        setUserData(userData);
        setIsRegistered(true);
        setIsAdmin(userData.role === 'admin');
        
        // Cache user data for immediate rendering on refresh
        try {
          localStorage.setItem('theravillage_user_data', JSON.stringify(userData));
        } catch (error) {
          console.warn('Failed to cache user data:', error);
        }
        
        return { exists: true, userData };
      } else if (response.status === 404) {
        // User not found - needs registration
        console.log('AuthContext: User does not exist');
        setIsRegistered(false);
        setIsAdmin(false);
        return { exists: false };
      } else {
        // Handle other error statuses
        console.error('AuthContext: Error checking user:', response.status);
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

  const signInWithGoogle = async (forceAccountPicker = false) => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase not initialized');
    }

    try {
      // If forceAccountPicker is true, sign out first to force account selection
      if (forceAccountPicker) {
        await signOut(auth);
        // Add a small delay to ensure sign-out completes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
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
      
      // Handle popup blocked error
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by browser. Please allow popups for this site and try again.');
      }
      
      // Handle popup closed error
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      
      throw error;
    }
  };

  const signInWithGoogleForInvitation = async (forceAccountPicker = false) => {
    if (!auth || !googleProvider) {
      throw new Error('Firebase not initialized');
    }

    try {
      // If forceAccountPicker is true, sign out first to force account selection
      if (forceAccountPicker) {
        await signOut(auth);
        // Add a small delay to ensure sign-out completes
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // For invitations, we don't auto-register - let the invitation flow handle it
      return result;
    } catch (error) {
      console.error('Sign-in error:', error);
      
      // Handle popup blocked error
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Popup was blocked by browser. Please allow popups for this site and try again.');
      }
      
      // Handle popup closed error
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again.');
      }
      
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
        body: JSON.stringify({ 
          token,
          name: user.displayName || user.email?.split('@')[0] || 'User'
        })
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
      // Clear cached data on sign out
      localStorage.removeItem('theravillage_user_data');
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  const getToken = async () => {
    if (!user) return null;
    try {
      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  };

  const refreshUserState = async () => {
    if (user) {
      return await checkUserRegistration(user);
    }
    return null;
  };

  const value = {
    user,
    isAdmin,
    isRegistered,
    loading,
    userData,
    isStable,
    signInWithGoogle,
    signInWithGoogleForInvitation,
    signOut: signOutUser,
    checkUserRegistration,
    getToken,
    auth,
    refreshUserState
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
