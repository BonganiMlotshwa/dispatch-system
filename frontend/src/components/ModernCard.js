import React from 'react';

export const ModernCard = ({ 
  children, 
  className = '', 
  hover = true, 
  gradient = false,
  padding = 'default',
  ...props 
}) => {
  const paddingClass = {
    none: '',
    sm: 'p-3',
    default: 'p-4',
    lg: 'p-5'
  }[padding];

  return (
    <div 
      className={`modern-card ${hover ? 'hover-lift' : ''} ${gradient ? 'gradient-border' : ''} ${paddingClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export const ModernCardHeader = ({ 
  children, 
  className = '', 
  actions = null,
  ...props 
}) => {
  return (
    <div className={`modern-card-header d-flex justify-content-between align-items-center ${className}`} {...props}>
      <div>{children}</div>
      {actions && <div className="card-actions">{actions}</div>}
    </div>
  );
};

export const ModernCardBody = ({ 
  children, 
  className = '', 
  ...props 
}) => {
  return (
    <div className={`modern-card-body ${className}`} {...props}>
      {children}
    </div>
  );
};

export const StatCard = ({ 
  title, 
  value, 
  icon, 
  trend = null, 
  color = 'primary',
  loading = false,
  className = ''
}) => {
  const colorClasses = {
    primary: 'stat-card-primary',
    success: 'stat-card-success',
    warning: 'stat-card-warning',
    danger: 'stat-card-danger',
    info: 'stat-card-info'
  };

  return (
    <ModernCard className={`stat-card ${colorClasses[color]} ${className}`} hover>
      <div className="stat-card-content">
        <div className="stat-card-icon">
          <i className={`bi ${icon}`}></i>
        </div>
        
        <div className="stat-card-info">
          <div className="stat-card-value">
            {loading ? (
              <div className="loading-skeleton-text"></div>
            ) : (
              value
            )}
          </div>
          <div className="stat-card-title">{title}</div>
          
          {trend && (
            <div className={`stat-card-trend ${trend.direction}`}>
              <i className={`bi ${trend.direction === 'up' ? 'bi-arrow-up' : 'bi-arrow-down'}`}></i>
              <span>{trend.value}</span>
            </div>
          )}
        </div>
      </div>
    </ModernCard>
  );
};

export const ActionCard = ({ 
  title, 
  description, 
  icon, 
  onClick, 
  color = 'primary',
  disabled = false,
  className = ''
}) => {
  const colorClasses = {
    primary: 'action-card-primary',
    success: 'action-card-success',
    warning: 'action-card-warning',
    danger: 'action-card-danger',
    info: 'action-card-info'
  };

  return (
    <ModernCard 
      className={`action-card ${colorClasses[color]} ${disabled ? 'disabled' : ''} ${className}`}
      hover={!disabled}
      onClick={disabled ? undefined : onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
    >
      <div className="action-card-content">
        <div className="action-card-icon">
          <i className={`bi ${icon}`}></i>
        </div>
        
        <div className="action-card-info">
          <h5 className="action-card-title">{title}</h5>
          <p className="action-card-description">{description}</p>
        </div>
        
        <div className="action-card-arrow">
          <i className="bi bi-arrow-right"></i>
        </div>
      </div>
    </ModernCard>
  );
};