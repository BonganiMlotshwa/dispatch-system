import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import ThemeToggle from './ThemeToggle';
import { logout } from '../services/authService';
import { API_BASE_URL } from '../config';

const ModernHeader = ({ toggleSidebar }) => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications
  const [showNotifications, setShowNotifications]   = useState(false);
  const [openTrucks, setOpenTrucks]                 = useState([]);
  const notifRef = useRef(null);

  // Help
  const [showHelp, setShowHelp]       = useState(false);
  const [supportEmail, setSupportEmail] = useState('ftmit@ftmswaziland.co');
  const helpRef = useRef(null);

  const fetchOpenTrucks = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/active_trucks.php`, { withCredentials: true });
      if (res.data.success) setOpenTrucks(res.data.trucks || []);
    } catch {}
  }, []);

  const fetchSupportEmail = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/app_settings.php`, { withCredentials: true });
      if (res.data.success && res.data.settings?.support_email) {
        setSupportEmail(res.data.settings.support_email);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchOpenTrucks();
    fetchSupportEmail();
    const interval = setInterval(fetchOpenTrucks, 30000);
    return () => clearInterval(interval);
  }, [fetchOpenTrucks, fetchSupportEmail]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (helpRef.current  && !helpRef.current.contains(e.target))  setShowHelp(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) console.log('Searching for:', searchQuery);
  };

  const notifCount = openTrucks.length;

  return (
    <div className="header-bar-modern">
      <div className="header-left">
        <button className="mobile-menu-toggle" onClick={toggleSidebar} aria-label="Toggle navigation menu">
          <i className="bi bi-list"></i>
        </button>
      </div>

      <div className="header-right">
        <form className="header-search" onSubmit={handleSearch}>
          <div className="header-search-icon"><i className="bi bi-search"></i></div>
          <input
            type="text"
            placeholder="Search shipments, POs, barcodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="header-actions">
          <ThemeToggle className="header-action-btn" />

          {/* ── Notifications bell ────────────────────────────────────── */}
          <div ref={notifRef} style={{ position: 'relative' }}>
            <button
              className="header-action-btn"
              title="Notifications"
              onClick={() => { setShowNotifications(v => !v); setShowHelp(false); }}
              style={{ position: 'relative' }}
            >
              <i className="bi bi-bell"></i>
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: '4px', right: '4px',
                  background: '#dc3545', color: '#fff',
                  borderRadius: '50%', fontSize: '10px', fontWeight: 700,
                  width: '16px', height: '16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: '320px', background: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #dee2e6)',
                borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 2000, overflow: 'hidden'
              }}>
                {/* Header */}
                <div style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border-color, #dee2e6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>
                    <i className="bi bi-bell-fill me-2 text-primary"></i>Notifications
                  </span>
                  {notifCount > 0 && (
                    <span className="badge bg-danger">{notifCount} open truck{notifCount !== 1 ? 's' : ''}</span>
                  )}
                </div>

                {/* Body */}
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {openTrucks.length === 0 ? (
                    <div style={{ padding: '24px 16px', textAlign: 'center', color: '#6c757d' }}>
                      <i className="bi bi-check-circle fs-2 d-block mb-2 text-success"></i>
                      <div style={{ fontSize: '13px' }}>No open trucks — all clear</div>
                    </div>
                  ) : (
                    openTrucks.map((truck, i) => (
                      <div
                        key={truck.id}
                        style={{
                          padding: '12px 16px',
                          borderBottom: i < openTrucks.length - 1 ? '1px solid var(--border-color, #f0f0f0)' : 'none',
                          cursor: 'pointer',
                          transition: 'background 0.15s'
                        }}
                        onClick={() => { navigate('/truck-summary'); setShowNotifications(false); }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--hover-bg, #f8f9fa)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px', height: '36px', borderRadius: '8px',
                            background: '#fff3cd', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            <i className="bi bi-truck" style={{ color: '#fd7e14', fontSize: '18px' }}></i>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{truck.truck_reg}</div>
                            <div style={{ fontSize: '12px', color: '#6c757d', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {truck.driver_name} · {truck.cartons_loaded} cartons loaded
                            </div>
                          </div>
                          <span className="badge bg-warning text-dark" style={{ fontSize: '10px', flexShrink: 0 }}>
                            Loading
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                <div style={{
                  padding: '10px 16px', borderTop: '1px solid var(--border-color, #dee2e6)',
                  textAlign: 'center'
                }}>
                  <button
                    className="btn btn-sm btn-outline-primary w-100"
                    onClick={() => { navigate('/truck-summary'); setShowNotifications(false); }}
                    style={{ fontSize: '12px' }}
                  >
                    View Truck Summary
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button className="header-action-btn" title="Admin Settings" onClick={() => navigate('/admin-settings')}>
            <i className="bi bi-gear"></i>
          </button>

          {/* ── Help ──────────────────────────────────────────────────── */}
          <div ref={helpRef} style={{ position: 'relative' }}>
            <button
              className="header-action-btn"
              title="Help"
              onClick={() => { setShowHelp(v => !v); setShowNotifications(false); }}
            >
              <i className="bi bi-question-circle"></i>
            </button>

            {showHelp && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                width: '340px', background: 'var(--card-bg, #fff)',
                border: '1px solid var(--border-color, #dee2e6)',
                borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                zIndex: 2000, overflow: 'hidden'
              }}>
                {/* Brand strip */}
                <div style={{
                  background: 'linear-gradient(135deg, #0d6efd 0%, #0a58ca 100%)',
                  padding: '20px 20px 16px', color: '#fff'
                }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                    <i className="bi bi-boxes me-2"></i>FTM Garments
                  </div>
                  <div style={{ fontSize: '12px', opacity: 0.85 }}>
                    Warehouse Tracking System
                  </div>
                </div>

                <div style={{ padding: '16px' }}>
                  {/* Quick guide */}
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6c757d', marginBottom: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Quick Reference
                  </div>
                  {[
                    { icon: 'bi-upc-scan',        text: 'Barcode Scanner — scan cartons in/out' },
                    { icon: 'bi-truck',            text: 'Truck Summary — view & manage trucks' },
                    { icon: 'bi-journal-text',     text: 'Scan Sessions — review session logs & gaps' },
                    { icon: 'bi-kanban',           text: 'Purchase Orders — manage PO records' },
                    { icon: 'bi-calendar-check',   text: 'Daily Summary — today\'s shipment overview' },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
                      <i className={`bi ${item.icon}`} style={{ color: '#0d6efd', marginTop: '1px', flexShrink: 0 }}></i>
                      <span style={{ fontSize: '13px' }}>{item.text}</span>
                    </div>
                  ))}

                  <hr style={{ margin: '12px 0' }} />

                  {/* Support */}
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#6c757d', marginBottom: '8px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Support
                  </div>
                  <div style={{ fontSize: '13px', marginBottom: '6px' }}>
                    <i className="bi bi-people me-2 text-primary"></i>
                    <strong>FTM IT Team</strong>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <i className="bi bi-envelope me-2 text-primary"></i>
                    <a href={`mailto:${supportEmail}`} style={{ color: '#0d6efd', textDecoration: 'none', wordBreak: 'break-all' }}>
                      {supportEmail}
                    </a>
                  </div>

                  <div style={{ marginTop: '12px', fontSize: '11px', color: '#adb5bd', textAlign: 'center' }}>
                    © {new Date().getFullYear()} FTM Garments Swaziland
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <button
            className="header-action-btn"
            title="Logout"
            onClick={async () => {
              try { await logout(); } finally { window.location.href = '/login'; }
            }}
          >
            <i className="bi bi-box-arrow-right"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModernHeader;
