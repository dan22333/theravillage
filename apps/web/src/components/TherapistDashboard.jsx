import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AddNewClient from './AddNewClient';
import ScheduleAppointment from './ScheduleAppointment';
import ViewCalendar from './ViewCalendar';
import ExerciseLibrary from './ExerciseLibrary';
import ClientProfile from './ClientProfile';
import './TherapistDashboard.css';

const TherapistDashboard = () => {
  const { user, getToken, signOut } = useAuth();
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientForScheduling, setSelectedClientForScheduling] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);

  useEffect(() => {
    if (user) {
      fetchTherapistData();
    }
  }, [user]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  const fetchTherapistData = async (search = '') => {
    try {
      setIsLoading(true);
      setError(null);
      
      const token = await getToken();
      if (!token) {
        setError('No authentication token available');
        setIsLoading(false);
        return;
      }
      
      // Build URL with search parameters
      const clientsUrl = search 
        ? `${import.meta.env.VITE_API_URL}/therapist/clients?search=${encodeURIComponent(search)}&limit=5`
        : `${import.meta.env.VITE_API_URL}/therapist/clients`;
      
      // Fetch clients and today's appointments in parallel
      const [clientsResponse, appointmentsResponse] = await Promise.all([
        fetch(clientsUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments/today`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);



      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        console.log('Clients data:', clientsData);
        setClients(clientsData.clients || []);
      } else {
        const errorText = await clientsResponse.text();
        console.error('Failed to fetch clients:', clientsResponse.status, errorText);
        setError(`Failed to fetch clients: ${clientsResponse.status}`);
      }

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        console.log('Appointments data:', appointmentsData);
        setAppointments(appointmentsData.appointments || []);
      } else {
        const errorText = await appointmentsResponse.text();
        console.error('Failed to fetch appointments:', appointmentsResponse.status, errorText);
        setError(`Failed to fetch appointments: ${appointmentsResponse.status}`);
      }
    } catch (err) {
      setError('Failed to fetch therapist data');
      console.error('Error fetching therapist data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClientsOnly = async (search = '') => {
    try {
      const token = await getToken();
      if (!token) {
        setError('No authentication token available');
        return;
      }
      
      // Build URL with search parameters
      const clientsUrl = search 
        ? `${import.meta.env.VITE_API_URL}/therapist/clients?search=${encodeURIComponent(search)}&limit=5`
        : `${import.meta.env.VITE_API_URL}/therapist/clients`;
      
      const clientsResponse = await fetch(clientsUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        setClients(clientsData.clients || []);
      } else {
        const errorText = await clientsResponse.text();
        console.error('Failed to fetch clients:', clientsResponse.status, errorText);
        setError(`Failed to fetch clients: ${clientsResponse.status}`);
      }
    } catch (err) {
      setError('Failed to fetch clients');
      console.error('Error fetching clients:', err);
    }
  };

  const startSession = async (appointmentId) => {
    // For now, just show a success message
    alert('Session started successfully! (Demo mode)');
  };

  const endSession = async (sessionId) => {
    // For now, just show a success message
    alert('Session ended successfully! You can now create notes. (Demo mode)');
  };

  const handleDeleteClient = async (clientId, clientName) => {
    const confirmed = window.confirm(`Delete client "${clientName}" and all related data? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const token = await getToken();
      if (!token) {
        alert('No authentication token available');
        return;
      }

      const resp = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (resp.status === 204) {
        // Success: remove from list and close modal
        setClients(prev => prev.filter(c => c.id !== clientId));
        setSelectedClient(null);
      } else {
        const text = await resp.text();
        alert(`Failed to delete client: ${resp.status} ${text}`);
      }
    } catch (e) {
      console.error('Delete client failed', e);
      alert('Failed to delete client');
    }
  };

  const getTodayAppointments = () => {
    const today = new Date().toDateString();
    return appointments.filter(apt => 
      new Date(apt.start_ts).toDateString() === today
    );
  };

  const getUpcomingAppointments = () => {
    const now = new Date();
    return appointments.filter(apt => 
      new Date(apt.start_ts) > now && apt.status === 'scheduled'
    ).slice(0, 5);
  };

  if (isLoading) {
    return (
      <div className="therapist-dashboard" style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '24px 0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'auto' }}>
        <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
          <div className="dashboard-header" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '32px', padding: '32px', textAlign: 'center' }}>
            <div className="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#6C757D', fontSize: '18px' }}>
              <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid #F8F9FA', borderTop: '4px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
              <p>Loading therapist dashboard...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }



  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setSelectedClientForScheduling(null);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    setIsSearching(true);
    await fetchClientsOnly(searchQuery);
    setIsSearching(false);
  };

  const handleClearSearch = async () => {
    setSearchQuery('');
    setIsSearching(true);
    await fetchClientsOnly('');
    setIsSearching(false);
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout for debounced search
    const newTimeout = setTimeout(async () => {
      setIsSearching(true);
      await fetchClientsOnly(value);
      setIsSearching(false);
    }, 300); // 300ms delay
    
    setSearchTimeout(newTimeout);
  };

  // Render different pages based on currentPage
  if (currentPage === 'add-client') {
    return <AddNewClient onBack={handleBackToDashboard} />;
  }

  if (currentPage === 'schedule-appointment') {
    return <ScheduleAppointment onBack={handleBackToDashboard} selectedClient={selectedClientForScheduling} />;
  }

  if (currentPage === 'view-calendar') {
    return <ViewCalendar onBack={handleBackToDashboard} />;
  }

  if (currentPage === 'exercise-library') {
    return <ExerciseLibrary onBack={handleBackToDashboard} />;
  }

  if (currentPage === 'view-profile') {
    return <ClientProfile clientId={selectedClientId} onBack={handleBackToDashboard} />;
  }

  return (
    <div className="therapist-dashboard" style={{ backgroundColor: '#F8F9FA', minHeight: '100vh', padding: '24px 0', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'auto' }}>
      <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div className="dashboard-header" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '32px', padding: '32px', textAlign: 'center', position: 'relative' }}>
          <button 
            onClick={async () => {
              try {
                await signOut();
              } catch (error) {
                console.error('Sign-out error:', error);
              }
            }}
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
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>Welcome back, {user?.displayName || user?.name}!</h1>
          <p className="dashboard-subtitle" style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>Therapist Dashboard</p>
        </div>

        {/* Dashboard Stats */}
        <div className="dashboard-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
          <div className="stat-card" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '24px', textAlign: 'center' }}>
            <div className="stat-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '48px', height: '48px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)', borderRadius: '50%', color: 'white', margin: '0 auto 16px' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value" style={{ fontSize: '24px', fontWeight: '700', color: '#343A40', margin: '0 0 4px 0' }}>{clients.length}</div>
            <div className="stat-label" style={{ fontSize: '14px', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.025em' }}>Total Clients</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">{getTodayAppointments().length}</div>
            <div className="stat-label">Today's Appointments</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.03V2.05ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12.5 7V12.25L17 14.92L16.25 16.15L11 13V7H12.5Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">{getUpcomingAppointments().length}</div>
            <div className="stat-label">Upcoming Sessions</div>
          </div>
        </div>

        {/* Navigation */}
        <div className="navigation" style={{ display: 'flex', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <button 
            className={`nav-button ${currentPage === 'dashboard' ? 'active' : ''}`}
            onClick={() => setCurrentPage('dashboard')}
            style={{ padding: '8px 16px', backgroundColor: 'white', border: '2px solid #20B2AA', borderRadius: '8px', color: '#20B2AA', fontWeight: '500', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 13H11V3H3V13ZM3 21H11V15H3V21ZM13 21H21V11H13V21ZM13 3V9H21V3H13Z" fill="currentColor"/>
            </svg>
            Dashboard
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setCurrentPage('add-client')}
            style={{ padding: '8px 16px', backgroundColor: 'white', border: '2px solid #20B2AA', borderRadius: '8px', color: '#20B2AA', fontWeight: '500', cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor"/>
            </svg>
            Add Client
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setCurrentPage('schedule-appointment')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
            </svg>
            Schedule Appointment
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setCurrentPage('view-calendar')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
            </svg>
            View Calendar
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setCurrentPage('exercise-library')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
            Exercise Library
          </button>
        </div>

      <div className="dashboard-grid">
          {/* Today's Appointments */}
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.03V2.05ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12.5 7V12.25L17 14.92L16.25 16.15L11 13V7H12.5Z" fill="currentColor"/>
              </svg>
              Today's Appointments
            </h2>
            <div className="appointments-list">
            {getTodayAppointments().length > 0 ? (
              getTodayAppointments().map(appointment => (
                  <div key={appointment.id} className="appointment-item">
                    <div className="appointment-info">
                      <div className="appointment-time">
                    {new Date(appointment.start_ts).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                      <div className="appointment-client">{appointment.client_name}</div>
                    </div>
                    <div className="appointment-status confirmed">
                      {appointment.status}
                  </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.03V2.05ZM12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12.5 7V12.25L17 14.92L16.25 16.15L11 13V7H12.5Z" fill="currentColor"/>
                  </svg>
                  <h3>No appointments today</h3>
                  <p>You're all caught up! Check your calendar for upcoming sessions.</p>
                </div>
            )}
          </div>
        </div>

          {/* Client List */}
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
              Recent Clients
            </h2>
            
            <div className="search-container">
              <form className="search-bar" onSubmit={handleSearch}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="currentColor"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search clients..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  disabled={isSearching}
                />
                {isSearching && (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2V6M12 18V22M4.93 4.93L7.76 7.76M16.24 16.24L19.07 19.07M2 12H6M18 12H22M7.76 7.76L4.93 4.93M19.07 19.07L16.24 16.24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </form>
          </div>
          
            <div className="clients-list">
            {clients.length > 0 ? (
              clients.map(client => (
                  <div key={client.id} className="client-item" onClick={() => {
                    setSelectedClientId(client.id);
                    setCurrentPage('view-profile');
                  }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E2E8F0', transition: 'all 150ms ease-in-out', cursor: 'pointer' }}>
                    <div className="client-info" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="client-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', background: 'linear-gradient(135deg, #20B2AA, #48D1CC)', borderRadius: '50%', color: 'white', fontWeight: '600', fontSize: '14px' }}>
                        {client.name ? client.name.charAt(0).toUpperCase() : 'C'}
                      </div>
                      <div className="client-details">
                        <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#343A40', margin: '0 0 4px 0' }}>{client.name}</h3>
                        <p style={{ fontSize: '14px', color: '#6C757D', margin: '0' }}>{client.age ? `${client.age} years old` : 'Age not specified'}</p>
                      </div>
                    </div>
                    <div className="client-actions" style={{ display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClientForScheduling(client);
                          setCurrentPage('schedule-appointment');
                        }}
                        style={{ padding: '8px', backgroundColor: 'white', border: '2px solid #20B2AA', borderRadius: '8px', color: '#20B2AA', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
                        </svg>
                      </button>
                  </div>
                </div>
              ))
            ) : (
                <div className="empty-state">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
                  </svg>
                  <h3>No clients found</h3>
                  <p>Start by adding your first client to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TherapistDashboard;
