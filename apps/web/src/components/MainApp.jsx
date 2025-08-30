import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'
import './MainApp.css'

const MainApp = () => {
  const { user, isAdmin, isRegistered, loading, signInWithGoogle, signOut } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState({ type: '', message: '' })

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign-in error:', error)
      showStatus('error', 'Sign-in failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut()
      showStatus('info', 'Signed out successfully')
    } catch (error) {
      console.error('Sign-out error:', error)
      showStatus('error', 'Sign-out failed')
    }
  }

  // Show status messages
  const showStatus = (type, message) => {
    setStatus({ type, message })
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      setStatus({ type: '', message: '' })
    }, 5000)
  }

  // Loading spinner
  if (loading || isLoading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Signing you in...</p>
        </div>
      </div>
    )
  }

  // Welcome screen (user is signed in and registered)
  if (user && isRegistered) {
    return (
      <div className="container">
        <div className="welcome-card">
          <div className="welcome-header">
            <h1>🌿 Welcome to TheraVillage</h1>
            <p>Your wellness journey continues here</p>
          </div>
          
          <div className="user-info">
            <div className="user-avatar">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Profile" />
              ) : (
                <div className="avatar-placeholder">
                  {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
                </div>
              )}
            </div>
            
            <div className="user-details">
              <h2>Hello there, {user.displayName || 'User'}!</h2>
              <p className="user-email">{user.email}</p>
              <p className="user-status">✅ Account verified and ready</p>
              {isAdmin && (
                <p className="admin-badge">👑 Admin Access</p>
              )}
            </div>
          </div>
          
          <div className="welcome-actions">
            {isAdmin && (
              <Link to="/admin" className="admin-btn">
                🔐 Admin Panel
              </Link>
            )}
            <button className="primary-btn" onClick={() => showStatus('info', 'Dashboard coming soon!')}>
              🚀 Go to Dashboard
            </button>
            <button className="secondary-btn" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </div>
        
        {status.message && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    )
  }

  // Login screen (user not signed in or not registered)
  return (
    <div className="container">
      <div className="login-card">
        <div className="logo">
          <h1>🌿 TheraVillage</h1>
          <p>Your wellness journey starts here</p>
        </div>
        
        <div className="login-section">
          <h2>Welcome Back</h2>
          <p>Sign in with Google to continue your wellness journey</p>
          
          {/* Google Sign-In Button */}
          <button className="google-btn" onClick={handleGoogleSignIn} disabled={isLoading}>
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google" />
            {isLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          
          {user && !isRegistered && (
            <div className="registration-notice">
              <p>🔄 Setting up your account...</p>
            </div>
          )}
        </div>
        
        {status.message && (
          <div className={`status ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  )
}

export default MainApp
