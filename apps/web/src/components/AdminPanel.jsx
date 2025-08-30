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
  const { user, isAdmin } = useAuth();
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
        setUsers(data.users);
      } else {
        throw new Error('Failed to fetch users');
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
    <div className="admin-panel">
      <div className="admin-header">
        <h1>🔐 TheraVillage Admin Panel</h1>
        <p>Welcome, {user.displayName || user.email} (Admin)</p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="admin-message error">
          <span>❌ {error}</span>
        </div>
      )}
      {success && (
        <div className="admin-message success">
          <span>✅ {success}</span>
        </div>
      )}

      {/* User Management Section */}
      <div className="admin-section">
        <div className="section-header">
          <h2>👥 User Management</h2>
          <button 
            className="refresh-btn"
            onClick={fetchUsers}
            disabled={loading}
          >
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading users...</div>
        ) : (
          <UserList 
            users={users} 
            onUserAction={handleUserAction}
            currentUserUid={user.uid}
          />
        )}
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <h2>⚡ Quick Actions</h2>
        <div className="quick-actions">
          <button 
            className="action-btn primary"
            onClick={() => fetchUsers()}
          >
            🔄 Refresh Users
          </button>
          <button 
            className="action-btn secondary"
            onClick={() => window.location.href = '/'}
          >
            🏠 Back to Main App
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
