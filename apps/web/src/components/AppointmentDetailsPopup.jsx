import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification, ConfirmDialog } from './Notification';
import './AppointmentDetailsPopup.css';

const AppointmentDetailsPopup = ({ appointment, onClose, onViewClient, onReschedule }) => {
  const { getToken } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL;

  // Format appointment date and time
  const formatDateTime = (dateTimeStr) => {
    const date = new Date(dateTimeStr);
    return {
      date: date.toLocaleDateString('en', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      }),
      fullDateTime: date.toLocaleString('en', {
        weekday: 'short',
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  // Format recurring rule for display
  const formatRecurringRule = (rule) => {
    if (!rule) return 'One-time appointment';
    
    const ruleMap = {
      'weekly': 'Weekly (every week)',
      'biweekly': 'Bi-weekly (every 2 weeks)', 
      'monthly': 'Monthly (every month)'
    };
    
    return ruleMap[rule] || rule;
  };

  // Format location for display
  const formatLocation = (location) => {
    if (!location) return 'Virtual Session';
    
    if (typeof location === 'string') {
      try {
        location = JSON.parse(location);
      } catch {
        return location;
      }
    }
    
    if (location.type === 'virtual') {
      return 'Virtual Session';
    } else if (location.type === 'in_person') {
      return location.address ? `In-Person: ${location.address}` : 'In-Person Session';
    }
    
    return 'Virtual Session';
  };

  // Calculate duration
  const getDuration = () => {
    const start = new Date(appointment.start_ts);
    const end = new Date(appointment.end_ts);
    const minutes = Math.round((end - start) / (1000 * 60));
    
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  };

  // Cancel appointment
  const handleCancelAppointment = async () => {
    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/therapist/appointments/${appointment.id}/cancel`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        showSuccess('Appointment cancelled successfully. Client has been notified.');
        onClose(); // Close popup and refresh calendar
      } else {
        const error = await response.json();
        showError(error.detail || 'Failed to cancel appointment');
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      showError('Failed to cancel appointment');
    } finally {
      setLoading(false);
      setShowCancelConfirm(false);
    }
  };

  const { date, time } = formatDateTime(appointment.start_ts);

  return (
    <div className="appointment-popup-overlay">
      <div className="appointment-popup">
        <div className="popup-header">
          <h3>Appointment Details</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>

        <div className="popup-content">
          <div className="appointment-details">
            <div className="detail-section">
              <h4>Basic Information</h4>
              <div className="detail-row">
                <strong>Client:</strong>
                <span>{appointment.client_name}</span>
              </div>
              <div className="detail-row">
                <strong>Date & Time:</strong>
                <span>{date} at {time}</span>
              </div>
              <div className="detail-row">
                <strong>Duration:</strong>
                <span>{getDuration()}</span>
              </div>
              <div className="detail-row">
                <strong>Status:</strong>
                <span className={`status-badge ${appointment.status}`}>
                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                </span>
              </div>
            </div>

            <div className="detail-section">
              <h4>Session Details</h4>
              <div className="detail-row">
                <strong>Location:</strong>
                <span>{formatLocation(appointment.location)}</span>
              </div>
              <div className="detail-row">
                <strong>Recurring:</strong>
                <span>{formatRecurringRule(appointment.recurring_rule)}</span>
              </div>
              {appointment.scheduling_request_id && (
                <div className="detail-row">
                  <strong>Origin:</strong>
                  <span>Client requested meeting</span>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h4>Timestamps</h4>
              <div className="detail-row">
                <strong>Created:</strong>
                <span>{new Date(appointment.created_at || appointment.start_ts).toLocaleString('en', {
                  month: 'short',
                  day: 'numeric', 
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}</span>
              </div>
              {appointment.updated_at && appointment.updated_at !== appointment.created_at && (
                <div className="detail-row">
                  <strong>Last Updated:</strong>
                  <span>{new Date(appointment.updated_at).toLocaleString('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric', 
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="popup-actions">
          <button 
            onClick={() => onViewClient(appointment.client_id)}
            className="action-btn view-client-btn"
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
            </svg>
            View Client
          </button>
          
          <button 
            onClick={() => setShowCancelConfirm(true)}
            className="action-btn cancel-btn"
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor"/>
            </svg>
            Cancel Meeting
          </button>
          
          <button 
            onClick={() => onReschedule(appointment)}
            className="action-btn reschedule-btn"
            disabled={loading}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 6V9L16 13L14.6 14.4L11 10.8V6H12ZM12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2ZM12 20C7.6 20 4 16.4 4 12S7.6 4 12 4 20 7.6 20 12 16.4 20 12 20Z" fill="currentColor"/>
            </svg>
            Reschedule
          </button>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog 
        isOpen={showCancelConfirm}
        title="Cancel Appointment"
        message={`Are you sure you want to cancel this appointment with ${appointment.client_name}? The client will be notified automatically.`}
        onConfirm={handleCancelAppointment}
        onCancel={() => setShowCancelConfirm(false)}
        confirmText="Cancel Appointment"
        cancelText="Keep Appointment"
      />
    </div>
  );
};

export default AppointmentDetailsPopup;
