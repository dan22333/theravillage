// Firebase Configuration - Direct configuration
export const firebaseConfig = {
  apiKey: "AIzaSyACrvzdsRee2iDXypKh3FoPqVVHEi3Hod4",
  authDomain: "theravillage-edb89.firebaseapp.com",
  projectId: "theravillage-edb89",
  storageBucket: "theravillage-edb89.firebasestorage.app",
  messagingSenderId: "326430627435",
  appId: "1:326430627435:web:945cffc0162b41d451832e",
  measurementId: "G-TR613CVSKF"
};

// Legacy async function for backward compatibility
export const getFirebaseConfig = async () => {
  return firebaseConfig;
};
