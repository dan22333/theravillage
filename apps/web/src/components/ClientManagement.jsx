import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './ClientManagement.css';

const ClientManagement = () => {
  const { user, token } = useAuth();
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    address: {
      street: '',
      city: '',
      state: '',
      zip: ''
    },
    school: '',
    diagnosis_codes: [],
    payer_id: '',
    auth_lims: {
      visits_remaining: '',
      visits_used: '',
      expires_date: ''
    },
    goals: []
  });

  useEffect(() => {
    if (user && token) {
      fetchClients();
    }
  }, [user, token]);

  const fetchClients = async () => {
    try {
      setIsLoading(true);
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
        throw new Error('Failed to fetch clients');
      }
    } catch (err) {
      setError('Failed to fetch clients');
      console.error('Error fetching clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
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
        [field]: value
      }));
    }
  };

  const handleArrayInput = (field, value, action = 'add') => {
    if (action === 'add') {
      setFormData(prev => ({
        ...prev,
        [field]: [...prev[field], value]
      }));
    } else if (action === 'remove') {
      setFormData(prev => ({
        ...prev,
        [field]: prev[field].filter(item => item !== value)
      }));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      dob: '',
      address: {
        street: '',
        city: '',
        state: '',
        zip: ''
      },
      school: '',
      diagnosis_codes: [],
      payer_id: '',
      auth_lims: {
        visits_remaining: '',
        visits_used: '',
        expires_date: ''
      },
      goals: []
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const result = await response.json();
        alert('Client created successfully!');
        setShowAddForm(false);
        resetForm();
        fetchClients(); // Refresh the list
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create client');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error creating client:', err);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      dob: client.dob ? new Date(client.dob).toISOString().split('T')[0] : '',
      address: client.address || { street: '', city: '', state: '', zip: '' },
      school: client.school || '',
      diagnosis_codes: client.diagnosis_codes || [],
      payer_id: client.payer_id || '',
      auth_lims: client.auth_lims_json || { visits_remaining: '', visits_used: '', expires_date: '' },
      goals: client.goals_json || []
    });
    setShowAddForm(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients/${editingClient.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        alert('Client updated successfully!');
        setShowAddForm(false);
        setEditingClient(null);
        resetForm();
        fetchClients();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update client');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error updating client:', err);
    }
  };

  const handleDelete = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this client? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/therapist/clients/${clientId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        alert('Client deleted successfully!');
        fetchClients();
      } else {
        throw new Error('Failed to delete client');
      }
    } catch (err) {
      setError('Failed to delete client');
      console.error('Error deleting client:', err);
    }
  };

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         client.school?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || client.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return <div className="loading">Loading clients...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  return (
    <div className="client-management">
      <header className="page-header">
        <h1>Client Management</h1>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setShowAddForm(true);
            setEditingClient(null);
            resetForm();
          }}
        >
          + Add New Client
        </button>
      </header>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search clients by name or school..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="filter-controls">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="discharged">Discharged</option>
          </select>
        </div>
      </div>

      {/* Client List */}
      <div className="clients-container">
        {filteredClients.length > 0 ? (
          <div className="clients-grid">
            {filteredClients.map(client => (
              <div key={client.id} className="client-card">
                <div className="client-header">
                  <div className="client-avatar">
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-info">
                    <h3>{client.name}</h3>
                    <p className="client-age">
                      {client.dob ? `${new Date().getFullYear() - new Date(client.dob).getFullYear()} years` : 'Age N/A'}
                    </p>
                    <p className="client-school">{client.school || 'School N/A'}</p>
                  </div>
                  <div className="client-status">
                    <span className={`status-badge ${client.status}`}>
                      {client.status}
                    </span>
                  </div>
                </div>
                
                <div className="client-details">
                  {client.diagnosis_codes && client.diagnosis_codes.length > 0 && (
                    <div className="diagnosis-codes">
                      <strong>Diagnosis:</strong>
                      <div className="tags">
                        {client.diagnosis_codes.map((code, index) => (
                          <span key={index} className="tag">{code}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {client.goals_json && client.goals_json.length > 0 && (
                    <div className="goals">
                      <strong>Goals:</strong>
                      <div className="tags">
                        {client.goals_json.map((goal, index) => (
                          <span key={index} className="tag goal-tag">{goal}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="client-actions">
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => handleEdit(client)}
                  >
                    Edit
                  </button>
                  <button 
                    className="btn btn-outline btn-sm"
                    onClick={() => {/* Navigate to client profile */}}
                  >
                    View Profile
                  </button>
                  <button 
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(client.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-clients">
            <p>No clients found matching your criteria.</p>
            {!showAddForm && (
              <button 
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
              >
                Add Your First Client
              </button>
            )}
          </div>
        )}
      </div>

      {/* Add/Edit Client Modal */}
      {showAddForm && (
        <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingClient ? 'Edit Client' : 'Add New Client'}</h2>
              <button className="modal-close" onClick={() => setShowAddForm(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={editingClient ? handleUpdate : handleSubmit}>
                <div className="form-section">
                  <h3>Basic Information</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Full Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        required
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Date of Birth</label>
                      <input
                        type="date"
                        value={formData.dob}
                        onChange={(e) => handleInputChange('dob', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>School</label>
                    <input
                      type="text"
                      value={formData.school}
                      onChange={(e) => handleInputChange('school', e.target.value)}
                      className="form-input"
                      placeholder="School name"
                    />
                  </div>
                </div>

                <div className="form-section">
                  <h3>Address</h3>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Street Address</label>
                      <input
                        type="text"
                        value={formData.address.street}
                        onChange={(e) => handleInputChange('address.street', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>City</label>
                      <input
                        type="text"
                        value={formData.address.city}
                        onChange={(e) => handleInputChange('address.city', e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>State</label>
                      <input
                        type="text"
                        value={formData.address.state}
                        onChange={(e) => handleInputChange('address.state', e.target.value)}
                        className="form-input"
                        maxLength="2"
                      />
                    </div>
                    <div className="form-group">
                      <label>ZIP Code</label>
                      <input
                        type="text"
                        value={formData.address.zip}
                        onChange={(e) => handleInputChange('address.zip', e.target.value)}
                        className="form-input"
                        maxLength="10"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Clinical Information</h3>
                  <div className="form-group">
                    <label>Diagnosis Codes</label>
                    <div className="array-input">
                      <input
                        type="text"
                        placeholder="Add diagnosis code"
                        className="form-input"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.target.value.trim();
                            if (value) {
                              handleArrayInput('diagnosis_codes', value, 'add');
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <div className="tags">
                        {formData.diagnosis_codes.map((code, index) => (
                          <span key={index} className="tag">
                            {code}
                            <button
                              type="button"
                              onClick={() => handleArrayInput('diagnosis_codes', code, 'remove')}
                              className="tag-remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Goals</label>
                    <div className="array-input">
                      <input
                        type="text"
                        placeholder="Add therapy goal"
                        className="form-input"
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.target.value.trim();
                            if (value) {
                              handleArrayInput('goals', value, 'add');
                              e.target.value = '';
                            }
                          }
                        }}
                      />
                      <div className="tags">
                        {formData.goals.map((goal, index) => (
                          <span key={index} className="tag goal-tag">
                            {goal}
                            <button
                              type="button"
                              onClick={() => handleArrayInput('goals', goal, 'remove')}
                              className="tag-remove"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-section">
                  <h3>Insurance & Authorization</h3>
                  <div className="form-group">
                    <label>Payer ID</label>
                    <input
                      type="text"
                      value={formData.payer_id}
                      onChange={(e) => handleInputChange('payer_id', e.target.value)}
                      className="form-input"
                      placeholder="Insurance provider ID"
                    />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label>Visits Remaining</label>
                      <input
                        type="number"
                        value={formData.auth_lims.visits_remaining}
                        onChange={(e) => handleInputChange('auth_lims.visits_remaining', e.target.value)}
                        className="form-input"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Visits Used</label>
                      <input
                        type="number"
                        value={formData.auth_lims.visits_used}
                        onChange={(e) => handleInputChange('auth_lims.visits_used', e.target.value)}
                        className="form-input"
                        min="0"
                      />
                    </div>
                    <div className="form-group">
                      <label>Authorization Expires</label>
                      <input
                        type="date"
                        value={formData.auth_lims.expires_date}
                        onChange={(e) => handleInputChange('auth_lims.expires_date', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="form-actions">
                  <button type="button" className="btn btn-outline" onClick={() => setShowAddForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingClient ? 'Update Client' : 'Create Client'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientManagement;
