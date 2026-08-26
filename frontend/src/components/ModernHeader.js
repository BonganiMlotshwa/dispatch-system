import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { logout } from '../services/authService';

const ModernHeader = ({ toggleSidebar }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  const getPageTitle = () => {
    const path = location.pathname;
    switch (path) {
      case '/': return { title: '', subtitle: '' };
      case '/pos': return { title: 'Purchase Orders', subtitle: 'Manage and track PO status' };
      case '/upload': return { title: 'Import Data', subtitle: 'Upload and process shipment files' };
      case '/settings': return { title: 'Settings', subtitle: 'User management and system configuration' };
      case '/legacy-warehouse': return { title: 'Legacy Warehouse Stock', subtitle: 'Spec 1.5 — manual entry, status filter (Active, Shipped, Cancelled, …)' };
      case '/manual-entry': return { title: 'Manual Entry', subtitle: 'Enter customer orders manually' };
      case '/scanner': return { title: 'Barcode Scanner', subtitle: 'Scan cartons and update status' };
      case '/stickers': return { title: 'Label Generator', subtitle: 'Generate shipping labels and stickers' };
      case '/reports': return { title: 'Analytics & Reports', subtitle: 'View detailed reports and insights' };
      default: 
        if (path.startsWith('/shipment/')) return { title: 'Shipment Details', subtitle: 'View and manage shipment information' };
        if (path.startsWith('/po/')) return { title: 'PO Details', subtitle: 'Purchase order analytics and tracking' };
        return { title: 'Warehouse Tracking', subtitle: 'System navigation' };
    }
  };

  const { title, subtitle } = getPageTitle();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Implement search functionality
      console.log('Searching for:', searchQuery);
    }
  };

  return (
    <div className="header-bar-modern">
      <div className="header-left">
        <button 
          className="mobile-menu-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <i className="bi bi-list"></i>
        </button>
        
        {(title || subtitle) && (
          <div>
            {title && <h1 className="header-title">{title}</h1>}
            {subtitle && <p className="header-subtitle">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="header-right">
        <form className="header-search" onSubmit={handleSearch}>
          <div className="header-search-icon">
            <i className="bi bi-search"></i>
          </div>
          <input
            type="text"
            placeholder="Search shipments, POs, barcodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="header-actions">
          <ThemeToggle className="header-action-btn" />
          
          <button 
            className="header-action-btn"
            title="Notifications"
          >
            <i className="bi bi-bell"></i>
          </button>
          
          <button 
            className="header-action-btn"
            title="Settings"
            onClick={() => navigate('/settings')}
          >
            <i className="bi bi-gear"></i>
          </button>
          
          <button 
            className="header-action-btn"
            title="Help"
          >
            <i className="bi bi-question-circle"></i>
          </button>

          <button
            className="header-action-btn"
            title="Logout"
            onClick={async () => {
              try {
                await logout();
              } finally {
                window.location.href = '/login';
              }
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