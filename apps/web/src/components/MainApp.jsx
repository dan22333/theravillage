import React, { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import RoleSelection from './RoleSelection'
import TherapistDashboard from './TherapistDashboard'
import ClientDashboard from './ClientDashboard'
import ClientProfileCompletion from './ClientProfileCompletion'
import AgencyDashboard from './AgencyDashboard'
import AdminPanel from './AdminPanel'
import './MainApp.css'

const MainApp = () => {
  const { user, loading, signInWithGoogle, userData } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  
  // Debug logs removed

  // Get cached role for immediate rendering - make it reactive to user state changes
  const cachedUserData = React.useMemo(() => {
    // If user is null (logged out), don't use cached data
    if (user === null) {
      return null;
    }
    
    try {
      const cached = localStorage.getItem('theravillage_user_data');
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  }, [user]); // Add user as dependency so it updates when user logs out

  // IMMEDIATE DASHBOARD RENDERING - Use cached data first, then real data
  const userRole = userData?.role || cachedUserData?.role;
  
  if (userRole === 'therapist') {
    return <TherapistDashboard />
  }
  
  if (userRole === 'admin') {
    return <AdminPanel />
  }
  
  if (userRole === 'client') {
    return <ClientDashboard />
  }
  
  if (userRole === 'agency') {
    return <AgencyDashboard />
  }

  if (userData?.role === 'pending') {
    return <RoleSelection />
  }

  // Handle Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signInWithGoogle()
    } catch (error) {
      console.error('Sign-in error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // ONLY show login screen if no cached data AND no user
  // This should only happen for completely new users
  return (
    <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' }}>
      <div className="auth-card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '48px', maxWidth: '400px', width: '100%' }}>
        <div className="auth-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)', borderRadius: '50%', color: 'white', margin: '0 auto 24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
              <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="currentColor"/>
              <path d="M5 15L5.5 17.5L8 18L5.5 18.5L5 21L4.5 18.5L2 18L4.5 17.5L5 15Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>TheraVillage</h1>
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>Sign in to continue</p>
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={isLoading || loading}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '12px', 
            padding: '12px 24px', 
            backgroundColor: '#20B2AA', 
            color: 'white', 
            border: 'none', 
            borderRadius: '8px', 
            fontWeight: '500', 
            cursor: (isLoading || loading) ? 'not-allowed' : 'pointer', 
            opacity: (isLoading || loading) ? 0.6 : 1,
            width: '100%'
          }}
        >
          {(isLoading || loading) ? (
            <>
              <div style={{ width: '20px', height: '20px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              Signing in...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default MainApp