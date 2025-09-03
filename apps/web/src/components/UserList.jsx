import React from 'react';
import UserActions from './UserActions';
import './UserList.css';

const UserList = ({ users, onUserAction, onDeleteUser, currentUserUid }) => {
  // Safety check - ensure users is always an array
  const safeUsers = users || [];
  
  if (safeUsers.length === 0) {
    return (
      <div className="user-list-empty">
        <p>No users found.</p>
      </div>
    );
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getStatusBadge = (disabled, isAdmin) => {
    if (disabled) {
      return <span className="status-badge disabled">🚫 Disabled</span>;
    }
    if (isAdmin) {
      return <span className="status-badge admin">👑 Admin</span>;
    }
    return <span className="status-badge active">✅ Active</span>;
  };

  return (
    <div className="user-list">
      <div className="user-list-header">
        <div className="user-count">
          Total Users: {safeUsers.length}
        </div>
      </div>
      
      <div className="user-table-container">
        <table className="user-table">
          <thead>
            <tr>
              <th>👤 User</th>
              <th>📧 Email</th>
              <th>📅 Created</th>
              <th>🏷️ Status</th>
              <th>🔧 Actions</th>
            </tr>
          </thead>
          <tbody>
            {safeUsers.map((user) => (
              <tr key={user.id} className="user-row">
                <td className="user-info">
                  <div className="user-name">{user.name || 'No Name'}</div>
                  <div className="user-id">ID: {user.id}</div>
                </td>
                <td className="user-email">{user.email}</td>
                <td className="user-created">
                  {formatDate(user.created_at)}
                </td>
                <td className="user-status">
                  {getStatusBadge(user.status !== 'active', user.role === 'admin')}
                </td>
                <td className="user-actions">
                  <UserActions
                    user={user}
                    onUserAction={onUserAction}
                    onDeleteUser={onDeleteUser}
                    currentUserUid={currentUserUid}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserList;
