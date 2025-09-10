import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AvailableSlotsView from './AvailableSlotsView';
import { ClientSchedulingRequests } from './ClientCalendar';
import './ClientDashboard.css';

const ClientDashboard = () => {
  const { user, signOut, getToken, loading: authLoading } = useAuth();
  const [showCalendar, setShowCalendar] = useState(false);
  const [therapistId, setTherapistId] = useState(null);
  const [therapistInfo, setTherapistInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [requestsRefreshTrigger, setRequestsRefreshTrigger] = useState(0);

  const API_URL = import.meta.env.VITE_API_URL;

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign-out error:', error);
    }
  };

  // Load client data
  const loadClientData = async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        console.log('CLIENT DASHBOARD: No token available, skipping data load');
        setLoading(false);
        return;
      }
      
      console.log('CLIENT DASHBOARD: Loading client data with token');
      
      // Load therapist info
      const profileResponse = await fetch(`${API_URL}/client/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (profileResponse.ok) {
        const data = await profileResponse.json();
        console.log('Client profile data:', data);
        if (data.therapist_assignment) {
          setTherapistId(data.therapist_assignment.therapist_id);
          setTherapistInfo(data.therapist_assignment);
          console.log('Therapist assigned:', data.therapist_assignment);
        } else {
          console.log('No therapist assignment found');
        }
      } else {
        console.error('Failed to load client profile:', profileResponse.status);
      }

      // Load appointments
      const appointmentsResponse = await fetch(`${API_URL}/client/appointments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        setAppointments(appointmentsData.appointments || []);
      }

      // Load notifications
      const notificationsResponse = await fetch(`${API_URL}/client/notifications`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (notificationsResponse.ok) {
        const notificationsData = await notificationsResponse.json();
        setNotifications(notificationsData.notifications || []);
      }

    } catch (error) {
      console.error('Error loading client data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      console.log('CLIENT DASHBOARD: Auth ready, loading client data');
      loadClientData();
    } else if (!authLoading && !user) {
      console.log('CLIENT DASHBOARD: No user authenticated');
      setLoading(false);
    }
  }, [authLoading, user]);

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
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>
            Welcome to your client portal
            {therapistInfo && (
              <span style={{ display: 'block', fontSize: '16px', color: '#20B2AA', fontWeight: '500', marginTop: '4px' }}>
                Your therapist: Dr. {therapistInfo.therapist_name}
              </span>
            )}
          </p>
        </div>
        
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">
              {appointments.filter(apt => new Date(apt.start_ts) > new Date()).length}
            </div>
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
              Request a Meeting
            </h2>
            <p>Schedule a session with your therapist</p>
            {therapistInfo ? (
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  console.log('Opening calendar with therapist ID:', therapistId);
                  console.log('Therapist info:', therapistInfo);
                  setShowCalendar(true);
                }}
                disabled={loading}
              >
                Schedule with {therapistInfo.therapist_name}
              </button>
            ) : (
              <p style={{ color: '#6c757d', fontStyle: 'italic' }}>
                {loading ? 'Loading...' : 'No therapist assigned yet'}
              </p>
            )}
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
        
        {/* Appointments Section */}
        <div className="appointments-section">
          <h3>My Appointments</h3>
          {appointments.length === 0 ? (
            <div className="no-appointments">
              <p>You have no scheduled appointments yet.</p>
            </div>
          ) : (
            <div className="appointments-container">
              {/* Next 5 Upcoming Appointments */}
              <div className="upcoming-appointments">
                <h4>🔜 Next 5 Appointments</h4>
                <div className="appointments-list">
                  {appointments
                    .filter(apt => new Date(apt.start_ts) > new Date())
                    .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts))
                    .slice(0, 5)
                    .map(appointment => {
                      const startDate = new Date(appointment.start_ts);
                      const endDate = new Date(appointment.end_ts);
                      
                      return (
                        <div key={appointment.id} className="appointment-item upcoming">
                          <div className="appointment-info">
                            <div className="appointment-therapist">
                              <strong>Dr. {appointment.therapist_name}</strong>
                            </div>
                            <div className="appointment-datetime">
                              {startDate.toLocaleDateString('en', { 
                                weekday: 'long', 
                                month: 'short', 
                                day: 'numeric',
                                year: 'numeric'
                              })} at {startDate.toLocaleTimeString('en', { 
                                hour: 'numeric', 
                                minute: '2-digit',
                                hour12: true 
                              })}
                            </div>
                            <div className="appointment-details-row">
                              <span className="appointment-duration">
                                {Math.round((endDate - startDate) / (1000 * 60))} min
                              </span>
                              <span className={`status-badge ${appointment.status}`}>
                                {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  }
                </div>
                
                {appointments.filter(apt => new Date(apt.start_ts) > new Date()).length === 0 && (
                  <div className="no-upcoming">
                    <p>No upcoming appointments scheduled.</p>
                  </div>
                )}
              </div>

              {/* All Appointments (Scrollable) */}
              {appointments.length > 5 && (
                <div className="all-appointments">
                  <h4>📅 All Appointments</h4>
                  <div className="appointments-scroll">
                    {appointments
                      .sort((a, b) => new Date(b.start_ts) - new Date(a.start_ts))
                      .map(appointment => {
                        const startDate = new Date(appointment.start_ts);
                        const endDate = new Date(appointment.end_ts);
                        const isUpcoming = startDate > new Date();
                        
                        return (
                          <div key={appointment.id} className={`appointment-item compact ${isUpcoming ? 'upcoming' : 'past'}`}>
                            <div className="appointment-compact-info">
                              <div className="compact-datetime">
                                {startDate.toLocaleDateString('en', { 
                                  month: 'short', 
                                  day: 'numeric'
                                })} at {startDate.toLocaleTimeString('en', { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true 
                                })}
                              </div>
                              <div className="compact-details">
                                <span className="compact-duration">{Math.round((endDate - startDate) / (1000 * 60))}min</span>
                                <span className={`status-badge small ${appointment.status}`}>
                                  {appointment.status}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scheduling Requests Section */}
        <ClientSchedulingRequests refreshTrigger={requestsRefreshTrigger} />
        
        {/* Debug Section - Remove after testing */}
        <div style={{ padding: '20px', border: '2px solid red', margin: '10px' }}>
          <h3>🔍 Debug Tools</h3>
          <button 
            onClick={async () => {
              try {
                const token = await getToken();
                const response = await fetch(`${API_URL}/calendar/debug/all-requests`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                console.log('🔍 ALL REQUESTS IN DB:', data);
                alert(`Found ${data.total_requests} total requests in database. Check console for details.`);
              } catch (error) {
                console.error('Debug failed:', error);
              }
            }}
            style={{ padding: '8px 16px', backgroundColor: '#FF6B6B', color: 'white', border: 'none', borderRadius: '4px', marginRight: '8px' }}
          >
            Show All Requests in DB
          </button>
          <button 
            onClick={async () => {
              try {
                const token = await getToken();
                const response = await fetch(`${API_URL}/calendar/debug/update-schema`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await response.json();
                console.log('🔧 SCHEMA UPDATE:', data);
                alert(data.message);
              } catch (error) {
                console.error('Schema update failed:', error);
                alert('Failed to update schema');
              }
            }}
            style={{ padding: '8px 16px', backgroundColor: '#28A745', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            Update Schema
          </button>
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
      
      {/* Available Slots Modal */}
      {showCalendar && therapistId && therapistInfo && (
        <AvailableSlotsView 
          therapistId={therapistId}
          therapistName={therapistInfo.therapist_name}
          onClose={() => {
            setShowCalendar(false);
            loadClientData(); // Refresh data after booking
            // Trigger refresh of pending requests
            setRequestsRefreshTrigger(prev => prev + 1);
          }}
        />
      )}
    </div>
  );
};

export default ClientDashboard;
