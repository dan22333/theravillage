import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './RecentRequests.css';

const RecentRequests = () => {
  const { getToken } = useAuth();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

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

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'approved':
        return { text: 'Approved ✅', className: 'approved' };
      case 'declined':
        return { text: 'Declined ❌', className: 'declined' };
      case 'cancelled':
        return { text: 'Cancelled ❌', className: 'cancelled' };
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
              const statusInfo = getStatusDisplay(request.status);
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
    </div>
  );
};

export default RecentRequests;
