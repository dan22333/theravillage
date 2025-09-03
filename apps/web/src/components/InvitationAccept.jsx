import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { signOut } from 'firebase/auth';
import './InvitationAccept.css';

const InvitationAccept = () => {
  const { invitationToken } = useParams();
  const navigate = useNavigate();
  const { user, signInWithGoogleForInvitation, isRegistered, auth } = useAuth();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    fetchInvitationDetails();
  }, [invitationToken]);

  const fetchInvitationDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/invite/${invitationToken}`);
      
      if (response.ok) {
        const invitationData = await response.json();
        setInvitation(invitationData);
      } else if (response.status === 404) {
        setError('Invitation not found or has expired');
      } else {
        setError('Failed to load invitation details');
      }
    } catch (err) {
      setError('Network error while loading invitation');
      console.error('Error fetching invitation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptInvitationDirect = async (firebaseUser) => {
    // Check if the user email matches invitation email
    if (firebaseUser.email !== invitation.client_email) {
      setError(`Email mismatch! You are signed in with ${firebaseUser.email} but the invitation is for ${invitation.client_email}. Please sign in with the correct email.`);
      return;
    }

    // Proceed with acceptance
    setIsAccepting(true);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          name: invitation.client_name
        })
      });

      if (response.ok) {
        // Success! Redirect to client dashboard
        navigate('/', { replace: true });
      } else {
        const errorData = await response.json();
        if (errorData.detail && errorData.detail.includes("doesn't match any pending invitations")) {
          setError("Email mismatch: Please sign in with the email address that received the invitation.");
        } else {
          setError(errorData.detail || 'Failed to accept invitation');
        }
      }
    } catch (err) {
      setError('Network error while accepting invitation');
      console.error('Error accepting invitation:', err);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleAcceptInvitation = async () => {
    if (!user) {
      // If not logged in, redirect to login
      try {
        await signInWithGoogleForInvitation(true); // Force account picker
      } catch (error) {
        console.error('Sign-in error:', error);
        setError('Failed to sign in. Please try again.');
      }
      return;
    }

    // Check if logged in user email matches invitation email
    if (user.email !== invitation.client_email) {
      setError(`Email mismatch! You are signed in with ${user.email} but the invitation is for ${invitation.client_email}. Please sign in with the correct email.`);
      return;
    }

    // If already logged in with correct email, proceed with acceptance
    await handleAcceptInvitationDirect(user);
  };

  const handleSignIn = async () => {
    try {
      const result = await signInWithGoogleForInvitation(true); // Force account picker
      
      // Check if the signed-in email matches the invitation email
      if (result.user.email !== invitation.client_email) {
        setError(`Email mismatch! You signed in with ${result.user.email} but the invitation is for ${invitation.client_email}. Please sign in with the correct email.`);
        // Sign out the wrong user
        await signOut(auth);
        return;
      }
      
      // If email matches, proceed with invitation acceptance directly
      await handleAcceptInvitationDirect(result.user);
    } catch (error) {
      console.error('Sign-in error:', error);
      setError('Failed to sign in. Please try again.');
    }
  };

  const handleSignOutAndRetry = async () => {
    try {
      await signOut(auth);
      setError(null); // Clear any existing errors
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  if (loading) {
    return (
      <div className="auth-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' }}>
        <div className="auth-card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '48px', maxWidth: '400px', width: '100%' }}>
          <div className="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#6C757D', fontSize: '18px' }}>
            <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid #F8F9FA', borderTop: '4px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <p>Loading invitation details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isEmailMismatch = error.includes('Email mismatch');
    
    return (
      <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' }}>
        <div className="auth-card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '48px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div className="error-icon" style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 16px 0' }}>Invitation Error</h1>
          <p style={{ fontSize: '16px', color: '#6C757D', margin: '0 0 32px 0', lineHeight: '1.6' }}>{error}</p>
          <div className="error-actions" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isEmailMismatch ? (
              <>
                <button className="btn btn-secondary" onClick={handleSignOutAndRetry} style={{ padding: '12px 24px', backgroundColor: 'white', border: '2px solid #20B2AA', borderRadius: '8px', color: '#20B2AA', fontWeight: '500', cursor: 'pointer' }}>
                  Sign Out & Try Again
                </button>
                <button className="btn btn-primary" onClick={() => navigate('/')} style={{ padding: '12px 24px', backgroundColor: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
                  Go to Home
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => navigate('/')} style={{ padding: '12px 24px', backgroundColor: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
                Go to Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return (
      <div className="auth-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' }}>
        <div className="auth-card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '48px', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div className="error-icon" style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 16px 0' }}>Invalid Invitation</h1>
          <p style={{ fontSize: '16px', color: '#6C757D', margin: '0 0 32px 0', lineHeight: '1.6' }}>This invitation link is not valid or has expired.</p>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ padding: '12px 24px', backgroundColor: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: 'pointer' }}>
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' }}>
      <div className="auth-card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '48px', maxWidth: '600px', width: '100%' }}>
        <div className="auth-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div className="auth-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80px', height: '80px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)', borderRadius: '50%', color: 'white', margin: '0 auto 24px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
              <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="currentColor"/>
              <path d="M5 15L5.5 17.5L8 18L5.5 18.5L5 21L4.5 18.5L2 18L4.5 17.5L5 15Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>TheraVillage</h1>
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>You've been invited to join</p>
        </div>

        <div className="invitation-details">
          <div className="invitation-info" style={{ marginBottom: '32px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#343A40', margin: '0 0 16px 0', textAlign: 'center' }}>Welcome, {invitation.client_name}!</h2>
            <p style={{ fontSize: '16px', color: '#6C757D', margin: '0 0 24px 0', textAlign: 'center', lineHeight: '1.6' }}>You've been invited by <strong>{invitation.therapist_name}</strong> to join TheraVillage.</p>
            
            <div className="invitation-meta" style={{ backgroundColor: '#F8F9FA', borderRadius: '12px', padding: '24px', border: '1px solid #E2E8F0' }}>
              <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
                <span className="label" style={{ fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Client:</span>
                <span className="value" style={{ fontSize: '16px', fontWeight: '500', color: '#343A40' }}>{invitation.client_name}</span>
              </div>
              <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
                <span className="label" style={{ fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Email:</span>
                <span className="value" style={{ fontSize: '16px', fontWeight: '500', color: '#343A40' }}>{invitation.client_email}</span>
              </div>
              <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid #E2E8F0' }}>
                <span className="label" style={{ fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Therapist:</span>
                <span className="value" style={{ fontSize: '16px', fontWeight: '500', color: '#343A40' }}>{invitation.therapist_name}</span>
              </div>
              <div className="meta-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="label" style={{ fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Expires:</span>
                <span className="value" style={{ fontSize: '16px', fontWeight: '500', color: '#343A40' }}>{new Date(invitation.expires_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {!user ? (
            <div className="invitation-actions" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '16px', color: '#6C757D', margin: '0 0 16px 0' }}>Please sign in with Google to accept this invitation:</p>
              <div className="email-reminder" style={{ backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '8px', padding: '16px', margin: '0 0 24px 0' }}>
                <p style={{ fontSize: '14px', color: '#856404', margin: '0' }}><strong>Important:</strong> Make sure to sign in with <strong>{invitation.client_email}</strong></p>
              </div>
              <button 
                className="btn btn-primary google-btn" 
                onClick={handleSignIn}
                disabled={isAccepting}
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
                  cursor: isAccepting ? 'not-allowed' : 'pointer', 
                  opacity: isAccepting ? 0.6 : 1,
                  width: '100%'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          ) : (
            <div className="invitation-actions" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '16px', color: '#6C757D', margin: '0 0 24px 0' }}>Ready to accept this invitation?</p>
              <button 
                className="btn btn-primary" 
                onClick={handleAcceptInvitation}
                disabled={isAccepting}
                style={{ 
                  padding: '12px 24px', 
                  backgroundColor: '#20B2AA', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '8px', 
                  fontWeight: '500', 
                  cursor: isAccepting ? 'not-allowed' : 'pointer', 
                  opacity: isAccepting ? 0.6 : 1,
                  width: '100%'
                }}
              >
                {isAccepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message" style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginTop: '16px', textAlign: 'center' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default InvitationAccept;
