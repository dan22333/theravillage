import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import AddNewClient from './AddNewClient';
import ScheduleAppointment from './ScheduleAppointment';
import ViewCalendar from './ViewCalendar';
import ExerciseLibrary from './ExerciseLibrary';
import ClientProfile from './ClientProfile';
import TherapistCalendar from './TherapistCalendar';
import './TherapistDashboard.css';

const TherapistDashboard = () => {
  const { user, getToken, signOut } = useAuth();
  const [clients, setClients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedClientForScheduling, setSelectedClientForScheduling] = useState(null);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [showSessionNoteModal, setShowSessionNoteModal] = useState(false);
  const [selectedAppointmentForNotes, setSelectedAppointmentForNotes] = useState(null);
  const [showPlanSessionModal, setShowPlanSessionModal] = useState(false);
  const [selectedAppointmentForPlan, setSelectedAppointmentForPlan] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedAppointmentForCancel, setSelectedAppointmentForCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  
  // Session note state (same as ClientProfile.jsx)
  const [sessionNoteData, setSessionNoteData] = useState({
    start_time: '',
    duration_minutes: 60,
    treatment_codes: '97110',
    notes: {
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      synthesized_summary: '',
      goals_addressed: [],
      next_session_recommendations: [],
      confidence_score: 0.0
    },
    main_notes: '',
    is_generating: false
  });

  // Audio recording state (same as ClientProfile.jsx)
  const [audioState, setAudioState] = useState({
    isRecording: false,
    isTranscribing: false,
    mediaRecorder: null,
    audioChunks: [],
    transcript: ''
  });

  const fetchTherapistData = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        console.error('No authentication token available');
        setIsLoading(false);
        return;
      }
      
      // Get a wider date range to fetch all appointments (past and future)
      const now = new Date();
      const oneMonthAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
      const twoMonthsFromNow = new Date(now.getTime() + (60 * 24 * 60 * 60 * 1000));
      const startDate = oneMonthAgo.toISOString().split('T')[0];
      const endDate = twoMonthsFromNow.toISOString().split('T')[0];

      // Fetch therapist data
      const [clientsResponse, appointmentsResponse] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_URL}/therapist/clients?limit=100`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments?start_date=${startDate}&end_date=${endDate}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (clientsResponse.ok) {
        const clientsData = await clientsResponse.json();
        const clientsArray = clientsData.clients || [];
        setClients(Array.isArray(clientsArray) ? clientsArray : []);
      } else {
        setClients([]);
      }

      if (appointmentsResponse.ok) {
        const appointmentsData = await appointmentsResponse.json();
        // The API returns {appointments: [...]} so we need to extract the appointments array
        const appointmentsArray = appointmentsData.appointments || [];
        setAppointments(Array.isArray(appointmentsArray) ? appointmentsArray : []);
        console.log('Appointments loaded:', appointmentsArray.length, appointmentsArray);
      } else {
        console.error('Appointments API failed with status:', appointmentsResponse.status);
        setAppointments([]);
      }

      // Try to fetch pending requests
      // Skip pending requests since endpoint doesn't exist
      setPendingRequestsCount(0);

    } catch (error) {
      console.error('Error fetching therapist data:', error);
      setError('Failed to load dashboard data');
      setClients([]);
      setAppointments([]);
      setPendingRequestsCount(0);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTherapistData();
    }
  }, [user]);

  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  useEffect(() => {
    return () => {
      if (audioState.mediaRecorder && audioState.mediaRecorder.state !== 'inactive') {
        audioState.mediaRecorder.stop();
      }
    };
  }, [audioState.mediaRecorder]);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients?search=${encodeURIComponent(searchQuery)}&limit=100`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const results = await response.json();
        const clientsArray = results.clients || [];
        setClients(Array.isArray(clientsArray) ? clientsArray : []);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchInputChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    if (query.trim()) {
      const timeout = setTimeout(() => {
        handleSearch({ preventDefault: () => {} });
      }, 1000);
      setSearchTimeout(timeout);
      } else {
      fetchTherapistData();
    }
  };

  const handleBackToDashboard = () => {
    setCurrentPage('dashboard');
    setSelectedClientId(null);
    fetchTherapistData();
  };

  // Helper functions for appointments
  const getTodayAppointments = () => {
    if (!Array.isArray(appointments)) return [];
    const today = new Date().toISOString().split('T')[0];
    return appointments.filter(apt => 
      apt.start_ts && apt.start_ts.startsWith(today) && apt.status !== 'cancelled'
    );
  };

  const getUpcomingWeekAppointments = () => {
    if (!Array.isArray(appointments)) return [];
    const now = new Date();
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    return appointments.filter(apt => {
      if (!apt.start_ts) return false;
      const aptDate = new Date(apt.start_ts);
      return aptDate >= now && aptDate <= nextWeek && apt.status !== 'cancelled';
    });
  };

  const getUpcomingAppointments = () => {
    if (!Array.isArray(appointments)) return [];
    const now = new Date();
    console.log('Filtering upcoming appointments. Total appointments:', appointments.length);
    console.log('Current time:', now);
    
    const upcoming = appointments
      .filter(apt => {
        if (!apt.start_ts) {
          console.log('Appointment missing start_ts:', apt);
          return false;
        }
        const aptDate = new Date(apt.start_ts);
        const isUpcoming = aptDate >= now && apt.status !== 'cancelled';
        console.log('Appointment:', apt.client_name, 'Date:', aptDate, 'Is upcoming:', isUpcoming, 'Status:', apt.status);
        return isUpcoming;
      })
      .sort((a, b) => new Date(a.start_ts) - new Date(b.start_ts));
    
    console.log('Upcoming appointments found:', upcoming.length, upcoming);
    return upcoming;
  };

  const getPastAppointments = () => {
    if (!Array.isArray(appointments)) return [];
    const now = new Date();
    
    return appointments
      .filter(apt => {
        if (!apt.start_ts) return false;
        const aptDate = new Date(apt.start_ts);
        return aptDate < now && apt.status === 'completed';
      })
      .sort((a, b) => new Date(b.start_ts) - new Date(a.start_ts))
      .slice(0, 20);
  };

  // Audio recording functions (from ClientProfile.jsx)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunks.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      setAudioState(prev => ({
        ...prev,
        isRecording: true,
        mediaRecorder,
        audioChunks
      }));

      mediaRecorder.start();
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };

  const stopRecording = () => {
    if (audioState.mediaRecorder && audioState.isRecording) {
      audioState.mediaRecorder.stop();
      setAudioState(prev => ({ ...prev, isRecording: false }));
    }
  };

  const transcribeAudio = async (audioBlob) => {
    try {
      setAudioState(prev => ({ ...prev, isTranscribing: true }));
      
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.wav');

      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/transcribe-audio`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        setAudioState(prev => ({ 
          ...prev, 
          transcript: result.transcript,
          isTranscribing: false 
        }));
        
        setSessionNoteData(prev => ({ 
          ...prev, 
          main_notes: result.transcript 
        }));
      } else {
        const errorText = await response.text();
        console.error(`Failed to transcribe audio: ${response.status} ${errorText}`);
        setAudioState(prev => ({ ...prev, isTranscribing: false }));
      }
    } catch (error) {
      console.error('Error transcribing audio:', error);
      setAudioState(prev => ({ ...prev, isTranscribing: false }));
    }
  };

  // Session note functions (enhanced from ClientProfile.jsx)
  const generateSOAPNote = async () => {
    const notesToUse = sessionNoteData.main_notes;
    
    if (!notesToUse.trim()) {
      alert('Please enter some notes or record audio before generating SOAP note');
      return;
    }

    setSessionNoteData(prev => ({ ...prev, is_generating: true }));

    try {
      const formData = new FormData();
      formData.append('transcript', notesToUse);
      formData.append('client_age', 0); // We don't have client age in appointment data
      formData.append('diagnosis', 'Not specified');
      formData.append('short_term_goals', JSON.stringify([]));
      formData.append('long_term_goals', JSON.stringify([]));
      formData.append('session_activities', JSON.stringify([sessionNoteData.main_notes]));
      formData.append('observations', '');
      formData.append('time_in', sessionNoteData.start_time || '');
      formData.append('time_out', '');
      formData.append('units', sessionNoteData.duration_minutes || 0);
      const treatmentCodes = sessionNoteData.treatment_codes || [];
      const treatmentCodesArray = Array.isArray(treatmentCodes) ? treatmentCodes : [treatmentCodes];
      formData.append('treatment_codes', JSON.stringify(treatmentCodesArray));

      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/ai/generate-soap-note`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        const soapNote = result.soap_note; // AI service returns {soap_note: {...}}
        setSessionNoteData(prev => ({ 
          ...prev, 
          notes: { 
            ...prev.notes,
            subjective: soapNote.subjective || '',
            objective: soapNote.objective || '',
            assessment: soapNote.assessment || '',
            plan: soapNote.plan || '',
            synthesized_summary: soapNote.synthesized_summary || '',
            goals_addressed: soapNote.goals_addressed || [],
            next_session_recommendations: soapNote.next_session_recommendations || [],
            confidence_score: soapNote.confidence_score || 0.0
          },
          is_generating: false
        }));
      } else {
        console.error('Failed to generate SOAP note');
        setSessionNoteData(prev => ({ ...prev, is_generating: false }));
      }
    } catch (error) {
      console.error('Error generating SOAP note:', error);
      setSessionNoteData(prev => ({ ...prev, is_generating: false }));
    }
  };

  const handleSaveSession = async () => {
    try {
      const token = await getToken();
      
      if (!sessionNoteData.start_time) {
        alert('Please enter the start time');
        return;
      }
      
      if (!sessionNoteData.duration_minutes || sessionNoteData.duration_minutes <= 0) {
        alert('Please enter a valid duration');
        return;
      }
      
      if (!sessionNoteData.notes.subjective && !sessionNoteData.notes.objective) {
        alert('Please fill in at least the Subjective or Objective section');
        return;
      }

      // Parse datetime-local input
      const startDateTime = new Date(sessionNoteData.start_time);
      
      if (isNaN(startDateTime.getTime())) {
        alert('Please enter a valid start time');
        return;
      }

      const body = {
        client_id: parseInt(selectedAppointmentForNotes.client_id),
        start_time: startDateTime.toISOString(),
        duration_minutes: parseInt(sessionNoteData.duration_minutes),
        treatment_codes: [sessionNoteData.treatment_codes],
        notes: {
          type: 'soap',
          soap: {
            ...sessionNoteData.notes,
            original_notes: sessionNoteData.main_notes // Include original session notes
          },
          goals_checked: [],
          treatment_codes: [sessionNoteData.treatment_codes]
        }
      };
      
      // Use the therapist endpoint for creating sessions
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients/${selectedAppointmentForNotes.client_id}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (response.ok) {
        setShowSessionNoteModal(false);
        setSelectedAppointmentForNotes(null);
        // Reset form
        setSessionNoteData({
          start_time: '',
          duration_minutes: 60,
          treatment_codes: '97110',
          notes: {
            subjective: '',
            objective: '',
            assessment: '',
            plan: '',
            synthesized_summary: '',
            goals_addressed: [],
            next_session_recommendations: [],
            confidence_score: 0.0
          },
          main_notes: '',
          is_generating: false
        });
        setAudioState({
          isRecording: false,
          isTranscribing: false,
          mediaRecorder: null,
          audioChunks: [],
          transcript: ''
        });
        fetchTherapistData();
      } else {
        const errorText = await response.text();
        console.error('Failed to save session:', response.status, errorText);
        alert('Failed to save session. Please try again.');
      }
    } catch (error) {
      console.error('Error saving session:', error);
      alert('Error saving session. Please try again.');
    }
  };

  const handleCancelAppointment = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments/${selectedAppointmentForCancel.id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          cancellation_reason: cancellationReason
        })
      });

      if (response.ok) {
        setShowCancelModal(false);
        setSelectedAppointmentForCancel(null);
        setCancellationReason('');
        fetchTherapistData(); // Refresh the appointments
      } else {
        console.error('Failed to cancel appointment:', response.status);
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    }
  };

  // Page routing
  if (currentPage === 'add-client') {
    return <AddNewClient onBack={handleBackToDashboard} onClientAdded={fetchTherapistData} />;
  }

  if (currentPage === 'calendar') {
    return <TherapistCalendar onBack={handleBackToDashboard} />;
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

  if (isLoading) {
  return (
      <div className="therapist-dashboard">
        <div className="container">
          <div className="loading">
            <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid #f3f3f3', borderTop: '4px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '16px' }}></div>
            <p>Loading therapist dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="therapist-dashboard">
        <div className="container">
          <div className="error">
            <h2>Error Loading Dashboard</h2>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchTherapistData}>
              Retry
          </button>
        </div>
        </div>
      </div>
    );
  }

  return (
    <div className="therapist-dashboard" style={{ paddingTop: '8px' }}>
      <div className="container">
        
        {/* Beautiful Welcome Message - At the very top */}
        <div style={{ 
          textAlign: 'center', 
          marginBottom: '24px',
          padding: '16px 40px'
        }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '600', 
            color: '#343A40', 
            margin: '0',
            background: 'linear-gradient(135deg, #20B2AA, #48D1CC)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            Welcome back, {user?.displayName || user?.email}
          </h1>
        </div>

        {/* Header with Stats */}
        <div className="dashboard-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 40px', marginBottom: '16px' }}>
          
          {/* Center - Stats Cards in Row */}
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center', flex: 1, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', minWidth: '120px' }}>
              <div className="stat-icon" style={{ 
                width: '48px', 
                height: '48px', 
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', color: '#343A40', marginBottom: '4px' }}>
                {clients.length}
              </div>
              <div className="stat-label" style={{ fontSize: '13px', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Patients
              </div>
          </div>
          
            <div style={{ textAlign: 'center', minWidth: '120px' }}>
              <div className="stat-icon" style={{ 
                width: '48px', 
                height: '48px', 
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
            </div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', color: '#343A40', marginBottom: '4px' }}>
                {getTodayAppointments().length}
              </div>
              <div className="stat-label" style={{ fontSize: '13px', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Today's Appointments
              </div>
          </div>
          
            <div style={{ textAlign: 'center', minWidth: '120px' }}>
              <div className="stat-icon" style={{ 
                width: '48px', 
                height: '48px', 
                margin: '0 auto 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 2.05V4.05C17.39 4.59 20.5 8.58 19.96 12.97C19.5 16.61 16.64 19.5 13 19.93V21.93C18.5 21.38 22.5 16.5 21.95 11C21.5 6.25 17.73 2.5 13 2.03V2.05Z" fill="currentColor"/>
              </svg>
            </div>
              <div className="stat-value" style={{ fontSize: '28px', fontWeight: '700', color: '#343A40', marginBottom: '4px' }}>
                {getUpcomingWeekAppointments().length}
              </div>
              <div className="stat-label" style={{ fontSize: '13px', color: '#6C757D', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Upcoming Weekly
              </div>
          </div>
        </div>

          {/* Right Side - Sign Out Button */}
          <div style={{ position: 'absolute', top: '20px', right: '40px' }}>
          <button 
            onClick={async () => {
              try {
                await signOut();
              } catch (error) {
                console.error('Sign-out error:', error);
              }
            }}
              className="btn btn-danger"
            style={{ 
                padding: '10px 20px',
              fontSize: '14px', 
                fontWeight: '600'
            }}
          >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
            Sign Out
          </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="navigation">
          <button 
            className="nav-button"
            onClick={() => setCurrentPage('add-client')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor"/>
            </svg>
            Add Patient
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setCurrentPage('calendar')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
            </svg>
            Manage Calendar
          </button>
          
          <button 
            className="nav-button"
            onClick={() => setShowScheduleModal(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 13H13V19H11V13H5V11H11V5H13V11H19V13Z" fill="currentColor"/>
            </svg>
            Schedule Appointment
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

        {/* Dashboard Grid - Better Alignment */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', alignItems: 'stretch' }}>
          
          {/* Upcoming Appointments Widget */}
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
              Upcoming Appointments
            </h2>
            <div className="appointments-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {getUpcomingAppointments().length > 0 ? (
                getUpcomingAppointments().map((appointment, index) => (
                  <div key={appointment.id} style={{ 
                    backgroundColor: index < 5 ? '#F0F8F0' : '#F8F9FA',
                    border: index < 5 ? '2px solid #28A745' : '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#343A40', marginBottom: '4px' }}>
                          {appointment.client_name}
                          {index < 5 && <span style={{ color: '#28A745', fontSize: '11px', marginLeft: '8px' }}>• Next 5</span>}
                        </div>
                        <div style={{ fontSize: '12px', color: '#6C757D' }}>
                          {appointment.start_ts ? new Date(appointment.start_ts).toLocaleDateString('en', { 
                            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          }) : 'No date'}
                        </div>
                  </div>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => {
                          setSelectedClientId(appointment.client_id);
                          setCurrentPage('view-profile');
                        }}
                        style={{ 
                          padding: '3px 6px', 
                          fontSize: '10px', 
                          backgroundColor: '#20B2AA', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Patient
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAppointmentForNotes(appointment);
                          // Pre-populate session data from appointment
                          const appointmentStart = new Date(appointment.start_ts);
                          const appointmentEnd = new Date(appointment.end_ts);
                          const durationMinutes = Math.round((appointmentEnd - appointmentStart) / (1000 * 60));
                          
                          setSessionNoteData({
                            start_time: appointmentStart.toISOString().slice(0, 16), // Format for datetime-local input
                            duration_minutes: durationMinutes,
                            treatment_codes: '97110',
                            notes: {
                              subjective: '',
                              objective: '',
                              assessment: '',
                              plan: '',
                              synthesized_summary: '',
                              goals_addressed: [],
                              next_session_recommendations: [],
                              confidence_score: 0.0
                            },
                            main_notes: '',
                            is_generating: false
                          });
                          // Reset audio state
                          setAudioState({
                            isRecording: false,
                            isTranscribing: false,
                            mediaRecorder: null,
                            audioChunks: [],
                            transcript: ''
                          });
                          setShowSessionNoteModal(true);
                        }}
                        style={{ 
                          padding: '3px 6px', 
                          fontSize: '10px', 
                          backgroundColor: '#20B2AA', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Take Note
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAppointmentForPlan(appointment);
                          setShowPlanSessionModal(true);
                        }}
                        style={{ 
                          padding: '3px 6px', 
                          fontSize: '10px', 
                          backgroundColor: '#20B2AA', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Plan Session
                      </button>
                      <button 
                        onClick={() => {
                          setSelectedAppointmentForCancel(appointment);
                          setShowCancelModal(true);
                        }}
                        style={{ 
                          padding: '3px 6px', 
                          fontSize: '10px', 
                          backgroundColor: '#20B2AA', 
                          color: 'white', 
                          border: 'none', 
                          borderRadius: '4px', 
                          cursor: 'pointer',
                          fontWeight: '500',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        Cancel
                      </button>
                  </div>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
                  </svg>
                  <h3>No upcoming appointments</h3>
                  <p>Schedule appointments to see them here.</p>
                </div>
            )}
          </div>
        </div>

          {/* Past Appointments Widget */}
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
              </svg>
              Past Appointments
            </h2>
            <div className="appointments-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {getPastAppointments().length > 0 ? (
                <div>
                  {/* First 5 appointments */}
                  {getPastAppointments().slice(0, 5).map((appointment) => (
                  <div key={appointment.id} className="appointment-item">
                    <div className="appointment-info">
                        <div className="appointment-client">{appointment.client_name}</div>
                      <div className="appointment-time">
                          {appointment.start_ts ? new Date(appointment.start_ts).toLocaleDateString('en', { 
                            weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          }) : 'No date'}
                  </div>
                    </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => {
                            setSelectedAppointmentForNotes(appointment);
                            setShowSessionNoteModal(true);
                          }}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Session Recording & Notes"
                        >
                          📝 Record
                        </button>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => {
                            alert('Plan Next Session - Coming Soon!');
                          }}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Plan Next Session"
                        >
                          📋 Plan
                        </button>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => {
                            alert('Open Chat - Coming Soon!');
                          }}
                          style={{ padding: '4px 8px', fontSize: '11px' }}
                          title="Open Chat with Patient"
                        >
                          💬 Chat
                        </button>
                  </div>
                  </div>
                  ))}
                  
                  {/* Scrollable section for appointments 6-20 */}
                  {getPastAppointments().length > 5 && (
                    <div style={{ 
                      borderTop: '2px solid #E2E8F0',
                      paddingTop: '16px',
                      marginTop: '16px'
                    }}>
                      <p style={{ fontSize: '14px', color: '#6C757D', marginBottom: '12px', fontWeight: '600' }}>
                        More appointments (scroll to view):
                      </p>
                      {getPastAppointments().slice(5).map((appointment) => (
                        <div key={appointment.id} style={{ 
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          backgroundColor: '#FAFAFA',
                          borderRadius: '8px',
                          marginBottom: '8px',
                          border: '1px solid #F0F0F0'
                        }}>
                          <div>
                            <div style={{ fontSize: '14px', fontWeight: '600', color: '#343A40' }}>
                              {appointment.client_name}
                            </div>
                            <div style={{ fontSize: '12px', color: '#6C757D' }}>
                              {appointment.start_ts ? new Date(appointment.start_ts).toLocaleDateString('en', { 
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                              }) : 'No date'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                              onClick={() => {
                                setSelectedAppointmentForNotes(appointment);
                                setShowSessionNoteModal(true);
                              }}
                              style={{ padding: '4px 6px', backgroundColor: '#20B2AA', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                            >
                              📝
                            </button>
                            <button 
                              onClick={() => alert('Plan Next Session - Coming Soon!')}
                              style={{ padding: '4px 6px', backgroundColor: '#6C757D', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                            >
                              📋
                            </button>
                            <button 
                              onClick={() => alert('Open Chat - Coming Soon!')}
                              style={{ padding: '4px 6px', backgroundColor: '#6C757D', color: 'white', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
                            >
                              💬
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="empty-state">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
                  </svg>
                  <h3>No past appointments</h3>
                  <p>Completed sessions will appear here.</p>
                </div>
            )}
          </div>
        </div>

          {/* Patients Widget */}
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
              Patients
            </h2>
            
            <div className="search-container">
              <form className="search-bar" onSubmit={handleSearch}>
                {isSearching ? (
                  <div style={{ width: '20px', height: '20px', border: '2px solid #f3f3f3', borderTop: '2px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z" fill="currentColor"/>
                </svg>
                )}
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  disabled={isSearching}
                />
                {searchQuery && !isSearching && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      fetchTherapistData();
                    }}
                    style={{ background: 'none', border: 'none', color: '#6C757D', cursor: 'pointer', padding: '4px' }}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </form>
          </div>
          
            <div className="clients-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {Array.isArray(clients) && clients.length > 0 ? (
              clients.map(client => (
                  <div key={client.id} className="client-item">
                    <div 
                      className="client-info" 
                      onClick={() => {
                    setSelectedClientId(client.id);
                    setCurrentPage('view-profile');
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="client-avatar">
                        {client.name ? client.name.charAt(0).toUpperCase() : 'P'}
                      </div>
                      <div className="client-details">
                        <h3>{client.name}</h3>
                      </div>
                    </div>
                    <div className="client-actions">
                      <button 
                        className="btn btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedClientForScheduling(client);
                          setShowScheduleModal(true);
                        }}
                        title="Schedule appointment with this patient"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
                  <h3>No patients found</h3>
                  <p>Start by adding your first patient to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Appointment Modal */}
      {showScheduleModal && (
        <ScheduleAppointment 
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedClientForScheduling(null);
            fetchTherapistData();
          }} 
          selectedClient={selectedClientForScheduling} 
        />
      )}

      {/* Comprehensive Session Note Modal (from ClientProfile.jsx) */}
      {showSessionNoteModal && selectedAppointmentForNotes && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '1000px', width: '100%', maxHeight: '95vh', overflowY: 'auto' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '2px solid #20B2AA' }}>
              <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '600', color: '#343A40', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="#20B2AA"/>
                </svg>
                New Session - {selectedAppointmentForNotes.client_name}
              </h3>
              <button 
                onClick={() => {
                  setShowSessionNoteModal(false);
                  setSelectedAppointmentForNotes(null);
                  // Reset form
                  setSessionNoteData({
                    start_time: '',
                    duration_minutes: 60,
                    treatment_codes: '97110',
                    notes: {
                      subjective: '',
                      objective: '',
                      assessment: '',
                      plan: '',
                      synthesized_summary: '',
                      goals_addressed: [],
                      next_session_recommendations: [],
                      confidence_score: 0.0
                    },
                    main_notes: '',
                    is_generating: false
                  });
                  setAudioState({
                    isRecording: false,
                    isTranscribing: false,
                    mediaRecorder: null,
                    audioChunks: [],
                    transcript: ''
                  });
                }}
                style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#6C757D' }}
              >
                ×
              </button>
            </div>

            {/* Session Time and Treatment Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>Start Time</label>
                <input
                  type="datetime-local"
                  value={sessionNoteData.start_time}
                  onChange={(e) => setSessionNoteData(prev => ({ ...prev, start_time: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>Duration (min)</label>
                <input
                  type="number"
                  value={sessionNoteData.duration_minutes}
                  onChange={(e) => setSessionNoteData(prev => ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>Treatment Codes</label>
                <input
                  type="text"
                  value={sessionNoteData.treatment_codes}
                  onChange={(e) => setSessionNoteData(prev => ({ ...prev, treatment_codes: e.target.value }))}
                  style={{ width: '100%', padding: '8px', border: '1px solid #E2E8F0', borderRadius: '4px', fontSize: '13px' }}
                  placeholder="e.g., 97110"
                />
              </div>
            </div>

            {/* Session Notes Input */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '8px', textTransform: 'uppercase' }}>Session Notes</label>
              <textarea
                value={sessionNoteData.main_notes}
                onChange={(e) => setSessionNoteData(prev => ({ ...prev, main_notes: e.target.value }))}
                style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px', minHeight: '100px' }}
                placeholder="Enter session notes or record audio..."
              />
            </div>

            {/* Audio Recording Controls */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
              <button
                onClick={audioState.isRecording ? stopRecording : startRecording}
                style={{
                  padding: '8px 16px',
                  backgroundColor: audioState.isRecording ? '#FF6B6B' : '#20B2AA',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '13px'
                }}
              >
                {audioState.isRecording ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <rect x="6" y="6" width="12" height="12" fill="currentColor"/>
                    </svg>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" fill="currentColor"/>
                    </svg>
                    Start Recording
                  </>
                )}
              </button>

              <button
                onClick={generateSOAPNote}
                disabled={sessionNoteData.is_generating || !sessionNoteData.main_notes.trim()}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#20B2AA',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: (sessionNoteData.is_generating || !sessionNoteData.main_notes.trim()) ? 0.6 : 1,
                  fontSize: '13px'
                }}
              >
                {sessionNoteData.is_generating ? (
                  <>
                    <div style={{ width: '14px', height: '14px', border: '2px solid transparent', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" fill="currentColor"/>
                    </svg>
                    Generate SOAP Note
                  </>
                )}
              </button>
            </div>

            {/* Audio Status */}
            {audioState.isTranscribing && (
              <div style={{ padding: '12px', backgroundColor: '#fff3cd', borderRadius: '6px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid transparent', borderTop: '2px solid #856404', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <span style={{ color: '#856404', fontSize: '13px' }}>Transcribing audio...</span>
              </div>
            )}

            {/* SOAP Note Form - Wide View */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#343A40', margin: '0 0 12px 0' }}>SOAP Note Form</h4>
              
              {sessionNoteData.is_generating ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#6C757D' }}>
                  <div style={{ marginBottom: '12px' }}>Generating SOAP note...</div>
                  <div style={{ width: '40px', height: '40px', border: '4px solid #E2E8F0', borderTop: '4px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto' }}></div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>S - Subjective</label>
                    <textarea
                      value={sessionNoteData.notes.subjective}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, subjective: e.target.value } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={3}
                      placeholder="What the client reported..."
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>O - Objective</label>
                    <textarea
                      value={sessionNoteData.notes.objective}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, objective: e.target.value } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={3}
                      placeholder="What you observed..."
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>A - Assessment</label>
                    <textarea
                      value={sessionNoteData.notes.assessment}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, assessment: e.target.value } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={3}
                      placeholder="Your assessment..."
                    />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>P - Plan</label>
                    <textarea
                      value={sessionNoteData.notes.plan}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, plan: e.target.value } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={3}
                      placeholder="Next steps..."
                    />
                  </div>

                  {/* AI Generated Sections */}
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>Synthesized Summary</label>
                    <textarea
                      value={sessionNoteData.notes.synthesized_summary}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, synthesized_summary: e.target.value } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={3}
                      placeholder="AI-generated session summary..."
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>Goals Addressed</label>
                    <textarea
                      value={Array.isArray(sessionNoteData.notes.goals_addressed) ? sessionNoteData.notes.goals_addressed.join(', ') : (sessionNoteData.notes.goals_addressed || '')}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, goals_addressed: e.target.value.split(',').map(g => g.trim()).filter(g => g) } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={2}
                      placeholder="Goals addressed in this session..."
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#6C757D', marginBottom: '4px', textTransform: 'uppercase' }}>Next Session Recommendations</label>
                    <textarea
                      value={Array.isArray(sessionNoteData.notes.next_session_recommendations) ? sessionNoteData.notes.next_session_recommendations.join(', ') : (sessionNoteData.notes.next_session_recommendations || '')}
                      onChange={(e) => setSessionNoteData(prev => ({ ...prev, notes: { ...prev.notes, next_session_recommendations: e.target.value.split(',').map(r => r.trim()).filter(r => r) } }))}
                      style={{ width: '100%', padding: '12px', border: '1px solid #E2E8F0', borderRadius: '6px', resize: 'vertical', fontSize: '13px' }}
                      rows={2}
                      placeholder="Recommendations for next session..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Session Notes Preview */}
            <div style={{ marginBottom: '24px' }}>
              <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#343A40', margin: '0 0 12px 0' }}>Session Notes Preview</h4>
              <div style={{ fontSize: '13px', color: '#343A40', lineHeight: '1.6', padding: '16px', backgroundColor: '#F8F9FA', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                {sessionNoteData.main_notes && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Session Notes:</strong> {sessionNoteData.main_notes}
                  </div>
                )}
                {sessionNoteData.notes.subjective && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Subjective:</strong> {sessionNoteData.notes.subjective}
                  </div>
                )}
                {sessionNoteData.notes.objective && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Objective:</strong> {sessionNoteData.notes.objective}
                  </div>
                )}
                {sessionNoteData.notes.assessment && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Assessment:</strong> {sessionNoteData.notes.assessment}
                  </div>
                )}
                {sessionNoteData.notes.plan && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Plan:</strong> {sessionNoteData.notes.plan}
                  </div>
                )}
                {sessionNoteData.notes.synthesized_summary && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Summary:</strong> {sessionNoteData.notes.synthesized_summary}
                  </div>
                )}
                {sessionNoteData.notes.goals_addressed && sessionNoteData.notes.goals_addressed.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#20B2AA' }}>Goals Addressed:</strong> {Array.isArray(sessionNoteData.notes.goals_addressed) ? sessionNoteData.notes.goals_addressed.join(', ') : sessionNoteData.notes.goals_addressed}
                  </div>
                )}
                {sessionNoteData.notes.next_session_recommendations && sessionNoteData.notes.next_session_recommendations.length > 0 && (
                  <div style={{ marginBottom: '0' }}>
                    <strong style={{ color: '#20B2AA' }}>Next Session:</strong> {Array.isArray(sessionNoteData.notes.next_session_recommendations) ? sessionNoteData.notes.next_session_recommendations.join(', ') : sessionNoteData.notes.next_session_recommendations}
                  </div>
                )}
                {(!sessionNoteData.main_notes && !sessionNoteData.notes.subjective && !sessionNoteData.notes.objective && !sessionNoteData.notes.assessment && !sessionNoteData.notes.plan && !sessionNoteData.notes.synthesized_summary && (!sessionNoteData.notes.goals_addressed || sessionNoteData.notes.goals_addressed.length === 0) && (!sessionNoteData.notes.next_session_recommendations || sessionNoteData.notes.next_session_recommendations.length === 0)) && (
                  <div style={{ fontStyle: 'italic', color: '#6C757D' }}>No session notes recorded yet. Use the form above to add notes or generate with AI.</div>
                )}
              </div>
              
              {/* AI Confidence Score */}
              {sessionNoteData.notes.confidence_score && sessionNoteData.notes.confidence_score > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', padding: '8px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#6C757D' }}>AI Confidence:</span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#20B2AA' }}>
                    {(sessionNoteData.notes.confidence_score * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => {
                  setShowSessionNoteModal(false);
                  setSelectedAppointmentForNotes(null);
                  // Reset form
                  setSessionNoteData({
                    start_time: '',
                    duration_minutes: 60,
                    treatment_codes: '97110',
                    notes: {
                      subjective: '',
                      objective: '',
                      assessment: '',
                      plan: '',
                      synthesized_summary: '',
                      goals_addressed: [],
                      next_session_recommendations: [],
                      confidence_score: 0.0
                    },
                    main_notes: '',
                    is_generating: false
                  });
                  setAudioState({
                    isRecording: false,
                    isTranscribing: false,
                    mediaRecorder: null,
                    audioChunks: [],
                    transcript: ''
                  });
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSession}
                disabled={!sessionNoteData.start_time || (!sessionNoteData.notes.subjective && !sessionNoteData.notes.objective)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#20B2AA',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  opacity: (!sessionNoteData.start_time || (!sessionNoteData.notes.subjective && !sessionNoteData.notes.objective)) ? 0.6 : 1
                }}
              >
                Save Session
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan Session Modal */}
      {showPlanSessionModal && selectedAppointmentForPlan && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600' }}>Plan Next Session - {selectedAppointmentForPlan.client_name}</h3>
              <button 
                onClick={() => {
                  setShowPlanSessionModal(false);
                  setSelectedAppointmentForPlan(null);
                }}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ margin: '0 auto 16px', color: '#6F42C1' }}>
                <path d="M19 3H5C3.89 3 3 3.89 3 5V19C3 20.11 3.89 21 5 21H19C20.11 21 21 20.11 21 19V5C21 3.89 20.11 3 19 3ZM19 19H5V8H19V19Z" fill="currentColor"/>
              </svg>
              <h4 style={{ fontSize: '18px', fontWeight: '600', color: '#343A40', marginBottom: '12px' }}>
                Session Planning
              </h4>
              <p style={{ fontSize: '16px', color: '#6C757D', marginBottom: '24px' }}>
                Plan the next session for <strong>{selectedAppointmentForPlan.client_name}</strong>
              </p>
              
              <div style={{ backgroundColor: '#F8F9FA', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                <p style={{ fontSize: '14px', color: '#6C757D', margin: '0' }}>
                  📋 Session planning functionality will be available soon!
                  <br />
                  This will include treatment goals, exercise planning, and progress tracking.
                </p>
              </div>
              
              <button 
                onClick={() => {
                  setShowPlanSessionModal(false);
                  setSelectedAppointmentForPlan(null);
                }}
                className="btn btn-primary"
                style={{ padding: '12px 24px' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Appointment Modal */}
      {showCancelModal && selectedAppointmentForCancel && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#DC3545' }}>
                Cancel Appointment
              </h3>
              <button 
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedAppointmentForCancel(null);
                  setCancellationReason('');
                }}
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <p style={{ fontSize: '16px', color: '#343A40', marginBottom: '16px' }}>
                Are you sure you want to cancel the appointment with <strong>{selectedAppointmentForCancel.client_name}</strong>?
              </p>
              <p style={{ fontSize: '14px', color: '#6C757D', marginBottom: '16px' }}>
                Scheduled for: {selectedAppointmentForCancel.start_ts ? new Date(selectedAppointmentForCancel.start_ts).toLocaleDateString('en', { 
                  weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                }) : 'No date'}
              </p>
              
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#343A40' }}>
                Reason for cancellation (will be sent to patient):
              </label>
              <textarea
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Please provide a reason for the cancellation..."
                style={{ 
                  width: '100%', 
                  minHeight: '80px', 
                  padding: '12px', 
                  border: '2px solid #E2E8F0', 
                  borderRadius: '8px', 
                  fontSize: '14px', 
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button 
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedAppointmentForCancel(null);
                  setCancellationReason('');
                }}
                className="btn btn-secondary"
              >
                Keep Appointment
              </button>
              <button 
                onClick={handleCancelAppointment}
                disabled={!cancellationReason.trim()}
                style={{
                  padding: '12px 20px',
                  backgroundColor: cancellationReason.trim() ? '#DC3545' : '#CCC',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: cancellationReason.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                Cancel Appointment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TherapistDashboard;