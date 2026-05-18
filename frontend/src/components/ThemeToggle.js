import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { theme, resolvedTheme, toggleTheme } = useTheme();

  const getIcon = () => {
    if (theme === 'system') {
      return 'bi-circle-half';
    }
    return resolvedTheme === 'dark' ? 'bi-moon-fill' : 'bi-sun-fill';
  };

  const getTooltip = () => {
    const modes = {
      light: 'Switch to Dark Mode',
      dark: 'Switch to System Mode', 
      system: 'Switch to Light Mode'
    };
    return modes[theme];
  };

  return (
    <button
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={getTooltip()}
      aria-label={getTooltip()}
    >
      <i className={`bi ${getIcon()}`}></i>
    </button>
  );
};

export default ThemeToggle;