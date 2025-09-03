import React, { useState } from 'react';
import './UserActions.css';

const UserActions = ({ user, onUserAction, onDeleteUser, currentUserUid }) => {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState('');

  const handleAction = async (action) => {
    if (showConfirm === action) {
      // User confirmed the action
      setLoading(true);
      try {
        await onUserAction(action, user.firebase_uid);
        setShowConfirm('');
      } finally {
        setLoading(false);
      }
    } else {
      // Show confirmation first
      setShowConfirm(action);
    }
  };

  const handleDelete = async () => {
    if (showConfirm === 'delete') {
      // User confirmed the deletion
      setLoading(true);
      try {
        await onDeleteUser(user.id, user.name);
        setShowConfirm('');
      } finally {
        setLoading(false);
      }
    } else {
      // Show confirmation first
      setShowConfirm('delete');
    }
  };

  const cancelAction = () => {
    setShowConfirm('');
  };

  const getActionButton = (action, label, icon, variant = 'secondary') => {
    const isCurrentUser = user.id === currentUserUid;
    const isDisabled = loading || (action === 'demote' && isCurrentUser);
    
    return (
      <button
        key={action}
        className={`action-btn ${variant} ${isDisabled ? 'disabled' : ''}`}
        onClick={() => handleAction(action)}
        disabled={isDisabled}
        title={isCurrentUser && action === 'demote' ? "You cannot demote yourself" : ""}
      >
        {icon} {label}
      </button>
    );
  };

  const getConfirmButton = (action, label, icon, variant = 'danger') => {
    if (showConfirm !== action) return null;
    
    return (
      <div key={`confirm-${action}`} className="confirm-actions">
        <span className="confirm-text">Confirm {action}?</span>
        <button
          className={`action-btn ${variant}`}
          onClick={() => handleAction(action)}
          disabled={loading}
        >
          {icon} Yes, {label}
        </button>
        <button
          className="action-btn secondary"
          onClick={cancelAction}
          disabled={loading}
        >
          ❌ Cancel
        </button>
      </div>
    );
  };

  return (
    <div className="user-actions">
      {/* Regular Action Buttons */}
      {!showConfirm && (
        <div className="action-buttons">
          {/* Promote to Admin */}
          {user.role !== 'admin' && (
            getActionButton('promote', 'Promote', '👑', 'primary')
          )}
          
          {/* Demote from Admin */}
          {user.role === 'admin' && (
            getActionButton('demote', 'Demote', '👤', 'warning')
          )}
          
          {/* Revoke User */}
          {user.status === 'active' && (
            getActionButton('revoke', 'Revoke', '🚫', 'danger')
          )}
          
          {/* Enable User */}
          {user.status !== 'active' && (
            getActionButton('enable', 'Enable', '✅', 'success')
          )}
          
          {/* Delete User */}
          <button
            className="action-btn danger"
            onClick={handleDelete}
            disabled={loading}
            title="Delete user and all related data"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Confirmation Buttons */}
      {showConfirm === 'promote' && (
        getConfirmButton('promote', 'Promote to Admin', '👑', 'primary')
      )}
      
      {showConfirm === 'demote' && (
        getConfirmButton('demote', 'Demote from Admin', '👤', 'warning')
      )}
      
      {showConfirm === 'revoke' && (
        getConfirmButton('revoke', 'Revoke Access', '🚫', 'danger')
      )}
      
      {showConfirm === 'enable' && (
        getConfirmButton('enable', 'Enable Access', '✅', 'success')
      )}
      
      {showConfirm === 'delete' && (
        <div className="confirm-actions">
          <span className="confirm-text">Confirm delete?</span>
          <button
            className="action-btn danger"
            onClick={handleDelete}
            disabled={loading}
          >
            🗑️ Yes, Delete
          </button>
          <button
            className="action-btn secondary"
            onClick={cancelAction}
            disabled={loading}
          >
            ❌ Cancel
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="action-loading">
          <span>🔄 Processing...</span>
        </div>
      )}
    </div>
  );
};

export default UserActions;
