import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import UserList from './UserList';
import UserActions from './UserActions';
import './AdminPanel.css';

// Get API URL from environment variables (REQUIRED)
const API_URL = import.meta.env.VITE_API_URL;
if (!API_URL) {
  throw new Error('VITE_API_URL environment variable is required. Please check your .env file.');
}

const AdminPanel = () => {
  const { user, isAdmin, signOut } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  


  // Fetch users on component mount
  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('AdminPanel: Received users data:', data);
        setUsers(data.users || []);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('AdminPanel: Failed to fetch users:', response.status, errorData);
        throw new Error(`Failed to fetch users: ${response.status} - ${errorData.detail || 'Unknown error'}`);
      }
    } catch (err) {
      setError('Failed to load users: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUserAction = async (action, firebaseUid) => {
    try {
      setError('');
      setSuccess('');
      
      const token = await user.getIdToken();
      const response = await fetch(`${API_URL}/admin/users/${firebaseUid}/${action}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(`${action} successful: ${data.message}`);
        // Refresh user list
        fetchUsers();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Action failed');
      }
    } catch (err) {
      setError(`Failed to ${action}: ` + err.message);
    }
  };

  const showMessage = (type, message) => {
    if (type === 'success') {
      setSuccess(message);
      setError('');
    } else {
      setError(message);
      setSuccess('');
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      if (type === 'success') {
        setSuccess('');
      } else {
        setError('');
      }
    }, 5000);
  };

  const handleDeleteUser = async (userId, userName) => {
    try {
      setError('');
      setSuccess('');
      
      // First get the deletion impact
      const token = await user.getIdToken();
      const impactResponse = await fetch(`${API_URL}/admin/users/${userId}/impact`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!impactResponse.ok) {
        const errorData = await impactResponse.json();
        throw new Error(errorData.detail || 'Failed to get deletion impact');
      }

      const impactData = await impactResponse.json();
      
      // Show confirmation dialog with impact details
      const confirmed = window.confirm(
        `Are you sure you want to delete ${userName}?\n\n${impactData.impact_message}\n\nThis action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      // Proceed with deletion
      const deleteResponse = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (deleteResponse.ok) {
        const data = await deleteResponse.json();
        setSuccess(`User deleted successfully: ${data.impact_message}`);
        // Refresh user list
        fetchUsers();
      } else {
        const errorData = await deleteResponse.json();
        throw new Error(errorData.detail || 'Deletion failed');
      }
    } catch (err) {
      setError(`Failed to delete user: ` + err.message);
    }
  };



  if (!isAdmin) {
    return (
      <div className="admin-panel">
        <div className="admin-error">
          <h2>🚫 Access Denied</h2>
          <p>You don't have admin privileges to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-panel" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000, overflow: 'auto', backgroundColor: '#F8F9FA', padding: '24px 0' }}>
      <div className="dashboard-container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
        <div className="dashboard-header" style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', marginBottom: '32px', padding: '32px', textAlign: 'center', position: 'relative' }}>
          <button 
            onClick={async () => {
              try {
                await signOut();
              } catch (error) {
                console.error('Sign-out error:', error);
              }
            }}
            style={{ 
              position: 'absolute', 
              top: '20px', 
              right: '20px', 
              padding: '8px 16px', 
              backgroundColor: '#FF6B6B', 
              color: 'white', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M17 7L15.59 8.41L18.17 11H8V13H18.17L15.59 15.59L17 17L22 12L17 7ZM4 5H12V3H4C2.9 3 2 3.9 2 5V19C2 20.1 2.9 21 4 21H12V19H4V5Z" fill="currentColor"/>
            </svg>
            Sign Out
          </button>
          <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#343A40', margin: '0 0 8px 0' }}>Admin Panel</h1>
          <p style={{ fontSize: '18px', color: '#6C757D', margin: '0' }}>System administration and user management</p>
        </div>
        
        <div className="dashboard-stats">
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total Users</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">{users.filter(u => u.role === 'therapist').length}</div>
            <div className="stat-label">Therapists</div>
          </div>
          
          <div className="stat-card">
            <div className="stat-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
            </div>
            <div className="stat-value">{users.filter(u => u.role === 'client').length}</div>
            <div className="stat-label">Clients</div>
          </div>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card">
            <h2>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
              User Management
            </h2>
            {(!loading && !error) && (
              <div className="user-summary" style={{ marginBottom: '12px', color: 'var(--gray)' }}>
                Total users: {users.length}
              </div>
            )}

            {loading ? (
              <div className="loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#6C757D', fontSize: '18px' }}>
                <div className="spinner" style={{ width: '48px', height: '48px', border: '4px solid #F8F9FA', borderTop: '4px solid #20B2AA', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }}></div>
                <p>Loading users...</p>
              </div>
            ) : error ? (
              <div className="error">
                <p>{error}</p>
                <button className="btn btn-primary" onClick={fetchUsers}>
                  Retry
                </button>
              </div>
            ) : (
              <UserList users={users} onUserAction={handleUserAction} onDeleteUser={handleDeleteUser} currentUserUid={user?.uid} />
            )}
          </div>
          
        </div>
        
        {success && (
          <div className="success-message">
            {success}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
