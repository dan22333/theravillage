import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './RecentRequests.css';

const RecentRequests = () => {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [selectedRequestForCancel, setSelectedRequestForCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedRequestForView, setSelectedRequestForView] = useState(null);

  const fetchRecentRequests = async () => {
    try {
      setIsLoading(true);
      const token = await getToken();
      if (!token) {
        console.error('No authentication token available');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/recent-requests`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      } else {
        console.error('Failed to fetch recent requests:', response.status);
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching recent requests:', error);
      setError('Failed to load recent requests');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentRequests();
  }, []);

  const handleCancelAppointment = async () => {
    try {
      const token = await getToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/appointments/${selectedRequestForCancel.id}/cancel`, {
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
        setSelectedRequestForCancel(null);
        setCancellationReason('');
        fetchRecentRequests(); // Refresh the requests
      } else {
        console.error('Failed to cancel appointment:', response.status);
      }
    } catch (error) {
      console.error('Error cancelling appointment:', error);
    }
  };

  // Respond to scheduling request (same logic as TherapistCalendar)
  const respondToRequest = async (requestId, status, response = '', alternatives = null) => {
    try {
      const token = await getToken();
      console.log('🔍 RECENT REQUESTS: Responding to request', requestId, 'with status', status);
      
      const apiResponse = await fetch(`${import.meta.env.VITE_API_URL}/calendar/scheduling-requests/${requestId}/respond`, {
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
        fetchRecentRequests(); // Reload requests
        console.log('✅ RECENT REQUESTS: Request responded successfully');
      } else {
        const errorData = await apiResponse.json();
        console.error('❌ RECENT REQUESTS: Failed to respond to request:', errorData);
      }
    } catch (error) {
      console.error('❌ RECENT REQUESTS: Error responding to request:', error);
    }
  };

  const getStatusDisplay = (request) => {
    const status = request.status;
    switch (status) {
      case 'approved':
        return { text: 'Approved ✅', className: 'approved' };
      case 'declined':
        return { text: 'Declined ❌', className: 'declined' };
      case 'cancelled':
        // Show who cancelled and why
        if (request.cancelled_by === 'therapist') {
          return { text: 'Cancelled by Therapist ❌', className: 'cancelled' };
        } else if (request.cancelled_by === 'client') {
          return { text: 'Cancelled by Patient ❌', className: 'cancelled' };
        } else {
          return { text: 'Cancelled ❌', className: 'cancelled' };
        }
      case 'counter_proposed':
        return { text: 'Alternative Suggested', className: 'counter-proposed' };
      case 'pending':
        return { text: 'Pending Response', className: 'pending' };
      default:
        return { text: status.charAt(0).toUpperCase() + status.slice(1), className: 'default' };
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date';
    return new Date(dateString).toLocaleDateString('en', { 
      weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    // Handle both ISO datetime strings and time-only strings
    if (timeString.includes('T')) {
      // ISO datetime string - extract time part
      return timeString.split('T')[1]?.split('.')[0] || timeString;
    } else {
      // Time-only string
      return timeString;
    }
  };

  const visibleRequests = showAll ? requests : requests.slice(0, 5);
  const hasMore = requests.length > 5;

  if (isLoading) {
    return (
      <div className="recent-requests-widget">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
          Recent Requests
        </h2>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading recent requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="recent-requests-widget">
        <h2>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
          </svg>
          Recent Requests
        </h2>
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchRecentRequests} className="btn btn-secondary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="recent-requests-widget">
      <h2>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
        </svg>
        Recent Requests
      </h2>
      
      <div className="requests-list">
        {visibleRequests.length > 0 ? (
          <>
            {visibleRequests.map((request, index) => {
              const statusInfo = getStatusDisplay(request);
              return (
                <div key={request.id} className={`request-item ${statusInfo.className}`}>
                  <div className="request-info">
                    <div className="request-client">
                      {request.client_name || 'Unknown Client'}
                      {index < 5 && <span className="recent-badge">• Recent</span>}
                    </div>
                    <div className="request-time">
                      {formatDate(request.requested_time)}
                    </div>
                    <div className="request-details">
                      <span className="status-badge">{statusInfo.text}</span>
                      {request.therapist_response && (
                        <div className="therapist-response">
                          {request.therapist_response}
                        </div>
                      )}
                    </div>
                    <div className="request-actions">
                      {request.status === 'pending' && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedRequestForView(request);
                              setShowViewModal(true);
                            }}
                            className="view-btn"
                            title="View Request Details"
                          >
                            View
                          </button>
                          <button 
                            onClick={() => respondToRequest(request.id, 'approved')}
                            className="approve-btn"
                            title="Approve Request"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={() => {
                              const response = prompt('Reason for declining (optional):');
                              respondToRequest(request.id, 'declined', response || '');
                            }}
                            className="decline-btn"
                            title="Decline Request"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {request.status === 'approved' && (
                        <button 
                          onClick={() => {
                            setSelectedRequestForCancel(request);
                            setShowCancelModal(true);
                          }}
                          className="cancel-btn"
                          title="Cancel Appointment"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {hasMore && (
              <div className="show-more-section">
                <button 
                  onClick={() => setShowAll(!showAll)}
                  className="show-more-btn"
                >
                  {showAll ? 'Show Less' : `Show More (${requests.length - 5} more)`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="empty-state">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V15H13V17ZM13 13H11V7H13V13Z" fill="currentColor"/>
            </svg>
            <h3>No recent requests</h3>
            <p>Patient scheduling requests will appear here.</p>
          </div>
        )}
      </div>

      {/* View Request Details Modal */}
      {showViewModal && selectedRequestForView && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Request Details</h3>
            <div className="request-details-modal">
              <div className="detail-row">
                <strong>Patient:</strong> {selectedRequestForView.client_name}
              </div>
              <div className="detail-row">
                <strong>Requested Date:</strong> {selectedRequestForView.requested_date ? new Date(selectedRequestForView.requested_date).toLocaleDateString() : 'N/A'}
              </div>
              <div className="detail-row">
                <strong>Requested Time:</strong> {formatTime(selectedRequestForView.requested_start_time)}
                {selectedRequestForView.requested_end_time && ` - ${formatTime(selectedRequestForView.requested_end_time)}`}
              </div>
              <div className="detail-row">
                <strong>Status:</strong> 
                <span className={`status-badge ${getStatusDisplay(selectedRequestForView).className}`}>
                  {getStatusDisplay(selectedRequestForView).text}
                </span>
              </div>
              {selectedRequestForView.client_message && (
                <div className="detail-row">
                  <strong>Patient Message:</strong>
                  <div className="client-message-detail">"{selectedRequestForView.client_message}"</div>
                </div>
              )}
              {selectedRequestForView.therapist_response && (
                <div className="detail-row">
                  <strong>Therapist Response:</strong>
                  <div className="therapist-response-detail">{selectedRequestForView.therapist_response}</div>
                </div>
              )}
              {selectedRequestForView.status === 'cancelled' && selectedRequestForView.cancellation_reason && (
                <div className="detail-row">
                  <strong>Cancellation Reason:</strong>
                  <div className="cancellation-reason-detail">{selectedRequestForView.cancellation_reason}</div>
                </div>
              )}
              <div className="detail-row">
                <strong>Created:</strong> {selectedRequestForView.created_at ? new Date(selectedRequestForView.created_at).toLocaleString() : 'N/A'}
              </div>
              {selectedRequestForView.responded_at && (
                <div className="detail-row">
                  <strong>Responded:</strong> {new Date(selectedRequestForView.responded_at).toLocaleString()}
                </div>
              )}
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowViewModal(false);
                  setSelectedRequestForView(null);
                }}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Appointment Modal */}
      {showCancelModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Cancel Appointment</h3>
            <p>Are you sure you want to cancel this appointment with {selectedRequestForCancel?.client_name}?</p>
            <div className="form-group">
              <label htmlFor="cancellation-reason">Cancellation Reason:</label>
              <textarea
                id="cancellation-reason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Please provide a reason for cancellation..."
                rows="3"
                required
              />
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => {
                  setShowCancelModal(false);
                  setSelectedRequestForCancel(null);
                  setCancellationReason('');
                }}
                className="btn btn-secondary"
              >
                Keep Appointment
              </button>
              <button 
                onClick={handleCancelAppointment}
                className="btn btn-danger"
                disabled={!cancellationReason.trim()}
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

export default RecentRequests;
