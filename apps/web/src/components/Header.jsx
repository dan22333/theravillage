import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

const Header = () => {
  const { user, signOut, userData } = useAuth();
  
  // Don't show header on invitation pages
  if (window.location.pathname.includes('/invite/')) {
    return null;
  }

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  // Only show header on dashboard pages, not during auth loading
  if (!user || !userData) {
    return null; // Don't show header during auth loading
  }

  return (
    <header className="app-header">
      <div className="container">
        <div className="header-content">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
                  <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="currentColor"/>
                  <path d="M5 15L5.5 17.5L8 18L5.5 18.5L5 21L4.5 18.5L2 18L4.5 17.5L5 15Z" fill="currentColor"/>
                </svg>
              </div>
              <span className="logo-text">TheraVillage</span>
            </div>
          </div>
          
          <div className="header-center">
            <div className="user-info">
              <div className="user-avatar">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                </svg>
              </div>
              <div className="user-details">
                <span className="user-name">{user.displayName || user.email}</span>
                <span className="user-role">{userData?.role || 'User'}</span>
              </div>
            </div>
          </div>
          
          <div className="header-right">
            <button className="btn btn-secondary logout-btn" onClick={handleSignOut}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 9V5L3 12L10 19V14.9C15 14.9 18.5 16.5 21 20C20 15 17 10 10 9Z" fill="currentColor"/>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
