import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './Notification';
import './ScheduleAppointment.css';

const ScheduleAppointment = ({ onClose, selectedClient, isReschedule = false, originalAppointment = null }) => {
  const { getToken } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    client_id: selectedClient ? selectedClient.id.toString() : '',
    start_date: '',
    start_time: '',
    duration_minutes: 60,
    location: {
      type: 'virtual',
      address: ''
    },
    recurring_rule: '',
    recurring_end_date: ''
  });
  const [isPreSelected, setIsPreSelected] = useState(!!selectedClient);
  const [isLoading, setIsLoading] = useState(false);

  // Generate time options in 15-minute intervals (6 AM to 10 PM)
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        times.push(time);
      }
    }
    return times;
  };

  // Format time for display (12-hour format)
  const formatTimeForDisplay = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  useEffect(() => {
    fetchClients();
  }, []);

  // Update form when selectedClient changes
  useEffect(() => {
    if (selectedClient) {
      setFormData(prev => ({
        ...prev,
        client_id: selectedClient.id.toString()
      }));
      setIsPreSelected(true);
    } else {
      setIsPreSelected(false);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setClients(data.clients || []);
      } else {
        showError('Failed to fetch clients');
      }
    } catch (err) {
      showError('Network error fetching clients');
      console.error('Error fetching clients:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Clear pre-selected state if user manually changes client
    if (name === 'client_id') {
      setIsPreSelected(false);
    }
    
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

    try {
      const token = await getToken();
      
      // Create datetime string without any timezone conversion
      const start_ts_string = `${formData.start_date}T${formData.start_time}:00`;
      
      console.log('📅 APPOINTMENT CREATION (No TZ):', {
        dateInput: formData.start_date,
        timeInput: formData.start_time,
        combined: start_ts_string
      });

      if (formData.duration_minutes <= 0) {
        showError('Duration must be greater than 0 minutes');
        setIsLoading(false);
        return;
      }

      let response;
      
      if (isReschedule && originalAppointment) {
        // Use reschedule endpoint
        response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments/${originalAppointment.id}/reschedule`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: parseInt(formData.client_id),
            start_ts: start_ts_string,
            duration_minutes: formData.duration_minutes,
            location: formData.location,
            recurring_rule: formData.recurring_rule || null,
            recurring_end_date: formData.recurring_end_date || null
          })
        });
      } else {
        // Use regular appointment creation
        response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: parseInt(formData.client_id),
            start_ts: start_ts_string,
            duration_minutes: formData.duration_minutes,
            location: formData.location,
            recurring_rule: formData.recurring_rule || null,
            recurring_end_date: formData.recurring_end_date || null
          })
        });
      }

      if (response.ok) {
        const result = await response.json();
        
        if (isReschedule) {
          showSuccess('Appointment rescheduled successfully! Client has been notified.');
        } else {
          const count = result.count || 1;
          if (count > 1) {
            showSuccess(`${count} recurring appointments scheduled successfully!`);
          } else {
            showSuccess('Appointment scheduled successfully!');
          }
        }
        
        // Auto-close modal after 1.5 seconds
        setTimeout(() => {
          onClose();
        }, 1500);
        
      } else {
        const errorData = await response.json();
        showError(errorData.detail || 'Failed to schedule appointment');
      }
    } catch (err) {
      showError('Network error. Please try again.');
      console.error('Error scheduling appointment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="schedule-appointment-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{isReschedule ? 'Reschedule Appointment' : 'Schedule Appointment'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
        <form onSubmit={handleSubmit} className="appointment-form">
          <div className="form-section">
            <h2>Client & Time</h2>
            
            <div className="form-group">
              <label htmlFor="client_id">Select Client *</label>
              {isPreSelected && selectedClient && (
                <div className="selected-client-indicator">
                  <span className="indicator-text">Pre-selected: {selectedClient.name}</span>
                </div>
              )}
              <select
                id="client_id"
                name="client_id"
                value={formData.client_id}
                onChange={handleInputChange}
                required
                className={isPreSelected ? 'pre-selected' : ''}
              >
                <option value="">Choose a client...</option>
                {clients.map(client => (
                  <option key={client.id} value={client.id}>
                    {client.name} - {client.school || 'No school'}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="start_date">Date *</label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={formData.start_date}
                onChange={handleInputChange}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="time-row">
              <div className="form-group">
                <label htmlFor="start_time">Start Time *</label>
                <select
                  id="start_time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleInputChange}
                  required
                >
                  <option value="">Select start time...</option>
                  {generateTimeOptions().map(time => (
                    <option key={time} value={time}>
                      {formatTimeForDisplay(time)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="duration_minutes">Duration (minutes) *</label>
                <select
                  id="duration_minutes"
                  name="duration_minutes"
                  value={formData.duration_minutes}
                  onChange={handleInputChange}
                  required
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={75}>1 hour 15 minutes</option>
                  <option value={90}>1.5 hours</option>
                  <option value={105}>1 hour 45 minutes</option>
                  <option value={120}>2 hours</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h2>Location</h2>
            
            <div className="form-group">
              <label>Session Type</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="location.type"
                    value="virtual"
                    checked={formData.location.type === 'virtual'}
                    onChange={handleInputChange}
                  />
                  <span className="radio-text">Virtual Session</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="location.type"
                    value="in_person"
                    checked={formData.location.type === 'in_person'}
                    onChange={handleInputChange}
                  />
                  <span className="radio-text">In-Person Session</span>
                </label>
              </div>
            </div>

            {formData.location.type === 'in_person' && (
              <div className="form-group">
                <label htmlFor="location.address">Address</label>
                <input
                  type="text"
                  id="location.address"
                  name="location.address"
                  value={formData.location.address}
                  onChange={handleInputChange}
                  placeholder="Enter session address"
                />
              </div>
            )}
          </div>

          <div className="form-section">
            <h2>Recurring Options</h2>
            
            <div className="form-group">
              <label htmlFor="recurring_rule">Recurring Pattern</label>
              <select
                id="recurring_rule"
                name="recurring_rule"
                value={formData.recurring_rule}
                onChange={handleInputChange}
              >
                <option value="">No recurrence</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {formData.recurring_rule && (
              <div className="form-group">
                <label htmlFor="recurring_end_date">Repeat Until *</label>
                <input
                  type="date"
                  id="recurring_end_date"
                  name="recurring_end_date"
                  value={formData.recurring_end_date}
                  onChange={handleInputChange}
                  required
                  min={formData.start_date}
                />
                <small className="form-help">
                  Appointments will be created {formData.recurring_rule} until this date
                </small>
              </div>
            )}
          </div>


          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Scheduling...' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

export default ScheduleAppointment;
