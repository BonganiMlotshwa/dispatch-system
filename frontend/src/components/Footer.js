import React from 'react';

/**
 * Footer Component
 * 
 * Provides consistent footer information across all pages
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer style={{backgroundColor: 'var(--bg-tertiary)', borderTop: '1px solid var(--gray-200)'}} className="py-3 mt-auto">
      <div className="container-fluid px-3 px-md-4">
        <div className="text-center" style={{color: 'var(--text-muted)'}}>
          <p className="mb-1 fw-medium">
            &copy; {currentYear} FTM G. Warehouse
          </p>
          <p className="small mb-0">
            Version 1.0.0 | FTM Dispatch
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;