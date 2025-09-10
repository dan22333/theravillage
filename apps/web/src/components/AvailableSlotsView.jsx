import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './Notification';
import './AvailableSlotsView.css';

const AvailableSlotsView = ({ therapistId, therapistName, onClose }) => {
  const { getToken, user, loading: authLoading } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [clientMessage, setClientMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [duration, setDuration] = useState(60); // Default 60 minutes

  const API_URL = import.meta.env.VITE_API_URL;

  // Load available slots for the therapist
  const loadAvailableSlots = async () => {
    try {
      const token = await getToken();
      
      if (!token) {
        console.log('AVAILABLE SLOTS: No token available, skipping slot load');
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
      
      console.log('🔍 CLIENT: Available slots response:', response.status);
      if (response.ok) {
        const data = await response.json();
        console.log('🔍 CLIENT: Available slots data:', data);
        console.log('🔍 CLIENT: Number of slots received:', data.available_slots?.length || 0);
        if (data.available_slots && data.available_slots.length > 0) {
          console.log('🔍 CLIENT: Sample slots:');
          data.available_slots.slice(0, 3).forEach(slot => {
            console.log(`   - ${slot.slot_date} ${slot.start_time} (${slot.status})`);
          });
        }
        setAvailableSlots(data.available_slots || []);
      } else {
        console.error('Failed to load available slots:', response.status);
        const errorText = await response.text();
        console.error('Error details:', errorText);
        showError('Failed to load available time slots');
      }
    } catch (error) {
      console.error('Error loading available slots:', error);
      showError('Error loading available time slots');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (therapistId && !authLoading && user) {
      console.log('AVAILABLE SLOTS: Auth ready, loading available slots');
      loadAvailableSlots();
    } else if (!authLoading && !user) {
      console.log('AVAILABLE SLOTS: No user authenticated');
      setLoading(false);
    }
  }, [therapistId, authLoading, user]);

  // Submit booking request
  const submitBookingRequest = async () => {
    if (!selectedSlot) return;
    
    setSubmitting(true);
    try {
      const token = await getToken();
      
      // Calculate end time based on duration
      const [hours, minutes] = selectedSlot.start_time.split(':');
      const startMinutes = parseInt(hours) * 60 + parseInt(minutes);
      const endMinutes = startMinutes + duration;
      const endHours = Math.floor(endMinutes / 60);
      const endMins = endMinutes % 60;
      const endTime = `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}:00`;
      
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
          requested_end_time: endTime,
          client_message: clientMessage
        })
      });
      
      if (response.ok) {
        showSuccess('Meeting request sent! Your therapist will respond soon.');
        setTimeout(() => onClose(), 1500);
      } else {
        const error = await response.json();
        showError(error.detail || 'Failed to send meeting request');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      showError('Failed to send meeting request');
    } finally {
      setSubmitting(false);
    }
  };

  // Group slots by date
  const groupSlotsByDate = () => {
    const grouped = {};
    const today = new Date().toISOString().split('T')[0];
    
    availableSlots.forEach(slot => {
      const date = slot.slot_date;
      if (date >= today) {
        if (!grouped[date]) {
          grouped[date] = [];
        }
        grouped[date].push(slot);
      }
    });
    
    Object.keys(grouped).forEach(date => {
      grouped[date].sort((a, b) => a.start_time.localeCompare(b.start_time));
    });
    
    return grouped;
  };

  // Group slots by time period
  const groupSlotsByTimePeriod = (slots) => {
    const periods = {
      morning: [],   // 6 AM - 12 PM
      afternoon: [], // 12 PM - 6 PM  
      evening: []    // 6 PM - 10 PM
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
        weekday: 'short', 
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
      <div className="available-slots-modal">
        <div className="slots-modal-content">
          <div className="slots-modal-header">
            <h3>Available Time Slots</h3>
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
    <div className="available-slots-modal">
      <div className="slots-modal-content">
        <div className="slots-modal-header">
          <h3>Available Time Slots</h3>
          <p className="therapist-name">Dr. {therapistName}</p>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="slots-modal-body">
          {sortedDates.length === 0 ? (
            <div className="no-slots">
              <div className="no-slots-icon">📅</div>
              <h4>No Available Times</h4>
              <p>Your therapist hasn't set any available times yet. Please check back later.</p>
            </div>
          ) : (
            <div className="slots-content">
              <div className="slots-grid">
                {sortedDates.slice(0, 14).map(date => {
                  const daySlots = groupedSlots[date];
                  const timePeriods = groupSlotsByTimePeriod(daySlots);
                  
                  return (
                    <div key={date} className="date-slots-card">
                      <div className="date-header">
                        <span className="date-name">{formatDate(date)}</span>
                        <span className="slots-count">{daySlots.length} slots</span>
                      </div>
                      
                      <div className="time-periods">
                        {Object.entries(timePeriods).map(([period, slots]) => {
                          if (slots.length === 0) return null;
                          
                          return (
                            <div key={period} className="time-period">
                              <div className="period-label">
                                {period === 'morning' ? '🌅' : 
                                 period === 'afternoon' ? '☀️' : '🌙'}
                              </div>
                              <div className="period-slots">
                                {slots.map(slot => (
                                  <button
                                    key={slot.id}
                                    className={`slot-btn ${selectedSlot?.id === slot.id ? 'selected' : ''}`}
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
              
              {selectedSlot && (
                <div className="booking-section">
                  <div className="selected-slot-info">
                    <h4>Selected Time</h4>
                    <p><strong>{formatDate(selectedSlot.slot_date)}</strong> at <strong>{formatTime(selectedSlot.start_time)}</strong></p>
                  </div>
                  
                  <div className="duration-section">
                    <label htmlFor="duration">Session Duration</label>
                    <select
                      id="duration"
                      value={duration}
                      onChange={(e) => setDuration(parseInt(e.target.value))}
                    >
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 hour</option>
                      <option value={75}>1 hour 15 minutes</option>
                      <option value={90}>1 hour 30 minutes</option>
                      <option value={105}>1 hour 45 minutes</option>
                      <option value={120}>2 hours</option>
                    </select>
                  </div>
                  
                  <div className="message-section">
                    <label htmlFor="client-message">Message for your therapist (optional)</label>
                    <textarea
                      id="client-message"
                      value={clientMessage}
                      onChange={(e) => setClientMessage(e.target.value)}
                      placeholder="Any specific needs or questions for this session..."
                      rows={3}
                    />
                  </div>
                  
                  <button 
                    onClick={submitBookingRequest}
                    className="book-btn"
                    disabled={submitting}
                  >
                    {submitting ? 'Sending Request...' : 'Book This Time'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AvailableSlotsView;
