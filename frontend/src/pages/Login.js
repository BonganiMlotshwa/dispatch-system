import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../services/authService';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: '#ffffff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-12 col-md-10 col-lg-8">
            <div className="modern-card" style={{ boxShadow: '0 20px 60px rgba(0,0,0,.35)', border: '1px solid rgba(255,255,255,.06)' }}>
              <div className="row g-0">
                <div className="col-12 col-lg-6 p-4 d-flex flex-column justify-content-center" style={{ background: 'linear-gradient(140deg, #1e40af, #3b82f6)' }}>
                  <div className="mb-3">
                    <span className="badge rounded-pill px-3 py-2" style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#ffffff' }}>
                      <i className="bi bi-stars me-1"></i>
                      Welcome
                    </span>
                  </div>
                  <h2 className="mb-2" style={{ color: '#ffffff', fontSize: '1.75rem', fontWeight: '600' }}>
                    FTM Garments Warehouse Carton Tracking System
                  </h2>
                  <p className="mb-4" style={{ color: '#e0e7ff', fontSize: '1.1rem' }}>
                    Modern, fast, and precise scanning for cartons, with real‑time PO validation and analytics.
                  </p>
                  <div className="d-flex align-items-center gap-3 mb-2" style={{ fontSize: '2rem' }}>
                    <i className="bi bi-upc-scan" style={{ color: '#ffffff' }}></i>
                    <i className="bi bi-qr-code-scan" style={{ color: '#ffffff' }}></i>
                    <i className="bi bi-box-seam" style={{ color: '#ffffff' }}></i>
                    <i className="bi bi-graph-up" style={{ color: '#ffffff' }}></i>
                  </div>
                  <small style={{ color: '#cbd5e1' }}>Secure access required. Please sign in to continue.</small>
                </div>
                <div className="col-12 col-lg-6 p-4" style={{ backgroundColor: '#ffffff' }}>
                  <div className="mb-3">
                    <h5 className="mb-1" style={{ color: '#1f2937' }}>Sign in</h5>
                    <div className="text-muted small">Use your admin credentials to access the dashboard</div>
                  </div>
                  <form onSubmit={onSubmit}>
                    <div className="mb-3">
                      <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>Username or Email</label>
                      <div className="position-relative">
                        <i className="bi bi-person position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}></i>
                        <input
                          type="text"
                          className="form-control ps-5"
                          style={{ 
                            backgroundColor: '#f9fafb',
                            border: '1px solid #d1d5db',
                            color: '#111827',
                            padding: '0.75rem 1rem 0.75rem 2.5rem'
                          }}
                          placeholder="admin@ftmgarments.com"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          autoComplete="username"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="mb-3">
                      <label className="form-label" style={{ color: '#374151', fontWeight: '500' }}>Password</label>
                      <div className="position-relative">
                        <i className="bi bi-shield-lock position-absolute" style={{ left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#6b7280' }}></i>
                        <input
                          type="password"
                          className="form-control ps-5"
                          style={{ 
                            backgroundColor: '#f9fafb',
                            border: '1px solid #d1d5db',
                            color: '#111827',
                            padding: '0.75rem 1rem 0.75rem 2.5rem'
                          }}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete="current-password"
                        />
                      </div>
                    </div>
                    {error && (
                      <div className="alert alert-danger mb-3">
                        <i className="bi bi-exclamation-triangle me-2"></i>{error}
                      </div>
                    )}
                    <div className="d-grid gap-2">
                      <button 
                        className="btn btn-primary py-2" 
                        type="submit" 
                        disabled={loading || !username || !password}
                        style={{ fontSize: '1rem', fontWeight: '500' }}
                      >
                        {loading ? <><span className="spinner-border spinner-border-sm me-2"></span>Signing in...</> : <><i className="bi bi-box-arrow-in-right me-2"></i>Sign in</>}
                      </button>
                    </div>
                    <div className="text-center text-muted small mt-3">
                      <i className="bi bi-lock-fill me-1"></i> Your session is protected with secure cookies
                    </div>
                  </form>
                </div>
              </div>
            </div>
            <div className="text-center text-muted small mt-3">
              &copy; {new Date().getFullYear()} FTM Garments. All rights reserved.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


