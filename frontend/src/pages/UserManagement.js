import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { getUser } from '../services/authService';

const FEATURE_SETTINGS = [
  { key: 'show_label_generator', label: 'Label Generator', icon: 'bi-tags', description: 'Show the Label Generator page in the sidebar.' },
  { key: 'show_xml_generator',   label: 'XML Generator',   icon: 'bi-file-earmark-code', description: 'Show the XML Generator page in the sidebar.' },
];

const UserManagement = () => {
  const navigate = useNavigate();
  const { withAdminAuth } = useAdminAuth();

  const currentUser = getUser();
  const isAdmin = currentUser?.role === 'admin';

  const [activeTab, setActiveTab] = useState('users');

  const [users, setUsers] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [appSettings, setAppSettings] = useState({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSetting, setSavingSetting] = useState(null);
  const [supportEmailInput, setSupportEmailInput] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    email: '',
    role: 'user',
    is_active: 1
  });

  useEffect(() => {
    loadUsers();
    loadAppSettings();
  }, []);

  const loadAppSettings = async () => {
    try {
      setSettingsLoading(true);
      const res = await axios.get(`${API_BASE_URL}/app_settings.php`, { withCredentials: true });
      if (res.data.success) {
        setAppSettings(res.data.settings);
        setSupportEmailInput(res.data.settings.support_email || '');
      }
    } catch (_) {
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleToggleSetting = async (key, currentValue) => {
    const newValue = currentValue === '1' ? '0' : '1';
    const meta = FEATURE_SETTINGS.find((s) => s.key === key);
    try {
      await withAdminAuth(`change ${meta?.label ?? key} visibility`, async (adminCode) => {
        setSavingSetting(key);
        const res = await axios.post(
          `${API_BASE_URL}/app_settings.php`,
          { admin_code: adminCode, key, value: newValue },
          { withCredentials: true }
        );
        if (!res.data.success) throw new Error(res.data.message || 'Save failed');
        setAppSettings((prev) => ({ ...prev, [key]: newValue }));
        setSuccess(`${meta?.label ?? key} is now ${newValue === '1' ? 'visible' : 'hidden'} in the sidebar.`);
        window.dispatchEvent(new Event('app-settings-changed'));
      });
    } catch (err) {
      if (err.message !== 'Admin verification cancelled') {
        setError(err.response?.data?.message || err.message || 'Failed to save setting');
      }
    } finally {
      setSavingSetting(null);
    }
  };

  const handleSaveEmail = async () => {
    const email = supportEmailInput.trim();
    if (!email) return;
    try {
      await withAdminAuth('update support email', async (adminCode) => {
        setSavingSetting('support_email');
        const res = await axios.post(
          `${API_BASE_URL}/app_settings.php`,
          { admin_code: adminCode, key: 'support_email', value: email },
          { withCredentials: true }
        );
        if (!res.data.success) throw new Error(res.data.message || 'Save failed');
        setAppSettings((prev) => ({ ...prev, support_email: email }));
        setSuccess('Support email updated.');
        window.dispatchEvent(new Event('app-settings-changed'));
      });
    } catch (err) {
      if (err.message !== 'Admin verification cancelled') {
        setError(err.response?.data?.message || err.message || 'Failed to save');
      }
    } finally {
      setSavingSetting(null);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/user_management.php?action=list`, {
        withCredentials: true
      });
      if (res.data.success) {
        setUsers(res.data.users);
        setCurrentUserId(res.data.current_user_id);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLog = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/user_management.php?action=audit_log&limit=50`, {
        withCredentials: true
      });
      if (res.data.success) {
        setAuditLog(res.data.audit_log);
        setShowAuditLog(true);
      }
    } catch (err) {
      setError('Failed to load audit log');
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      const res = await axios.post(`${API_BASE_URL}/user_management.php?action=create`, {
        username: formData.username,
        password: formData.password,
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active
      }, {
        withCredentials: true
      });
      
      if (res.data.success) {
        setSuccess(res.data.message);
        setShowAddModal(false);
        resetForm();
        loadUsers();
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    
    try {
      const res = await axios.put(`${API_BASE_URL}/user_management.php?action=update`, {
        user_id: editingUser.id,
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        is_active: formData.is_active
      }, {
        withCredentials: true
      });
      
      if (res.data.success) {
        setSuccess(res.data.message);
        setShowEditModal(false);
        setEditingUser(null);
        resetForm();
        loadUsers();
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    try {
      const res = await axios.put(`${API_BASE_URL}/user_management.php?action=reset_password`, {
        user_id: editingUser.id,
        new_password: formData.password
      }, {
        withCredentials: true
      });
      
      if (res.data.success) {
        setSuccess(res.data.message);
        setShowPasswordModal(false);
        setEditingUser(null);
        resetForm();
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
    }
  };

  const handleDeleteUser = async (user) => {
    await withAdminAuth(`delete user "${user.username}"`, async (adminCode) => {
      const res = await axios.delete(`${API_BASE_URL}/user_management.php?action=delete&user_id=${user.id}`, {
        withCredentials: true,
        data: { admin_code: adminCode }
      });
      if (res.data.success) {
        setSuccess(res.data.message);
        loadUsers();
      } else {
        setError(res.data.message);
      }
    });
  };

  const handleToggleActive = async (user) => {
    const newStatus = user.is_active === '1' || user.is_active === 1 ? 0 : 1;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!window.confirm(`Are you sure you want to ${action} user "${user.username}"?`)) {
      return;
    }
    
    try {
      const res = await axios.put(`${API_BASE_URL}/user_management.php?action=update`, {
        user_id: user.id,
        is_active: newStatus
      }, {
        withCredentials: true
      });
      
      if (res.data.success) {
        setSuccess(res.data.message);
        loadUsers();
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const openEditModal = (user) => {
    setEditingUser(user);
    setFormData({
      ...formData,
      full_name: user.full_name || '',
      email: user.email || '',
      role: user.role,
      is_active: user.is_active
    });
    setShowEditModal(true);
  };

  const openPasswordModal = (user) => {
    setEditingUser(user);
    setFormData({ ...formData, password: '', confirmPassword: '' });
    setShowPasswordModal(true);
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      confirmPassword: '',
      full_name: '',
      email: '',
      role: 'user',
      is_active: 1
    });
  };

  const closeModals = () => {
    setShowAddModal(false);
    setShowEditModal(false);
    setShowPasswordModal(false);
    setEditingUser(null);
    resetForm();
    setError(null);
  };

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const getRoleBadge = (role) => {
    const badges = {
      admin: 'bg-danger',
      user: 'bg-primary',
      viewer: 'bg-secondary'
    };
    return badges[role] || 'bg-secondary';
  };

  if (loading) {
    return (
      <div className="py-4 text-center">
        <div className="spinner-border"></div>
        <p className="mt-2">Loading users...</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      <button className="btn btn-sm btn-outline-secondary mb-3" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1"></i> Back
      </button>
      <div className="mb-3">
        <h1 className="text-gradient mb-0">Settings</h1>
        <p className="text-muted mb-0">Users and system configuration</p>
      </div>

      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people me-2"></i>Users
          </button>
        </li>
        {isAdmin && (
          <li className="nav-item">
            <button
              className={`nav-link ${activeTab === 'app-settings' ? 'active' : ''}`}
              onClick={() => setActiveTab('app-settings')}
            >
              <i className="bi bi-toggles me-2"></i>App Settings
            </button>
          </li>
        )}
      </ul>

      {error && (
        <div className="alert alert-danger alert-dismissible">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)}></button>
        </div>
      )}

      {success && (
        <div className="alert alert-success alert-dismissible">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess(null)}></button>
        </div>
      )}

      {activeTab === 'app-settings' && (
        <div className="modern-card">
          <div className="modern-card-header">
            <h5 className="mb-0">
              <i className="bi bi-layout-sidebar me-2"></i>
              Sidebar Visibility
            </h5>
          </div>
          <div className="modern-card-body p-0">
            {settingsLoading ? (
              <div className="text-center py-4"><div className="spinner-border spinner-border-sm" /></div>
            ) : (
              FEATURE_SETTINGS.map((meta, idx) => {
                const isOn = appSettings[meta.key] === '1';
                return (
                  <div
                    key={meta.key}
                    className={`d-flex align-items-center justify-content-between px-4 py-3 ${idx < FEATURE_SETTINGS.length - 1 ? 'border-bottom' : ''}`}
                  >
                    <div className="d-flex align-items-center gap-3">
                      <i className={`bi ${meta.icon} fs-5 text-secondary`}></i>
                      <div>
                        <div className="fw-semibold">{meta.label}</div>
                        <div className="text-muted small">{meta.description}</div>
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <span className={`badge ${isOn ? 'bg-success' : 'bg-secondary'}`}>
                        {isOn ? 'Visible' : 'Hidden'}
                      </span>
                      <div className="form-check form-switch mb-0">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          role="switch"
                          checked={isOn}
                          disabled={savingSetting === meta.key}
                          onChange={() => handleToggleSetting(meta.key, appSettings[meta.key])}
                          style={{ width: '2.5rem', height: '1.25rem', cursor: 'pointer' }}
                        />
                      </div>
                      {savingSetting === meta.key && <span className="spinner-border spinner-border-sm text-primary" />}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="modern-card-body border-top">
            <p className="text-muted small mb-0">
              <i className="bi bi-shield-lock me-1"></i>
              Changes require the admin code and take effect immediately in the sidebar.
            </p>
          </div>
        </div>

        <div className="modern-card mt-4">
          <div className="modern-card-header">
            <h5 className="mb-0">
              <i className="bi bi-envelope me-2"></i>
              Support Contact
            </h5>
          </div>
          <div className="modern-card-body">
            <p className="text-muted small mb-3">
              This email appears in the Help panel (? icon in the header) so users know who to contact.
            </p>
            <div className="d-flex align-items-center gap-2" style={{ maxWidth: '480px' }}>
              <div className="input-group">
                <span className="input-group-text"><i className="bi bi-envelope"></i></span>
                <input
                  type="email"
                  className="form-control"
                  value={supportEmailInput}
                  onChange={(e) => setSupportEmailInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEmail()}
                  placeholder="support@example.com"
                  disabled={savingSetting === 'support_email'}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={handleSaveEmail}
                disabled={savingSetting === 'support_email' || supportEmailInput.trim() === (appSettings.support_email || '')}
                style={{ whiteSpace: 'nowrap' }}
              >
                {savingSetting === 'support_email'
                  ? <span className="spinner-border spinner-border-sm" />
                  : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
      <div className="modern-card">
        <div className="modern-card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">
            <i className="bi bi-people me-2"></i>
            All Users ({users.length})
          </h5>
          {isAdmin && (
            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-outline-secondary" onClick={loadAuditLog}>
                <i className="bi bi-clock-history me-1"></i> Audit Log
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>
                <i className="bi bi-person-plus me-1"></i> Add User
              </button>
            </div>
          )}
        </div>
        <div className="modern-card-body p-0">
          <div className="table-responsive">
            <table className="table table-modern mb-0">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last Login</th>
                  <th>Created</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.username}</strong>
                      {user.id === currentUserId && (
                        <span className="badge bg-info ms-2">You</span>
                      )}
                    </td>
                    <td>{user.full_name || '—'}</td>
                    <td>{user.email || '—'}</td>
                    <td>
                      <span className={`badge ${getRoleBadge(user.role)}`}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      {(user.is_active === '1' || user.is_active === 1) ? (
                        <span className="badge bg-success">Active</span>
                      ) : (
                        <span className="badge bg-secondary">Inactive</span>
                      )}
                      {user.locked_until && new Date(user.locked_until) > new Date() && (
                        <span className="badge bg-warning text-dark ms-1">Locked</span>
                      )}
                    </td>
                    <td className="small text-muted">
                      {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                    </td>
                    <td className="small text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-end">
                      {isAdmin ? (
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => openEditModal(user)}
                            title="Edit user"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-outline-warning"
                            onClick={() => openPasswordModal(user)}
                            title="Reset password"
                          >
                            <i className="bi bi-key"></i>
                          </button>
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => handleToggleActive(user)}
                            disabled={user.id === currentUserId}
                            title={(user.is_active === '1' || user.is_active === 1) ? 'Deactivate' : 'Activate'}
                          >
                            <i className={`bi bi-${(user.is_active === '1' || user.is_active === 1) ? 'toggle-on' : 'toggle-off'}`}></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleDeleteUser(user)}
                            disabled={user.id === currentUserId}
                            title="Delete user"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      ) : (
                        <span className="text-muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-person-plus me-2"></i>
                  Add New User
                </h5>
                <button type="button" className="btn-close" onClick={closeModals}></button>
              </div>
              <form onSubmit={handleAddUser}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Username *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.username}
                      onChange={(e) => setFormData({...formData, username: e.target.value})}
                      required
                      minLength="3"
                      autoFocus
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      minLength="6"
                    />
                    <small className="text-muted">Minimum 6 characters</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Confirm Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      required
                    >
                      <option value="viewer">Viewer - Read only access</option>
                      <option value="user">User - Standard access</option>
                      <option value="admin">Admin - Full access</option>
                    </select>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="isActive"
                      checked={formData.is_active === 1}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked ? 1 : 0})}
                    />
                    <label className="form-check-label" htmlFor="isActive">
                      Active (user can log in)
                    </label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModals}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-check-lg me-2"></i>
                    Create User
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && editingUser && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-pencil me-2"></i>
                  Edit User: {editingUser.username}
                </h5>
                <button type="button" className="btn-close" onClick={closeModals}></button>
              </div>
              <form onSubmit={handleUpdateUser}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.full_name}
                      onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Role *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value})}
                      required
                      disabled={editingUser.id === currentUserId && formData.role === 'admin'}
                    >
                      <option value="viewer">Viewer - Read only access</option>
                      <option value="user">User - Standard access</option>
                      <option value="admin">Admin - Full access</option>
                    </select>
                    {editingUser.id === currentUserId && formData.role === 'admin' && (
                      <small className="text-muted">You cannot remove your own admin role</small>
                    )}
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="isActiveEdit"
                      checked={formData.is_active === '1' || formData.is_active === 1}
                      onChange={(e) => setFormData({...formData, is_active: e.target.checked ? 1 : 0})}
                      disabled={editingUser.id === currentUserId}
                    />
                    <label className="form-check-label" htmlFor="isActiveEdit">
                      Active (user can log in)
                    </label>
                    {editingUser.id === currentUserId && (
                      <div><small className="text-muted">You cannot deactivate your own account</small></div>
                    )}
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModals}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="bi bi-check-lg me-2"></i>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showPasswordModal && editingUser && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-key me-2"></i>
                  Reset Password: {editingUser.username}
                </h5>
                <button type="button" className="btn-close" onClick={closeModals}></button>
              </div>
              <form onSubmit={handleResetPassword}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.password}
                      onChange={(e) => setFormData({...formData, password: e.target.value})}
                      required
                      minLength="6"
                      autoFocus
                    />
                    <small className="text-muted">Minimum 6 characters</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Confirm New Password *</label>
                    <input
                      type="password"
                      className="form-control"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={closeModals}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-warning">
                    <i className="bi bi-key me-2"></i>
                    Reset Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Audit Log Modal */}
      {showAuditLog && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-xl modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="bi bi-clock-history me-2"></i>
                  User Audit Log (Last 50 Actions)
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAuditLog(false)}></button>
              </div>
              <div className="modal-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Action By</th>
                        <th>Action</th>
                        <th>Target User</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLog.map((log, idx) => (
                        <tr key={idx}>
                          <td className="small">{new Date(log.created_at).toLocaleString()}</td>
                          <td><strong>{log.action_by_username}</strong></td>
                          <td>
                            <span className={`badge ${
                              log.action_type === 'create' ? 'bg-success' :
                              log.action_type === 'delete' ? 'bg-danger' :
                              log.action_type === 'role_change' ? 'bg-warning text-dark' :
                              'bg-info'
                            }`}>
                              {log.action_type.replace('_', ' ')}
                            </span>
                          </td>
                          <td>{log.target_username || '—'}</td>
                          <td className="small">{log.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAuditLog(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
