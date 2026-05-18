// Chart.js theme utilities for dark/light mode support

export const getChartOptions = (theme, baseOptions = {}) => {
  const isDark = theme === 'dark';
  
  const themeOptions = {
    plugins: {
      legend: {
        labels: {
          color: isDark ? '#d1d5db' : '#374151',
          font: {
            family: 'Inter, sans-serif'
          }
        },
        ...baseOptions.plugins?.legend
      },
      title: {
        color: isDark ? '#ffffff' : '#111827',
        font: {
          family: 'Inter, sans-serif',
          weight: '600'
        },
        ...baseOptions.plugins?.title
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor: isDark ? '#ffffff' : '#111827',
        bodyColor: isDark ? '#d1d5db' : '#374151',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1,
        ...baseOptions.plugins?.tooltip
      }
    },
    scales: {
      x: {
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          font: {
            family: 'Inter, sans-serif'
          }
        },
        grid: {
          color: isDark ? '#374151' : '#e5e7eb',
          borderColor: isDark ? '#4b5563' : '#d1d5db'
        },
        ...baseOptions.scales?.x
      },
      y: {
        ticks: {
          color: isDark ? '#9ca3af' : '#6b7280',
          font: {
            family: 'Inter, sans-serif'
          }
        },
        grid: {
          color: isDark ? '#374151' : '#e5e7eb',
          borderColor: isDark ? '#4b5563' : '#d1d5db'
        },
        ...baseOptions.scales?.y
      }
    },
    ...baseOptions
  };

  return themeOptions;
};

export const getChartColors = (theme) => {
  const isDark = theme === 'dark';
  
  return {
    primary: isDark ? '#60a5fa' : '#3b82f6',
    success: isDark ? '#34d399' : '#10b981',
    warning: isDark ? '#fbbf24' : '#f59e0b',
    danger: isDark ? '#f87171' : '#ef4444',
    info: isDark ? '#38bdf8' : '#06b6d4',
    secondary: isDark ? '#9ca3af' : '#6b7280',
    
    // Chart specific colors with opacity
    datasets: {
      primary: {
        background: isDark ? 'rgba(96, 165, 250, 0.2)' : 'rgba(59, 130, 246, 0.2)',
        border: isDark ? '#60a5fa' : '#3b82f6'
      },
      success: {
        background: isDark ? 'rgba(52, 211, 153, 0.2)' : 'rgba(16, 185, 129, 0.2)',
        border: isDark ? '#34d399' : '#10b981'
      },
      warning: {
        background: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(245, 158, 11, 0.2)',
        border: isDark ? '#fbbf24' : '#f59e0b'
      },
      danger: {
        background: isDark ? 'rgba(248, 113, 113, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        border: isDark ? '#f87171' : '#ef4444'
      },
      info: {
        background: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(6, 182, 212, 0.2)',
        border: isDark ? '#38bdf8' : '#06b6d4'
      }
    }
  };
};