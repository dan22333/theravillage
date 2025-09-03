import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AgencyDashboard.css';

const AgencyDashboard = () => {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  return (
    <div className="agency-dashboard">
      <div className="dashboard-container">
        <div className="dashboard-header" style={{ position: 'relative' }}>
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
          <h1>Agency Dashboard</h1>
          <p>Welcome to your agency management portal</p>
        </div>
        
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-label">Total Therapists</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-label">Active Clients</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">0</div>
            <div className="stat-label">Sessions Today</div>
          </div>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
              Manage Therapists
            </h2>
            <p>View and manage your therapy staff</p>
            <button className="btn btn-primary" onClick={() => alert('Therapist management coming soon!')}>
              Manage Staff
            </button>
          </div>
          
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 17H7V10H9V17ZM13 17H11V7H13V17ZM17 17H15V13H17V17ZM19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V5C21 3.9 20.1 3 19 3ZM19 19H5V5H19V19Z" fill="currentColor"/>
              </svg>
              Analytics
            </h2>
            <p>View agency performance and reports</p>
            <button className="btn btn-primary" onClick={() => alert('Analytics dashboard coming soon!')}>
              View Analytics
            </button>
          </div>
          
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.89 1 3 1.89 3 3V21C3 22.11 3.89 23 5 23H19C20.11 23 21 22.11 21 21V9ZM19 9H14V4H5V21H19V9Z" fill="currentColor"/>
              </svg>
              Billing
            </h2>
            <p>Manage client billing and payments</p>
            <button className="btn btn-primary" onClick={() => alert('Billing system coming soon!')}>
              Manage Billing
            </button>
          </div>
          
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
              Scheduling
            </h2>
            <p>Manage appointments and schedules</p>
            <button className="btn btn-primary" onClick={() => alert('Scheduling system coming soon!')}>
              View Schedule
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

export default AgencyDashboard;
