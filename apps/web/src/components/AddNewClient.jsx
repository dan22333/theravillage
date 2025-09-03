import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AddNewClient.css';

const AddNewClient = ({ onBack }) => {
  const { getToken } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    dob: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients/invite`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          dob: formData.dob || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess(`Invitation sent to ${formData.email}! The client will receive an email with a secure link to join TheraVillage.`);
        setFormData({
          name: '',
          email: '',
          dob: ''
        });
        setTimeout(() => {
          onBack();
        }, 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to send invitation');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error sending invitation:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="add-new-client" style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '24px 0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'auto' }}>
      <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div className="dashboard-header" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '32px', padding: '32px', textAlign: 'center', position: 'relative' }}>
          <button className="back-btn" onClick={onBack} style={{ position: 'absolute', top: '20px', left: '20px', padding: '8px 16px', backgroundColor: 'white', border: '2px solid #20B2AA', borderRadius: '8px', color: '#20B2AA', cursor: 'pointer', fontSize: '14px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="currentColor"/>
            </svg>
            Back to Dashboard
          </button>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>Add New Client</h1>
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>Send an invitation to a new client</p>
        </div>

        <div className="dashboard-card" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '32px' }}>
          <form onSubmit={handleSubmit} className="client-form">
            <div className="form-section">
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#343A40', margin: '0 0 8px 0', display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '16px', borderBottom: '2px solid #20B2AA' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M20 4H4C2.89 4 2 4.89 2 6V18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z" fill="#20B2AA"/>
                </svg>
                Client Invitation
              </h2>
              <p className="form-description" style={{ fontSize: '16px', color: '#6C757D', margin: '16px 0 24px 0' }}>
                Send an invitation to a new client. They will receive an email with a secure link to join TheraVillage.
              </p>
            
            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="name" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: '8px' }}>Full Name *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Enter client's full name"
                style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #E2E8F0', borderRadius: '8px', backgroundColor: 'white', color: '#343A40', transition: 'border-color 150ms ease-in-out' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="email" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: '8px' }}>Email Address *</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="Enter client's email address"
                style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #E2E8F0', borderRadius: '8px', backgroundColor: 'white', color: '#343A40', transition: 'border-color 150ms ease-in-out' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="dob" style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em', marginBottom: '8px' }}>Date of Birth</label>
              <input
                type="date"
                id="dob"
                name="dob"
                value={formData.dob}
                onChange={handleInputChange}
                style={{ width: '100%', padding: '12px 16px', fontSize: '16px', border: '2px solid #E2E8F0', borderRadius: '8px', backgroundColor: 'white', color: '#343A40', transition: 'border-color 150ms ease-in-out' }}
              />
            </div>
          </div>

          {error && <div className="error-message" style={{ backgroundColor: '#fee2e2', color: '#dc2626', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{error}</div>}
          {success && <div className="success-message" style={{ backgroundColor: '#dcfce7', color: '#16a34a', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>{success}</div>}

          <div className="form-actions" style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '32px' }}>
            <button type="button" className="cancel-btn" onClick={onBack} style={{ padding: '12px 24px', backgroundColor: 'white', border: '2px solid #6C757D', borderRadius: '8px', color: '#6C757D', fontWeight: '500', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={isLoading} style={{ padding: '12px 24px', backgroundColor: '#20B2AA', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '500', cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.6 : 1 }}>
              {isLoading ? 'Sending Invitation...' : 'Send Invitation'}
            </button>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddNewClient;
