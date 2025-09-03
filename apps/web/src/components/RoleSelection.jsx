import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './RoleSelection.css';

const RoleSelection = () => {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRoleSelection = async () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await user.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/users/select-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          role: selectedRole
        })
      });

      if (response.ok) {
        setSuccess('Role selected successfully! Redirecting...');
        // Reload the page to update the auth context
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to select role');
      }
    } catch (error) {
      setError('Failed to select role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    {
      id: 'therapist',
      title: 'Therapist',
      description: 'I provide therapy services to clients',
      icon: '👨‍⚕️',
      color: '#4CAF50'
    },
    {
      id: 'agency',
      title: 'Agency',
      description: 'I represent a therapy agency or organization',
      icon: '🏢',
      color: '#FF9800'
    }
  ];

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
              <path d="M19 15L19.5 17.5L22 18L19.5 18.5L19 21L18.5 18.5L16 18L18.5 17.5L19 15Z" fill="currentColor"/>
              <path d="M5 15L5.5 17.5L8 18L5.5 18.5L5 21L4.5 18.5L2 18L4.5 17.5L5 15Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="auth-title">Welcome to TheraVillage!</h1>
          <p className="auth-subtitle">Please select your role to get started</p>
          <p className="client-note">Note: Client accounts are created through therapist invitations only</p>
        </div>

        {error && (
          <div className="status-message error">
            {error}
          </div>
        )}

        {success && (
          <div className="status-message success">
            {success}
          </div>
        )}

        <div className="role-options">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`role-option ${selectedRole === role.id ? 'selected' : ''}`}
              onClick={() => setSelectedRole(role.id)}
            >
              <div className="role-icon">
                {role.id === 'therapist' ? (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                  </svg>
                ) : (
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 7V3H2V21H22V7H12ZM6 19H4V17H6V19ZM6 15H4V13H6V15ZM6 11H4V9H6V11ZM6 7H4V5H6V7ZM10 19H8V17H10V19ZM10 15H8V13H10V15ZM10 11H8V9H10V11ZM10 7H8V5H10V7ZM20 19H12V17H14V15H12V13H14V11H12V9H20V19Z" fill="currentColor"/>
                  </svg>
                )}
              </div>
              <div className="role-content">
                <h3>{role.title}</h3>
                <p>{role.description}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          className="btn btn-primary"
          onClick={handleRoleSelection}
          disabled={!selectedRole || loading}
        >
          {loading ? (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M7.76 7.76L4.93 4.93M19.07 19.07L16.24 16.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Setting up...
            </>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
};

export default RoleSelection;
