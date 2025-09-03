import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return (
    <div className="client-dashboard" style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '24px 0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'auto' }}>
      <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div className="dashboard-header" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '32px', padding: '32px', textAlign: 'center', position: 'relative' }}>
          <button 
            onClick={handleSignOut}
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              padding: '8px 16px', 
              backgroundColor: '#FF6B6B', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
            Sign Out
          </button>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>Client Dashboard</h1>
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>Welcome to your client portal</p>
        </div>
        
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-label">Upcoming Sessions</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-label">Completed Sessions</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-label">Goals Achieved</div>
          </div>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
              My Sessions
            </h2>
            <p>View your upcoming and past therapy sessions</p>
            <button className="btn btn-primary" onClick={() => alert('Sessions feature coming soon!')}>
              View Sessions
            </button>
          </div>
          
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="currentColor"/>
              </svg>
              Progress Reports
            </h2>
            <p>Track your therapy progress and goals</p>
            <button className="btn btn-primary" onClick={() => alert('Progress tracking coming soon!')}>
              View Progress
            </button>
          </div>
          
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H6L4 18V4H20V16Z" fill="currentColor"/>
              </svg>
              Messages
            </h2>
            <p>Communicate with your therapist</p>
            <button className="btn btn-primary" onClick={() => alert('Messaging feature coming soon!')}>
              Open Messages
            </button>
          </div>
        </div>
        
        <div className="dashboard-actions">
          <button className="btn btn-secondary" onClick={handleSignOut}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
