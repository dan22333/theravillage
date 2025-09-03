import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ScheduleAppointment.css';

const ScheduleAppointment = ({ onBack, selectedClient }) => {
  const { token } = useAuth();
  const [clients, setClients] = useState([]);
  const [formData, setFormData] = useState({
    client_id: selectedClient ? selectedClient.id.toString() : '',
    start_date: '',
    start_time: '',
    end_time: '',
    location: {
      type: 'virtual',
      address: ''
    },
    recurring_rule: ''
  });
  const [isPreSelected, setIsPreSelected] = useState(!!selectedClient);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
        setError('Failed to fetch clients');
      }
    } catch (err) {
      setError('Network error fetching clients');
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
    setError('');
    setSuccess('');

    try {
      const start_ts = new Date(`${formData.start_date}T${formData.start_time}`);
      const end_ts = new Date(`${formData.start_date}T${formData.end_time}`);

      if (end_ts <= start_ts) {
        setError('End time must be after start time');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_id: parseInt(formData.client_id),
          start_ts: start_ts.toISOString(),
          end_ts: end_ts.toISOString(),
          location: formData.location.type === 'virtual' ? null : formData.location,
          recurring_rule: formData.recurring_rule || null
        })
      });

      if (response.ok) {
        const result = await response.json();
        setSuccess('Appointment scheduled successfully!');
        setFormData({
          client_id: '',
          start_date: '',
          start_time: '',
          end_time: '',
          location: { type: 'virtual', address: '' },
          recurring_rule: ''
        });
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to schedule appointment');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error scheduling appointment:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="schedule-appointment">
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>Schedule Appointment</h1>
      </div>

      <div className="form-container">
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
                <input
                  type="time"
                  id="start_time"
                  name="start_time"
                  value={formData.start_time}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="end_time">End Time *</label>
                <input
                  type="time"
                  id="end_time"
                  name="end_time"
                  value={formData.end_time}
                  onChange={handleInputChange}
                  required
                />
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
          </div>

          {error && <div className="error-message">{error}</div>}
          {success && <div className="success-message">{success}</div>}

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onBack}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Scheduling...' : 'Schedule Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ScheduleAppointment;
