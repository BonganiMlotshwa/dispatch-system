import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const isActive = (path) => location.pathname === path;
  
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const closeMenu = () => setIsMenuOpen(false);

  return (
    <nav className="navbar-modern-fixed">
      <div className="container-fluid px-3 px-md-4">
        <div className="d-flex justify-content-between align-items-center w-100">
          <Link to="/" className="navbar-brand-modern" onClick={closeMenu}>
            <i className="bi bi-boxes me-2"></i>
            Warehouse Tracking
          </Link>
          
          <button 
            className="navbar-toggler d-md-none" 
            type="button" 
            onClick={toggleMenu}
          >
            <i className={`bi ${isMenuOpen ? 'bi-x' : 'bi-list'}`}></i>
          </button>
          
          <div className={`navbar-nav-container ${isMenuOpen ? 'show' : ''}`}>
            <div className="navbar-nav d-flex flex-row">
              <Link to="/" className={`nav-link-modern ${isActive('/') ? 'active' : ''}`} onClick={closeMenu}>
                <i className="bi bi-speedometer2 me-1"></i>
                Dashboard
              </Link>
              <Link to="/pos" className={`nav-link-modern ${isActive('/pos') ? 'active' : ''}`} onClick={closeMenu}>
                <i className="bi bi-kanban me-1"></i>
                POs
              </Link>
              <Link to="/upload" className={`nav-link-modern ${isActive('/upload') ? 'active' : ''}`} onClick={closeMenu}>
                <i className="bi bi-upload me-1"></i>
                Import
              </Link>
              <Link to="/scanner" className={`nav-link-modern ${isActive('/scanner') ? 'active' : ''}`} onClick={closeMenu}>
                <i className="bi bi-upc-scan me-1"></i>
                Scanner
              </Link>
              <Link to="/stickers" className={`nav-link-modern ${isActive('/stickers') ? 'active' : ''}`} onClick={closeMenu}>
                <i className="bi bi-tags me-1"></i>
                Stickers
              </Link>
              {/* Manual entry link removed */}
              <Link to="/reports" className={`nav-link-modern ${isActive('/reports') ? 'active' : ''}`} onClick={closeMenu}>
                <i className="bi bi-graph-up me-1"></i>
                Reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;