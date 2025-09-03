import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ViewCalendar.css';

const ViewCalendar = ({ onBack }) => {
  const { token } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAppointments();
  }, [currentDate]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/therapist/appointments?start_date=${startOfMonth.toISOString().split('T')[0]}&end_date=${endOfMonth.toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setAppointments(data.appointments || []);
      } else {
        setError('Failed to fetch appointments');
      }
    } catch (err) {
      setError('Network error fetching appointments');
      console.error('Error fetching appointments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };

  const getAppointmentsForDay = (day) => {
    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.start_ts);
      return appointmentDate.getDate() === day && 
             appointmentDate.getMonth() === currentDate.getMonth() &&
             appointmentDate.getFullYear() === currentDate.getFullYear();
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentDate);
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const renderCalendarDays = () => {
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayAppointments = getAppointmentsForDay(day);
      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();
      
      days.push(
        <div key={day} className={`calendar-day ${isToday ? 'today' : ''}`}>
          <div className="day-number">{day}</div>
          <div className="appointments-list">
            {dayAppointments.map(appointment => (
              <div key={appointment.id} className={`appointment-item ${appointment.status}`}>
                <div className="appointment-time">
                  {formatTime(appointment.start_ts)}
                </div>
                <div className="appointment-client">
                  {appointment.client_name}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    return days;
  };

  return (
    <div className="view-calendar">
      <div className="page-header">
        <button className="back-btn" onClick={onBack}>
          ← Back to Dashboard
        </button>
        <h1>Calendar View</h1>
      </div>

      <div className="calendar-container">
        <div className="calendar-header">
          <button className="nav-btn" onClick={() => navigateMonth(-1)}>
            ← Previous
          </button>
          <h2>{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h2>
          <button className="nav-btn" onClick={() => navigateMonth(1)}>
            Next →
          </button>
        </div>

        {isLoading && (
          <div className="loading-message">
            Loading appointments...
          </div>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <div className="calendar-grid">
          <div className="calendar-weekdays">
            <div className="weekday">Sun</div>
            <div className="weekday">Mon</div>
            <div className="weekday">Tue</div>
            <div className="weekday">Wed</div>
            <div className="weekday">Thu</div>
            <div className="weekday">Fri</div>
            <div className="weekday">Sat</div>
          </div>
          
          <div className="calendar-days">
            {renderCalendarDays()}
          </div>
        </div>

        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color scheduled"></div>
            <span>Scheduled</span>
          </div>
          <div className="legend-item">
            <div className="legend-color confirmed"></div>
            <span>Confirmed</span>
          </div>
          <div className="legend-item">
            <div className="legend-color in_progress"></div>
            <span>In Progress</span>
          </div>
          <div className="legend-item">
            <div className="legend-color completed"></div>
            <span>Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewCalendar;
