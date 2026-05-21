import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import apiService from '../services/apiService';

const Sidebar = ({ isOpen, toggleSidebar }) => {
  const location = useLocation();
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: dashboardData, refetch } = useApi(`/dashboard_stats.php?refresh=true&t=${refreshKey}`);

  const isActive = (path) => location.pathname === path;

  // Refresh stats when location changes (user navigates)
  useEffect(() => {
    // Clear cache and refresh stats when user navigates
    if (typeof apiService?.clearCache === 'function') {
      apiService.clearCache();
    }
    setRefreshKey(Date.now()); // Force fresh data
  }, [location.pathname]);

  // Periodic refresh for real-time stats (every 10 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      // Silent refresh for sidebar stats
      if (typeof apiService?.clearCache === 'function') {
        apiService.clearCache();
      }
      setRefreshKey(Date.now());
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Extract stats from dashboard data
  const stats = dashboardData?.stats || {};
  const statusCounts = stats.status_counts || {};
  const totals = stats.totals || {};

  const menuItems = [
    { path: '/', icon: 'bi-speedometer2', label: 'Dashboard', badge: null },
    { path: '/pos', icon: 'bi-kanban', label: 'Purchase Orders', badge: null },
    { path: '/upload', icon: 'bi-cloud-upload', label: 'Import Data', badge: null },
    { path: '/manual-entry', icon: 'bi-pencil-square', label: 'Manual Entry', badge: null },
    { path: '/xml-generator', icon: 'bi-file-earmark-code', label: 'XML Generator', badge: null },
    { path: '/scanner', icon: 'bi-upc-scan', label: 'Barcode Scanner', badge: null },
    { path: '/truck-summary', icon: 'bi-truck', label: 'Truck Summary', badge: null },
    { path: '/stickers', icon: 'bi-tags', label: 'Label Generator', badge: null },
    { path: '/daily-summary', icon: 'bi-calendar-check', label: 'Daily Summary', badge: null },
    { path: '/reports', icon: 'bi-file-earmark-text', label: 'Reports', badge: null },
  ];

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="sidebar-overlay d-lg-none"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={`sidebar-modern ${isOpen ? 'sidebar-open' : ''}`}>
        {/* Logo Section */}
        <div className="sidebar-header">
          <Link to="/" className="sidebar-brand" onClick={() => window.innerWidth < 992 && toggleSidebar()}>
            <div className="brand-icon">
              <i className="bi bi-boxes"></i>
            </div>
            <div className="brand-text">
              <span className="brand-title">FTM Garments Warehouse</span>
              <span className="brand-subtitle">Tracking System</span>
            </div>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Main Menu</div>
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
                onClick={() => window.innerWidth < 992 && toggleSidebar()}
              >
                <div className="nav-item-icon">
                  <i className={`bi ${item.icon}`}></i>
                </div>
                <span className="nav-item-text">{item.label}</span>
                {item.badge && (
                  <span className="nav-item-badge">{item.badge}</span>
                )}
              </Link>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-profile">
            <div className="user-avatar">
              <i className="bi bi-person-circle"></i>
            </div>
            <div className="user-info">
              <div className="user-name">Warehouse User</div>
              <div className="user-role">Administrator</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;