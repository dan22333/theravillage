import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from './Notification';
import AppointmentDetailsPopup from './AppointmentDetailsPopup';
import ScheduleAppointment from './ScheduleAppointment';
import './TherapistCalendar.css';

const TherapistCalendar = ({ onBack }) => {
  const { getToken, signOut } = useAuth();
  const { showSuccess, showError } = useNotification();
  // Use string-based date instead of Date object
  const [currentWeekStr, setCurrentWeekStr] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [calendarData, setCalendarData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState(null); // 'select' or 'unselect'
  const [draggedSlots, setDraggedSlots] = useState(new Set());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showAppointmentPopup, setShowAppointmentPopup] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedClientProfile, setSelectedClientProfile] = useState(null);
  const [showClientProfile, setShowClientProfile] = useState(false);

  // STRING-BASED date utilities - no Date objects
  const getMondayStr = (dateStr) => {
    // Parse YYYY-MM-DD string
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day, 12, 0, 0);
    const dayOfWeek = date.getDay();
    
    // Calculate Monday
    let mondayDay = day;
    if (dayOfWeek === 0) mondayDay = day - 6; // Sunday
    else if (dayOfWeek > 1) mondayDay = day - (dayOfWeek - 1); // Tue-Sat
    
    // Return as string
    return `${year}-${String(month).padStart(2, '0')}-${String(mondayDay).padStart(2, '0')}`;
  };

  const getWeekDatesArray = (mondayStr) => {
    // Generate 7 date strings starting from Monday
    const [year, month, day] = mondayStr.split('-').map(Number);
    const dates = [];
    
    for (let i = 0; i < 7; i++) {
      const currentDay = day + i;
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(currentDay).padStart(2, '0')}`;
      dates.push(dateStr);
    }
    
    return dates;
  };

  const API_URL = import.meta.env.VITE_API_URL;

  // Load calendar data for current week
  const loadCalendarData = async () => {
    try {
      const token = await getToken();
      const weekStart = getMondayStr(currentWeekStr);
      
      console.log(`📅 LOADING CALENDAR: Week starting ${weekStart} (current: ${currentWeekStr})`);
      
      const response = await fetch(`${API_URL}/calendar/therapist/calendar/week/${weekStart}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📅 Calendar data loaded:', data);
        console.log('📅 Slots count:', data.slots?.length || 0);
        console.log('📅 Available slots:', data.slots?.filter(s => s.status === 'available').length || 0);
        console.log('📅 Booked slots:', data.slots?.filter(s => s.status === 'booked').length || 0);
        console.log('📅 Appointments:', data.appointments?.length || 0);
        
        // Show some sample available slots
        const availableSlots = data.slots?.filter(s => s.status === 'available') || [];
        if (availableSlots.length > 0) {
          console.log('📅 Sample available slots:');
          availableSlots.slice(0, 3).forEach(slot => {
            console.log(`   - ${slot.slot_date} ${slot.start_time} (${slot.status})`);
          });
        }
        setCalendarData(data);
      } else {
        console.error('Failed to load calendar data');
      }
    } catch (error) {
      console.error('Error loading calendar data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load pending scheduling requests
  const loadPendingRequests = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/calendar/scheduling-requests/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.pending_requests || []);
      }
    } catch (error) {
      console.error('Error loading pending requests:', error);
    }
  };

  useEffect(() => {
    loadCalendarData();
    loadPendingRequests();
  }, [currentWeekStr]);

  // Add global mouse up listener for drag operations
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, draggedSlots, dragMode]);

  // Navigate weeks using strings
  const navigateWeek = (direction) => {
    const [year, month, day] = currentWeekStr.split('-').map(Number);
    const currentDate = new Date(year, month - 1, day);
    const newDate = new Date(currentDate.getTime() + (direction * 7 * 24 * 60 * 60 * 1000));
    
    const newYear = newDate.getFullYear();
    const newMonth = String(newDate.getMonth() + 1).padStart(2, '0');
    const newDay = String(newDate.getDate()).padStart(2, '0');
    
    setCurrentWeekStr(`${newYear}-${newMonth}-${newDay}`);
  };

  // Create a new availability slot
  const createAvailabilitySlot = async (slotData) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/calendar/therapist/calendar/slots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(slotData)
      });
      
      if (response.ok) {
        console.log('✅ Slot created successfully');
        // Small delay to prevent UI jumping during reload
        setTimeout(() => loadCalendarData(), 100);
      } else {
        const error = await response.json();
        showError(error.detail || 'Failed to create availability slot');
      }
    } catch (error) {
      console.error('Error creating slot:', error);
      showError('Failed to create availability slot');
    }
  };

  // Delete an availability slot
  const deleteAvailabilitySlot = async (slotId) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/calendar/therapist/calendar/slots/${slotId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        console.log('✅ Slot deleted successfully');
        // Small delay to prevent UI jumping during reload
        setTimeout(() => loadCalendarData(), 100);
      } else {
        const error = await response.json();
        showError(error.detail || 'Failed to delete availability slot');
      }
    } catch (error) {
      console.error('Error deleting slot:', error);
      showError('Failed to delete availability slot');
    }
  };

  // Respond to scheduling request
  const respondToRequest = async (requestId, status, response = '', alternatives = null) => {
    try {
      const token = await getToken();
      console.log('🔍 THERAPIST: Responding to request', requestId, 'with status', status);
      console.log('🔍 THERAPIST: API URL:', `${API_URL}/calendar/scheduling-requests/${requestId}/respond`);
      
      const apiResponse = await fetch(`${API_URL}/calendar/scheduling-requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status,
          therapist_response: response,
          suggested_alternatives: alternatives
        })
      });
      
      if (apiResponse.ok) {
        await loadPendingRequests(); // Reload requests
        await loadCalendarData(); // Reload calendar
        showSuccess(`Request ${status} successfully!`);
      } else {
        const error = await apiResponse.json();
        showError(error.detail || `Failed to ${status} request`);
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      showError(`Failed to ${status} request`);
    }
  };

  const fetchClientProfile = async (clientId) => {
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/therapist/clients/${clientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const clientData = await response.json();
        setSelectedClientProfile(clientData);
        setShowClientProfile(true);
      } else {
        showError('Failed to load client profile');
      }
    } catch (error) {
      console.error('Error fetching client profile:', error);
      showError('Error loading client profile');
    }
  };

  // Generate time slots for a day (6 AM to 10 PM, 15-minute intervals)
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 6; hour < 22; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        slots.push(time);
      }
    }
    return slots;
  };

  // STRING-BASED week generation - no Date objects
  const getWeekDatesForCalendar = () => {
    const mondayStr = getMondayStr(currentWeekStr);
    const weekDates = getWeekDatesArray(mondayStr);
    
    console.log('🗓️ STRING-BASED WEEK:', {
      currentWeekStr,
      mondayStr,
      weekDates
    });
    
    return weekDates;
  };

  // Get slot for specific day and time
  const getSlotForDateTime = (date, time) => {
    if (!calendarData?.slots) return null;
    const dateStr = formatDateForAPI(date);
    return calendarData.slots.find(slot => 
      slot.slot_date === dateStr && slot.start_time === time + ':00'
    );
  };

  // Simple appointment matching
  const getAppointmentForDateTime = (date, time) => {
    if (!calendarData?.appointments) return null;
    const appointments = calendarData.appointments.filter(apt => {
      const aptDate = apt.start_ts.split('T')[0];
      const aptTime = apt.start_ts.split('T')[1].slice(0, 5);
      const dateStr = formatDateForAPI(date);
      const timeToMatch = time.padStart(5, '0');
      
      return aptDate === dateStr && aptTime === timeToMatch;
    });
    return appointments[0] || null;
  };

  // Handle mouse down - Start dragging with string dates
  const handleMouseDown = (event, dateStr, time) => {
    // Prevent creating availability on past dates/times (with 15-minute buffer)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Round current time to next 15-minute interval to allow scheduling
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const roundedMinutes = Math.ceil(currentMinute / 15) * 15;
    const adjustedHour = roundedMinutes >= 60 ? currentHour + 1 : currentHour;
    const finalMinutes = roundedMinutes >= 60 ? 0 : roundedMinutes;
    
    const currentTime = `${adjustedHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    
    if (dateStr < today || (dateStr === today && time < currentTime)) {
      showError(`Cannot create availability in the past (${time} is before current time ${currentTime})`);
      return;
    }
    
    // Find slot and appointment using direct string comparison
    const slot = calendarData?.slots?.find(s => 
      s.slot_date === dateStr && s.start_time === time + ':00'
    );
    
    const appointment = calendarData?.appointments?.find(apt => {
      const aptDate = apt.start_ts.split('T')[0];
      const aptTime = apt.start_ts.split('T')[1].slice(0, 5);
      return aptDate === dateStr && aptTime === time;
    });
    
    if (appointment) {
      setSelectedAppointment(appointment);
      setShowAppointmentPopup(true);
      return;
    }
    
    // Determine drag mode based on current slot state
    const isAvailable = slot && slot.status === 'available';
    setDragMode(isAvailable ? 'unselect' : 'select');
    setIsDragging(true);
    setDraggedSlots(new Set([`${dateStr}_${time}`]));
    
    console.log('🖱️ DRAG START:', {
      dateStr,
      time,
      mode: isAvailable ? 'unselect' : 'select'
    });
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  };

  // Handle mouse enter during drag
  const handleMouseEnter = (event, dateStr, time) => {
    if (!isDragging) return;
    
    // Prevent dragging on past dates
    const today = new Date().toISOString().split('T')[0];
    if (dateStr < today) {
      return;
    }
    
    // Skip booked slots
    const appointment = calendarData?.appointments?.find(apt => {
      const aptDate = apt.start_ts.split('T')[0];
      const aptTime = apt.start_ts.split('T')[1].slice(0, 5);
      return aptDate === dateStr && aptTime === time;
    });
    
    if (appointment) return;
    
    setDraggedSlots(prev => new Set([...prev, `${dateStr}_${time}`]));
    
    console.log('🖱️ DRAG OVER:', dateStr, time);
  };

  // Handle mouse up - Complete drag operation
  const handleMouseUp = async () => {
    if (!isDragging || draggedSlots.size === 0) {
      setIsDragging(false);
      setDraggedSlots(new Set());
      document.body.style.userSelect = '';
      return;
    }

    try {
      // Process all dragged slots using string dates
      const operations = [];
      
      console.log('🖱️ PROCESSING DRAG:', {
        mode: dragMode,
        slots: Array.from(draggedSlots)
      });
      
      for (const slotKey of draggedSlots) {
        const [dateStr, time] = slotKey.split('_');
        
        // Find slot using string comparison
        const slot = calendarData?.slots?.find(s => 
          s.slot_date === dateStr && s.start_time === time + ':00'
        );
        
        if (dragMode === 'select' && !slot) {
          // Create availability slot (15-minute duration)
          const [hour, minute] = time.split(':').map(Number);
          const endMinutes = hour * 60 + minute + 15;
          const endHour = Math.floor(endMinutes / 60);
          const endMin = endMinutes % 60;
          const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
          
          console.log('📅 CREATING SLOT:', { dateStr, time, endTimeStr });
          
          operations.push(createAvailabilitySlot({
            slot_date: dateStr,
            start_time: time + ':00',
            end_time: endTimeStr
          }));
        } else if (dragMode === 'unselect' && slot && slot.status === 'available') {
          console.log('🗑️ DELETING SLOT:', { dateStr, time, slotId: slot.id });
          operations.push(deleteAvailabilitySlot(slot.id));
        }
      }
      
      // Execute all operations
      await Promise.all(operations);
      
    } catch (error) {
      console.error('Error during drag operation:', error);
    } finally {
      setIsDragging(false);
      setDraggedSlots(new Set());
      setDragMode(null);
      document.body.style.userSelect = '';
    }
  };

  // COMPLETELY REWRITTEN - Handle time slot click with bulletproof date handling
  const handleTimeSlotClick = async (event) => {
    // If we just finished dragging, don't process click
    if (isDragging) return;
    
    // Get the exact date and time from the clicked element's data attributes
    const clickedDate = event.target.getAttribute('data-date');
    const clickedTime = event.target.getAttribute('data-time');
    
    console.log('🎯 DIRECT CLICK:', {
      dataDate: clickedDate,
      dataTime: clickedTime
    });
    
    if (!clickedDate || !clickedTime) {
      console.error('❌ Missing data attributes on clicked element');
      return;
    }
    
    // Prevent creating availability on past dates/times (with 15-minute buffer)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Round current time to next 15-minute interval to allow scheduling
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const roundedMinutes = Math.ceil(currentMinute / 15) * 15;
    const adjustedHour = roundedMinutes >= 60 ? currentHour + 1 : currentHour;
    const finalMinutes = roundedMinutes >= 60 ? 0 : roundedMinutes;
    
    const currentTime = `${adjustedHour.toString().padStart(2, '0')}:${finalMinutes.toString().padStart(2, '0')}`;
    
    console.log('🕐 TIME VALIDATION:', { 
      clickedDate, 
      clickedTime, 
      today, 
      currentTime,
      rawTime: `${currentHour}:${currentMinute}`,
      willBlock: clickedDate < today || (clickedDate === today && clickedTime < currentTime)
    });
    
    if (clickedDate < today || (clickedDate === today && clickedTime < currentTime)) {
      showError(`Cannot create availability in the past (${clickedTime} is before current time ${currentTime})`);
      return;
    }
    
    // Find slot and appointment using direct string comparison
    const slot = calendarData?.slots?.find(s => 
      s.slot_date === clickedDate && s.start_time === clickedTime + ':00'
    );
    
    // Check if clicked time is within any appointment's duration
    const appointment = calendarData?.appointments?.find(apt => {
      const aptDate = apt.start_ts.split('T')[0];
      const aptStartTime = apt.start_ts.split('T')[1].slice(0, 5);
      const aptEndTime = apt.end_ts.split('T')[1].slice(0, 5);
      
      if (aptDate === clickedDate) {
        const clickedTimeMinutes = parseInt(clickedTime.split(':')[0]) * 60 + parseInt(clickedTime.split(':')[1]);
        const startTimeMinutes = parseInt(aptStartTime.split(':')[0]) * 60 + parseInt(aptStartTime.split(':')[1]);
        const endTimeMinutes = parseInt(aptEndTime.split(':')[0]) * 60 + parseInt(aptEndTime.split(':')[1]);
        
        return clickedTimeMinutes >= startTimeMinutes && clickedTimeMinutes < endTimeMinutes;
      }
      return false;
    });
    
    if (appointment) {
      setSelectedAppointment(appointment);
      setShowAppointmentPopup(true);
      return;
    }
    
    if (slot && slot.status === 'available') {
      // Delete slot
      await deleteAvailabilitySlot(slot.id);
    } else if (!slot) {
      // Create slot
      const [hour, minute] = clickedTime.split(':').map(Number);
      const endMinutes = hour * 60 + minute + 15;
      const endHour = Math.floor(endMinutes / 60);
      const endMin = endMinutes % 60;
      const endTimeStr = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;
      
      await createAvailabilitySlot({
        slot_date: clickedDate,
        start_time: clickedTime + ':00',
        end_time: endTimeStr
      });
    }
  };

  // Generate calendar data
  const timeSlots = generateTimeSlots();
  const weekDateStrings = getWeekDatesForCalendar();

  if (loading) {
    return (
      <div className="therapist-calendar-loading">
        <div className="loading-spinner"></div>
        <p>Loading calendar...</p>
      </div>
    );
  }

  return (
    <div className="therapist-calendar">
      <div className="calendar-header">
        <div className="calendar-header-left">
          <button onClick={onBack} className="back-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 11H7.83L13.42 5.41L12 4L4 12L12 20L13.41 18.59L7.83 13H20V11Z" fill="currentColor"/>
            </svg>
            Back to Dashboard
          </button>
          <h2>My Calendar & Availability</h2>
        </div>
        <div className="calendar-header-right">
          <div className="calendar-navigation">
            <button onClick={() => navigateWeek(-1)} className="nav-btn">
              ← Previous Week
            </button>
            <span className="current-week">
              Week of {getMondayStr(currentWeekStr)}
            </span>
            <button onClick={() => navigateWeek(1)} className="nav-btn">
              Next Week →
            </button>
          </div>
          <button onClick={signOut} className="sign-out-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
            Sign Out
          </button>
        </div>
      </div>

      {/* Pending Requests Section */}
      {pendingRequests.length > 0 && (
        <div className="pending-requests">
          <h3>Pending Scheduling Requests ({pendingRequests.length})</h3>
          <div className="requests-list">
            {pendingRequests.map(request => {
              // Calculate duration
              const startTime = request.requested_start_time;
              const endTime = request.requested_end_time;
              const startMinutes = parseInt(startTime.split(':')[0]) * 60 + parseInt(startTime.split(':')[1]);
              const endMinutes = parseInt(endTime.split(':')[0]) * 60 + parseInt(endTime.split(':')[1]);
              const durationMinutes = endMinutes - startMinutes;
              
              // Format date and time
              const requestDate = new Date(request.requested_date);
              const formattedDate = requestDate.toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              });
              
              // Format time to 12-hour format
              const formatTime = (timeStr) => {
                const [hours, minutes] = timeStr.split(':');
                const hour = parseInt(hours);
                const ampm = hour >= 12 ? 'PM' : 'AM';
                const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
                return `${displayHour}:${minutes} ${ampm}`;
              };

              return (
                <div key={request.id} className="request-item">
                  <div className="request-info">
                    <div className="request-header">
                      <span 
                        className="client-name clickable"
                        onClick={() => fetchClientProfile(request.client_id)}
                        style={{ 
                          color: '#20B2AA', 
                          cursor: 'pointer', 
                          fontWeight: 'bold',
                          textDecoration: 'underline'
                        }}
                      >
                        {request.client_name}
                      </span>
                      <span className="request-date-time">
                        {formattedDate} • {formatTime(startTime)} - {formatTime(endTime)} • {durationMinutes} min
                      </span>
                    </div>
                    {request.client_message && (
                      <p className="client-message">"{request.client_message}"</p>
                    )}
                  </div>
                  <div className="request-actions">
                    <button 
                      onClick={() => respondToRequest(request.id, 'approved')}
                      className="approve-btn"
                    >
                      Approve
                    </button>
                    <button 
                      onClick={() => {
                        const response = prompt('Reason for declining (optional):');
                        respondToRequest(request.id, 'declined', response || '');
                      }}
                      className="decline-btn"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="calendar-grid">
        <div className="calendar-header-row">
          <div className="time-column-header">Time</div>
          {weekDateStrings.map((dateStr, i) => {
            const [year, month, day] = dateStr.split('-').map(Number);
            const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            const today = new Date().toISOString().split('T')[0];
            const isPastDate = dateStr < today;
            
            return (
              <div key={dateStr} className={`day-header ${isPastDate ? 'past-date-header' : ''}`}>
                <div className="day-name">{dayNames[i]}</div>
                <div className="day-date">{day}</div>
                {isPastDate && <div className="past-indicator">Past</div>}
              </div>
            );
          })}
        </div>

        {timeSlots.map(time => (
          <div key={time} className="calendar-row">
            <div className="time-label">{time}</div>
            {weekDateStrings.map(dateStr => {
              // Find slot and appointment using direct string comparison
              const slot = calendarData?.slots?.find(s => 
                s.slot_date === dateStr && s.start_time === time + ':00'
              );
              
              // Note: Not all time slots will have availability - this is normal
              
              // Check if this time slot is within any appointment's duration
              const appointment = calendarData?.appointments?.find(apt => {
                const aptDate = apt.start_ts.split('T')[0];
                const aptStartTime = apt.start_ts.split('T')[1].slice(0, 5);
                const aptEndTime = apt.end_ts.split('T')[1].slice(0, 5);
                
                // Check if this slot falls within the appointment time range
                if (aptDate === dateStr) {
                  const currentTimeMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
                  const startTimeMinutes = parseInt(aptStartTime.split(':')[0]) * 60 + parseInt(aptStartTime.split(':')[1]);
                  const endTimeMinutes = parseInt(aptEndTime.split(':')[0]) * 60 + parseInt(aptEndTime.split(':')[1]);
                  
                  return currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes;
                }
                return false;
              });
              
              const slotKey = `${dateStr}_${time}`;
              const isDraggedOver = draggedSlots.has(slotKey);
              
              let cellClass = 'calendar-cell';
              let cellContent = '';
              
              // Check if this is a past date
              const today = new Date().toISOString().split('T')[0];
              const isPastDate = dateStr < today;
              
              if (isPastDate) {
                cellClass += ' past-date';
              }
              
              if (appointment) {
                cellClass += ' booked';
                
                // Determine if this is the start, middle, or end of the appointment
                const aptStartTime = appointment.start_ts.split('T')[1].slice(0, 5);
                const aptEndTime = appointment.end_ts.split('T')[1].slice(0, 5);
                const currentTimeMinutes = parseInt(time.split(':')[0]) * 60 + parseInt(time.split(':')[1]);
                const startTimeMinutes = parseInt(aptStartTime.split(':')[0]) * 60 + parseInt(aptStartTime.split(':')[1]);
                const endTimeMinutes = parseInt(aptEndTime.split(':')[0]) * 60 + parseInt(aptEndTime.split(':')[1]);
                
                // Calculate duration for display
                const durationMinutes = endTimeMinutes - startTimeMinutes;
                const durationText = durationMinutes >= 60 ? 
                  `${Math.floor(durationMinutes / 60)}h${durationMinutes % 60 > 0 ? ` ${durationMinutes % 60}m` : ''}` : 
                  `${durationMinutes}m`;
                
                if (currentTimeMinutes === startTimeMinutes) {
                  // Start of appointment - show client name and duration
                  cellContent = `${appointment.client_name} (${durationText})`;
                  cellClass += ' appointment-start';
                } else if (currentTimeMinutes === endTimeMinutes - 15) {
                  // Last slot of appointment
                  cellContent = '↑ (cont.)';
                  cellClass += ' appointment-end';
                } else {
                  // Middle of appointment
                  cellContent = '↑ (cont.)';
                  cellClass += ' appointment-middle';
                }
              } else if (slot && slot.status === 'available') {
                cellClass += ' available';
                cellContent = 'Available';
              }
              
              // Add drag preview classes
              if (isDraggedOver && isDragging) {
                if (dragMode === 'select' && !slot && !appointment) {
                  cellClass += ' drag-select-preview';
                } else if (dragMode === 'unselect' && slot && slot.status === 'available') {
                  cellClass += ' drag-unselect-preview';
                }
              }
              
              return (
                <div 
                  key={`${dateStr}-${time}`}
                  className={cellClass}
                  data-date={dateStr}
                  data-time={time}
                  onMouseDown={isPastDate ? undefined : (e) => handleMouseDown(e, dateStr, time)}
                  onMouseEnter={isPastDate ? undefined : (e) => handleMouseEnter(e, dateStr, time)}
                  onClick={isPastDate ? undefined : handleTimeSlotClick}
                  style={{ 
                    cursor: isPastDate ? 'not-allowed' : (isDragging ? 'grabbing' : 'pointer'),
                    opacity: isPastDate ? 0.3 : 1
                  }}
                >
                  {cellContent}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-color booked"></div>
          <span>Booked</span>
        </div>
        <div className="legend-item">
          <div className="legend-color"></div>
          <span>Unavailable</span>
        </div>
      </div>

      {/* Instructions */}
      <div className="calendar-instructions">
        <p><strong>How to use:</strong></p>
        <ul>
          <li><strong>Click</strong> empty slot → Creates 15-minute availability</li>
          <li><strong>Click</strong> green slot → Removes availability</li>
          <li><strong>Drag</strong> across multiple slots → Bulk select/unselect</li>
          <li><strong>Click</strong> red slots → View appointment details</li>
          <li><strong>Approve/decline</strong> requests above calendar</li>
        </ul>
      </div>

      {/* Appointment Details Popup */}
      {showAppointmentPopup && selectedAppointment && (
        <AppointmentDetailsPopup 
          appointment={selectedAppointment}
          onClose={() => {
            setShowAppointmentPopup(false);
            setSelectedAppointment(null);
            // Add small delay to ensure DB transaction is committed
            setTimeout(() => loadCalendarData(), 500);
          }}
          onViewClient={(clientId) => {
            // Close popup and navigate to client profile
            setShowAppointmentPopup(false);
            setSelectedAppointment(null);
            onBack(); // Go back to main dashboard
            // The main dashboard will handle showing client profile
            window.dispatchEvent(new CustomEvent('viewClient', { detail: { clientId } }));
          }}
          onReschedule={(appointment) => {
            setShowAppointmentPopup(false);
            setSelectedAppointment(appointment);
            setShowRescheduleModal(true);
          }}
        />
      )}

      {/* Client Profile Popup */}
      {showClientProfile && selectedClientProfile && (
        <div className="popup-overlay" onClick={() => setShowClientProfile(false)}>
          <div className="client-profile-popup" onClick={(e) => e.stopPropagation()}>
            <div className="popup-header">
              <h3>Client Profile</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowClientProfile(false)}
              >
                ×
              </button>
            </div>
            <div className="popup-content">
              <div className="profile-section">
                <h4>{selectedClientProfile.name}</h4>
                <p><strong>Email:</strong> {selectedClientProfile.email}</p>
                {selectedClientProfile.dob && (
                  <p><strong>Date of Birth:</strong> {new Date(selectedClientProfile.dob).toLocaleDateString()}</p>
                )}
                {selectedClientProfile.school && (
                  <p><strong>School:</strong> {selectedClientProfile.school}</p>
                )}
                <p><strong>Status:</strong> {selectedClientProfile.status}</p>
                {selectedClientProfile.assignment_start && (
                  <p><strong>Assignment Start:</strong> {new Date(selectedClientProfile.assignment_start).toLocaleDateString()}</p>
                )}
                {selectedClientProfile.capacity_pct && (
                  <p><strong>Capacity:</strong> {selectedClientProfile.capacity_pct}%</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedAppointment && (
        <ScheduleAppointment 
          onClose={() => {
            setShowRescheduleModal(false);
            setSelectedAppointment(null);
            loadCalendarData(); // Refresh calendar
          }}
          selectedClient={{
            id: selectedAppointment.client_id,
            name: selectedAppointment.client_name
          }}
          isReschedule={true}
          originalAppointment={selectedAppointment}
        />
      )}
    </div>
  );
};

export default TherapistCalendar;
