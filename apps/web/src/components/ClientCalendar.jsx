import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './Notification';
import './ClientCalendar.css';

const ClientCalendar = ({ therapistId, onClose }) => {
  const { getToken, user, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientMessage, setClientMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const API_URL = import.meta.env.VITE_API_URL;

  // Load available slots for the therapist
  const loadAvailableSlots = async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        console.log('🔍 CLIENT CALENDAR: No token available, skipping slot load');
        setLoading(false);
        return;
      }
      
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 30); // Next 30 days
      
      console.log('Loading slots for therapist:', therapistId);
      const response = await fetch(
        `${API_URL}/calendar/client/therapist/${therapistId}/available-slots?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      console.log('🔍 CLIENT CALENDAR: Available slots response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 CLIENT CALENDAR: Available slots data:', data);
        console.log('🔍 CLIENT CALENDAR: Number of slots received:', data.available_slots?.length || 0);
        if (data.available_slots && data.available_slots.length > 0) {
          console.log('🔍 CLIENT CALENDAR: Sample slots:');
          data.available_slots.slice(0, 3).forEach(slot => {
            console.log(`   - ${slot.slot_date} ${slot.start_time} (${slot.status})`);
          });
        }
        setAvailableSlots(data.available_slots || []);
      } else {
        console.error('Failed to load available slots:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (therapistId && !authLoading && user) {
      console.log('🔍 CLIENT CALENDAR: Auth ready, loading available slots');
      loadAvailableSlots();
    } else if (!authLoading && !user) {
      console.log('🔍 CLIENT CALENDAR: No user authenticated');
      setLoading(false);
    }
  }, [therapistId, authLoading, user]);

  // Submit scheduling request
  const submitSchedulingRequest = async () => {
    if (!selectedSlot) return;
    
    setSubmitting(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/calendar/client/scheduling-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          therapist_id: therapistId,
          requested_slot_id: selectedSlot.id,
          requested_date: selectedSlot.slot_date,
          requested_start_time: selectedSlot.start_time,
          requested_end_time: selectedSlot.end_time,
          client_message: clientMessage
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 CLIENT: Request sent successfully:', data);
        showSuccess('Meeting request sent successfully! Your therapist will respond soon.');
        setTimeout(() => onClose(), 1500); // Auto-close after success
      } else {
        const error = await response.json();
        console.error('📋 CLIENT: Failed to send request:', error);
        showError(error.detail || 'Failed to send meeting request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      showError('Failed to send meeting request');
    } finally {
      setSubmitting(false);
    }
  };

  // Group slots by date for dense view
  const groupSlotsByDate = () => {
    const grouped = {};
    const today = new Date().toISOString().split('T')[0];
    
    availableSlots.forEach(slot => {
      const date = slot.slot_date;
      // Only show future dates
      if (date >= today) {
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(slot);
      }
    });
    
    // Sort dates and times
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    
    return grouped;
  };

  // Group slots into time periods for dense display
  const groupSlotsByTimePeriod = (slots) => {
    const periods = {
      morning: [], // 6 AM - 12 PM
      afternoon: [], // 12 PM - 6 PM  
      evening: [] // 6 PM - 10 PM
    };
    
    slots.forEach(slot => {
      const hour = parseInt(slot.start_time.split(':')[0]);
      if (hour < 12) {
        periods.morning.push(slot);
      } else if (hour < 18) {
        periods.afternoon.push(slot);
      } else {
        periods.evening.push(slot);
      }
    });
    
    return periods;
  };

  // Format date for display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  // Format time for display
  const formatTime = (timeStr) => {
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const groupedSlots = groupSlotsByDate();
  const sortedDates = Object.keys(groupedSlots).sort();

  if (loading) {
    return (
      <div className="client-calendar-modal">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Request a Meeting</h2>
            <button onClick={onClose} className="close-btn">×</button>
          </div>
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading available times...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="client-calendar-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Request a Meeting</h2>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="modal-body">
          {sortedDates.length === 0 ? (
            <div className="no-slots">
              <div className="no-slots-icon">📅</div>
              <h3>No Available Times</h3>
              <p>Your therapist hasn't set any available times yet. Please check back later or contact them directly.</p>
            </div>
          ) : (
            <>
              <div className="slots-section">
                <h3>Available Time Slots</h3>
                <div className="dates-container">
                  {sortedDates.slice(0, 14).map(date => {
                    const daySlots = groupedSlots[date];
                    const timePeriods = groupSlotsByTimePeriod(daySlots);
                    const hasSlots = daySlots.length > 0;
                    
                    if (!hasSlots) return null;
                    
                    return (
                      <div key={date} className="date-group dense">
                        <div className="date-header-dense">
                          <div className="date-info">
                            <span className="day-name">{formatDate(date)}</span>
                            <span className="slot-count">{daySlots.length} slots</span>
                          </div>
                        </div>
                        
                        <div className="time-periods">
                          {Object.entries(timePeriods).map(([period, slots]) => {
                            if (slots.length === 0) return null;
                            
                            return (
                              <div key={period} className="time-period">
                                <div className="period-label">
                                  {period === 'morning' ? '🌅 Morning' : 
                                   period === 'afternoon' ? '☀️ Afternoon' : 
                                   '🌙 Evening'}
                                </div>
                                <div className="period-slots">
                                  {slots.map(slot => (
                                    <button
                                      key={slot.id}
                                      className={`time-slot-dense ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
                                      onClick={() => setSelectedSlot(slot)}
                                    >
                                      {formatTime(slot.start_time)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {sortedDates.length > 14 && (
                  <div className="more-dates-notice">
                    <p>Showing next 14 days with availability. More dates available as your therapist adds them.</p>
                  </div>
                )}
              </div>

              {selectedSlot && (
                <div className="request-section">
                  <h3>Add a Message (Optional)</h3>
                  <textarea
                    value={clientMessage}
                    onChange={(e) => setClientMessage(e.target.value)}
                    placeholder="Let your therapist know if you have any specific needs or questions for this session..."
                    className="message-textarea"
                    rows={4}
                  />
                  
                  <div className="selected-time-info">
                    <strong>Selected Time:</strong> {formatDate(selectedSlot.slot_date)} at {formatTime(selectedSlot.start_time)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          {selectedSlot && (
            <button 
              onClick={submitSchedulingRequest} 
              className="submit-btn"
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send Request'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Component to show pending requests
export const ClientSchedulingRequests = ({ refreshTrigger }) => {
  const { getToken, user, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);

  const API_URL = import.meta.env.VITE_API_URL;

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      if (!token) {
        console.log('📋 CLIENT: No token available, skipping request load');
        return;
      }
      
      const response = await fetch(`${API_URL}/calendar/scheduling-requests/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📋 CLIENT: Loaded pending requests:', data.pending_requests?.length || 0);
        setPendingRequests(data.pending_requests || []);
      } else {
        console.error('📋 CLIENT: Failed to load pending requests:', response.status);
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Wait for auth to be ready before loading requests
  useEffect(() => {
    if (!authLoading && user) {
      console.log('📋 CLIENT: Auth ready, loading pending requests');
      loadPendingRequests();
    } else if (!authLoading && !user) {
      console.log('📋 CLIENT: No user authenticated, clearing requests');
      setPendingRequests([]);
      setLoading(false);
    }
  }, [authLoading, user]);

  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && user) {
      console.log('📋 CLIENT: Refreshing requests due to trigger');
      loadPendingRequests();
    }
  }, [refreshTrigger, user]);

  // Cancel a scheduling request
  const cancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this meeting request?')) {
      return;
    }

    setCancellingRequestId(requestId);
    try {
      const token = await getToken();
      console.log('🔍 CLIENT: Cancelling request', requestId);
      console.log('🔍 CLIENT: Token status:', token ? 'Token available' : 'Token is NULL');
      console.log('🔍 CLIENT: API URL:', `${API_URL}/calendar/scheduling-requests/${requestId}/cancel`);
      
      if (!token) {
        showError('Authentication failed. Please refresh the page and try again.');
        return;
      }
      
      const response = await fetch(`${API_URL}/calendar/scheduling-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showSuccess('Meeting request cancelled successfully');
        loadPendingRequests(); // Refresh the list
      } else {
        const error = await response.json();
        showError(error.detail || 'Failed to cancel request');
      }
    } catch (error) {
      console.error('Error cancelling request:', error);
      showError('Failed to cancel request');
    } finally {
      setCancellingRequestId(null);
    }
  };

  const formatDateTime = (date, time) => {
    // Use date string directly to avoid timezone issues
    const [year, month, day] = date.split('-');
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    
    console.log('🗓️ DATE FORMAT DEBUG:', { 
      originalDate: date, 
      parsedDate: dateObj.toLocaleDateString(),
      year, month, day 
    });
    
    return `${dateObj.toLocaleDateString('en', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    })} at ${displayHour}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="scheduling-requests">
        <h3>My Meeting Requests</h3>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="scheduling-requests">
      <h3>My Meeting Requests</h3>
      {pendingRequests.length === 0 ? (
        <div className="no-requests">
          <p>You have no pending meeting requests.</p>
        </div>
      ) : (
        <div className="requests-list">
          {pendingRequests.map(request => (
            <div key={request.id} className={`request-item ${request.status}`}>
              <div className="request-info">
                <div className="request-therapist">
                  <strong>Dr. {request.therapist_name}</strong>
                </div>
                <div className="request-datetime">
                  {formatDateTime(request.requested_date, request.requested_start_time)}
                </div>
                {request.client_message && (
                  <div className="request-message">
                    <em>Your message: "{request.client_message}"</em>
                  </div>
                )}
                {request.therapist_response && (
                  <div className="therapist-response">
                    <strong>Therapist response:</strong> "{request.therapist_response}"
                  </div>
                )}
                <div className="request-status">
                  <span className={`status-badge ${request.status}`}>
                    {request.status === 'pending' ? 'Pending Response' :
                     request.status === 'approved' ? 'Approved ✅' :
                     request.status === 'declined' ? 'Declined ❌' :
                     request.status === 'cancelled' ? 'Cancelled ❌' :
                     request.status === 'counter_proposed' ? 'Alternative Suggested' :
                     request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                  </span>
                  {request.status === 'pending' && (
                    <button 
                      onClick={() => cancelRequest(request.id)}
                      disabled={cancellingRequestId === request.id}
                      className="cancel-request-btn"
                      style={{
                        marginLeft: '12px',
                        padding: '6px 12px',
                        backgroundColor: '#DC3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: 'pointer',
                        opacity: cancellingRequestId === request.id ? 0.6 : 1
                      }}
                    >
                      {cancellingRequestId === request.id ? 'Cancelling...' : 'Cancel Request'}
                    </button>
                  )}
                </div>
                {request.responded_at && (
                  <div className="response-time">
                    <small>Responded: {new Date(request.responded_at).toLocaleString('en', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}</small>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientCalendar;
