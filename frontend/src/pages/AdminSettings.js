import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const SETTING_LABELS = {
  show_label_generator: {
    label: 'Label Generator',
    description: 'Show the Label Generator page in the sidebar navigation.',
    icon: 'bi-tags',
  },
  show_xml_generator: {
    label: 'XML Generator',
    description: 'Show the XML Generator page in the sidebar navigation.',
    icon: 'bi-file-earmark-code',
  },
};

const AdminSettings = () => {
  const { withAdminAuth } = useAdminAuth();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/app_settings.php`, { withCredentials: true });
      if (res.data.success) {
        setSettings(res.data.settings);
      } else {
        setError('Failed to load settings');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key, currentValue) => {
    const newValue = currentValue === '1' ? '0' : '1';
    setError(null);
    setSuccess(null);

    try {
      await withAdminAuth(`change ${SETTING_LABELS[key]?.label ?? key} visibility`, async (adminCode) => {
        setSaving(key);
        const res = await axios.post(
          `${API_BASE_URL}/app_settings.php`,
          { admin_code: adminCode, key, value: newValue },
          { withCredentials: true }
        );
        if (!res.data.success) {
          throw new Error(res.data.message || 'Save failed');
        }
        setSettings((prev) => ({ ...prev, [key]: newValue }));
        setSuccess(`${SETTING_LABELS[key]?.label ?? key} is now ${newValue === '1' ? 'visible' : 'hidden'}.`);

        // Notify other components (Sidebar) to refresh settings
        window.dispatchEvent(new Event('app-settings-changed'));
      });
    } catch (err) {
      if (err.message !== 'Admin verification cancelled') {
        setError(err.response?.data?.message || err.message || 'Failed to save setting');
      }
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: 200 }}>
        <div className="spinner-border text-primary" />
      </div>
    );
  }

  return (
    <div className="container-fluid px-0">
      <div className="d-flex align-items-center gap-2 mb-4">
        <i className="bi bi-gear-fill fs-4 text-primary"></i>
        <h4 className="mb-0">Admin Settings</h4>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible" role="alert">
          {success}
          <button type="button" className="btn-close" onClick={() => setSuccess(null)} />
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h6 className="mb-0">
            <i className="bi bi-layout-sidebar me-2"></i>
            Sidebar Visibility
          </h6>
        </div>
        <div className="card-body p-0">
          {Object.keys(SETTING_LABELS).map((key, idx, arr) => {
            const meta = SETTING_LABELS[key];
            const isOn = settings[key] === '1';
            const isSaving = saving === key;
            return (
              <div
                key={key}
                className={`d-flex align-items-center justify-content-between px-4 py-3 ${idx < arr.length - 1 ? 'border-bottom' : ''}`}
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
                      id={`toggle-${key}`}
                      checked={isOn}
                      disabled={isSaving}
                      onChange={() => handleToggle(key, settings[key])}
                      style={{ width: '2.5rem', height: '1.25rem', cursor: 'pointer' }}
                    />
                  </div>
                  {isSaving && <span className="spinner-border spinner-border-sm text-primary" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-muted small mt-3">
        <i className="bi bi-shield-lock me-1"></i>
        Changes require the admin code. Visibility takes effect immediately after saving.
      </p>
    </div>
  );
};

export default AdminSettings;
