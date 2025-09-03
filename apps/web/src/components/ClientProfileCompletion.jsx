import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ClientProfileCompletion.css';

const ClientProfileCompletion = () => {
  const { user, userData, getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileStatus, setProfileStatus] = useState(null);
  const [formData, setFormData] = useState({
    address: {
      street: '',
      city: '',
      state: '',
      zip: ''
    },
    school: '',
    diagnosis_codes: '',
    payer_id: '',
    auth_lims: {
      sessions_remaining: '',
      expires_date: ''
    },
    goals: ''
  });

  useEffect(() => {
    checkAccessAndProfileStatus();
  }, [user, userData]);

  const checkAccessAndProfileStatus = async () => {
    try {
      // Check if user is authenticated
      if (!user) {
        setError('Please sign in to access this page.');
        return;
      }

      // Check if user is a client
      if (userData?.role !== 'client') {
        setError('This page is only for clients. You will be redirected to your dashboard.');
        setTimeout(() => {
          window.location.href = '/';
        }, 2000);
        return;
      }

      // Check profile status
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/client/profile-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const status = await response.json();
        setProfileStatus(status);
        
        // If profile is already complete, redirect to client dashboard
        if (status.profile_complete) {
          setError('Your profile is already complete. Redirecting to dashboard...');
          setTimeout(() => {
            window.location.href = '/';
          }, 2000);
          return;
        }
      } else {
        setError('Failed to check profile status. Please try again.');
      }
    } catch (err) {
      console.error('Error checking access and profile status:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const validateForm = () => {
    const errors = [];
    
    if (!formData.address.street.trim()) errors.push('Street address is required');
    if (!formData.address.city.trim()) errors.push('City is required');
    if (!formData.address.state.trim()) errors.push('State is required');
    if (!formData.address.zip.trim()) errors.push('ZIP code is required');
    if (!formData.school.trim()) errors.push('School is required');
    if (!formData.diagnosis_codes.trim()) errors.push('Diagnosis codes are required');
    if (!formData.payer_id.trim()) errors.push('Payer ID is required');
    if (!formData.auth_lims.sessions_remaining.trim()) errors.push('Sessions remaining is required');
    if (!formData.auth_lims.expires_date.trim()) errors.push('Authorization expiration date is required');
    if (!formData.goals.trim()) errors.push('Goals are required');
    
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
      setError('Please fill in all required fields: ' + errors.join(', '));
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/client/complete-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          address: formData.address,
          school: formData.school,
          diagnosis_codes: formData.diagnosis_codes.split(',').map(code => code.trim()),
          payer_id: formData.payer_id,
          auth_lims: formData.auth_lims,
          goals: formData.goals.split(',').map(goal => goal.trim())
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess('Profile completed successfully! You can now access all features.');
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to complete profile');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error completing profile:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className="auth-container" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)' }}>
        <div className="auth-card" style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', padding: '48px', maxWidth: '400px', width: '100%' }}>
          <div className="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#6C757D', fontSize: '18px' }}>
            <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid #F8F9FA', borderTop: '4px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
            <p>Checking your profile status...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <>
        <div className="profile-completion">
          <div className="completion-message">
            <h1>⚠️ {error}</h1>
            <p>Please wait while we redirect you...</p>
          </div>
        </div>
      </>
    );
  }

  // Show success state for completed profiles
  if (profileStatus?.profile_complete) {
    return (
      <>
        <div className="profile-completion">
          <div className="completion-message">
            <h1>✅ Profile Complete!</h1>
            <p>Your profile has been completed successfully. You can now access all features of TheraVillage.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="profile-completion" style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '24px 0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'auto' }}>
      <div className="completion-container" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px' }}>
        <div className="completion-header" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '32px', padding: '32px', textAlign: 'center' }}>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>Complete Your Profile</h1>
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>Please provide the following information to complete your profile and activate your account.</p>
        </div>

        <div className="form-container" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '32px' }}>
        <form onSubmit={handleSubmit} className="profile-form">
          <div className="form-section">
            <h2>Address Information</h2>
            
            <div className="form-group">
              <label htmlFor="address.street">Street Address *</label>
              <input
                type="text"
                id="address.street"
                name="address.street"
                value={formData.address.street}
                onChange={handleInputChange}
                required
                placeholder="Enter street address"
              />
            </div>

            <div className="address-row">
              <div className="form-group">
                <label htmlFor="address.city">City *</label>
                <input
                  type="text"
                  id="address.city"
                  name="address.city"
                  value={formData.address.city}
                  onChange={handleInputChange}
                  required
                  placeholder="City"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address.state">State *</label>
                <input
                  type="text"
                  id="address.state"
                  name="address.state"
                  value={formData.address.state}
                  onChange={handleInputChange}
                  required
                  placeholder="State"
                  maxLength="2"
                />
              </div>

              <div className="form-group">
                <label htmlFor="address.zip">ZIP Code *</label>
                <input
                  type="text"
                  id="address.zip"
                  name="address.zip"
                  value={formData.address.zip}
                  onChange={handleInputChange}
                  required
                  placeholder="ZIP"
                  maxLength="10"
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>School Information</h2>
            
            <div className="form-group">
              <label htmlFor="school">School Name *</label>
              <input
                type="text"
                id="school"
                name="school"
                value={formData.school}
                onChange={handleInputChange}
                required
                placeholder="Enter school name"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Clinical Information</h2>
            
            <div className="form-group">
              <label htmlFor="diagnosis_codes">Diagnosis Codes *</label>
              <input
                type="text"
                id="diagnosis_codes"
                name="diagnosis_codes"
                value={formData.diagnosis_codes}
                onChange={handleInputChange}
                required
                placeholder="Enter diagnosis codes (comma-separated)"
              />
            </div>

            <div className="form-group">
              <label htmlFor="payer_id">Payer ID *</label>
              <input
                type="text"
                id="payer_id"
                name="payer_id"
                value={formData.payer_id}
                onChange={handleInputChange}
                required
                placeholder="Enter payer ID"
              />
            </div>

            <div className="auth-limits-row">
              <div className="form-group">
                <label htmlFor="auth_lims.sessions_remaining">Sessions Remaining *</label>
                <input
                  type="number"
                  id="auth_lims.sessions_remaining"
                  name="auth_lims.sessions_remaining"
                  value={formData.auth_lims.sessions_remaining}
                  onChange={handleInputChange}
                  required
                  placeholder="Number of sessions"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label htmlFor="auth_lims.expires_date">Authorization Expires *</label>
                <input
                  type="date"
                  id="auth_lims.expires_date"
                  name="auth_lims.expires_date"
                  value={formData.auth_lims.expires_date}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="goals">Treatment Goals *</label>
              <textarea
                id="goals"
                name="goals"
                value={formData.goals}
                onChange={handleInputChange}
                required
                placeholder="Enter treatment goals (comma-separated)"
                rows="3"
              />
            </div>
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Completing Profile...' : 'Complete Profile'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default ClientProfileCompletion;
