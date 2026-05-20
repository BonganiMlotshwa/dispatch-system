import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { useTheme } from '../contexts/ThemeContext';
import apiService from '../services/apiService';
import { Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  PointElement,
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Dashboard Page Component
 * 
 * Displays system metrics and recent shipments
 */
const Dashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: dashboardData, loading, error, refetch } = useApi(`/dashboard_stats.php?refresh=${refreshKey > 0 ? 'true' : 'false'}`);
  const { resolvedTheme } = useTheme();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  
  const isDark = resolvedTheme === 'dark';

  // Manual refresh function that bypasses cache
  const handleRefresh = useCallback(async () => {
    try {
      // Clear API service cache first
      if (typeof apiService?.clearCache === 'function') {
        apiService.clearCache();
      }
      
      // Increment refresh key to force new API call with cache bypass
      setRefreshKey(prev => prev + 1);
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error refreshing dashboard:', err);
    }
  }, []);

  // Manual refresh only (auto-refresh disabled)
  useEffect(() => {
    // Set initial last update time
    setLastUpdate(new Date());
    // No interval for auto-refresh
  }, []);

  // Memoized chart data to prevent unnecessary recalculations
  const statusChartData = useMemo(() => {
    if (!dashboardData?.stats?.status_counts) return null;
    
    const statusCounts = dashboardData.stats.status_counts;
    const statusData = {
      'Pending': statusCounts.pending || 0,
      'In Warehouse': statusCounts.entered || 0,
      'Shipped': statusCounts.exited || 0
    };
    
    // Theme-aware colors
    const colors = isDark ? {
      pending: { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgba(251, 191, 36, 1)' },
      warehouse: { bg: 'rgba(56, 189, 248, 0.8)', border: 'rgba(56, 189, 248, 1)' },
      shipped: { bg: 'rgba(52, 211, 153, 0.8)', border: 'rgba(52, 211, 153, 1)' }
    } : {
      pending: { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgba(245, 158, 11, 1)' },
      warehouse: { bg: 'rgba(59, 130, 246, 0.6)', border: 'rgba(59, 130, 246, 1)' },
      shipped: { bg: 'rgba(16, 185, 129, 0.6)', border: 'rgba(16, 185, 129, 1)' }
    };
    
    return {
      labels: Object.keys(statusData),
      datasets: [
        {
          label: 'Carton Count',
          data: Object.values(statusData),
          backgroundColor: [
            colors.pending.bg,
            colors.warehouse.bg,
            colors.shipped.bg,
          ],
          borderColor: [
            colors.pending.border,
            colors.warehouse.border,
            colors.shipped.border,
          ],
          borderWidth: 2,
        },
      ],
    };
  }, [dashboardData?.stats?.status_counts, isDark]);
  
  // Missing data chart removed as requested
  
  const sizeDistributionChartData = useMemo(() => {
    if (!dashboardData?.stats?.size_distribution) return null;
    
    const sizeData = dashboardData.stats.size_distribution;
    const labels = sizeData.map(item => item.size);
    const data = sizeData.map(item => item.count);
    
    // Generate theme-aware colors for each bar
    const colors = isDark ? [
      'rgba(139, 92, 246, 0.8)', // Purple
      'rgba(236, 72, 153, 0.8)', // Pink
      'rgba(251, 146, 60, 0.8)',  // Orange
      'rgba(34, 197, 94, 0.8)',   // Green
      'rgba(239, 68, 68, 0.8)',   // Red
      'rgba(14, 165, 233, 0.8)',  // Blue
      'rgba(168, 85, 247, 0.8)',  // Violet
      'rgba(245, 101, 101, 0.8)', // Light Red
    ] : [
      'rgba(139, 92, 246, 0.6)',
      'rgba(236, 72, 153, 0.6)',
      'rgba(251, 146, 60, 0.6)',
      'rgba(34, 197, 94, 0.6)',
      'rgba(239, 68, 68, 0.6)',
      'rgba(14, 165, 233, 0.6)',
      'rgba(168, 85, 247, 0.6)',
      'rgba(245, 101, 101, 0.6)',
    ];
    
    const borderColors = isDark ? [
      'rgba(139, 92, 246, 1)',
      'rgba(236, 72, 153, 1)',
      'rgba(251, 146, 60, 1)',
      'rgba(34, 197, 94, 1)',
      'rgba(239, 68, 68, 1)',
      'rgba(14, 165, 233, 1)',
      'rgba(168, 85, 247, 1)',
      'rgba(245, 101, 101, 1)',
    ] : [
      'rgba(139, 92, 246, 1)',
      'rgba(236, 72, 153, 1)',
      'rgba(251, 146, 60, 1)',
      'rgba(34, 197, 94, 1)',
      'rgba(239, 68, 68, 1)',
      'rgba(14, 165, 233, 1)',
      'rgba(168, 85, 247, 1)',
      'rgba(245, 101, 101, 1)',
    ];
    
    return {
      labels: labels,
      datasets: [
        {
          label: 'Carton Count by Size',
          data: data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: borderColors.slice(0, data.length),
          borderWidth: 2,
        },
      ],
    };
  }, [dashboardData?.stats?.size_distribution, isDark]);
  
  const dailyActivityChartData = useMemo(() => {
    if (!dashboardData?.stats?.daily_activity) return null;
    
    const activityData = dashboardData.stats.daily_activity;
    const labels = activityData.map(item => item.date);
    
    // Theme-aware colors for daily activity
    const colors = isDark ? {
      entered: { bg: 'rgba(251, 191, 36, 0.8)', border: 'rgba(251, 191, 36, 1)' },
      exited: { bg: 'rgba(52, 211, 153, 0.8)', border: 'rgba(52, 211, 153, 1)' }
    } : {
      entered: { bg: 'rgba(245, 158, 11, 0.6)', border: 'rgba(245, 158, 11, 1)' },
      exited: { bg: 'rgba(16, 185, 129, 0.6)', border: 'rgba(16, 185, 129, 1)' }
    };
    
    return {
      labels: labels,
      datasets: [
        {
          label: 'Entered',
          data: activityData.map(item => item.entered || 0),
          backgroundColor: colors.entered.bg,
          borderColor: colors.entered.border,
          borderWidth: 2,
          tension: 0.4,
        },
        {
          label: 'Exited',
          data: activityData.map(item => item.exited || 0),
          backgroundColor: colors.exited.bg,
          borderColor: colors.exited.border,
          borderWidth: 2,
          tension: 0.4,
        },
      ],
    };
  }, [dashboardData?.stats?.daily_activity, isDark]);
  
  const barChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: isDark ? '#d1d5db' : '#374151',
          font: {
            family: 'Inter, sans-serif',
            size: 12
          }
        }
      },
      title: {
        display: true,
        text: 'Carton Status Distribution',
        color: isDark ? '#ffffff' : '#111827',
        font: {
          family: 'Inter, sans-serif',
          size: 14,
          weight: '600'
        }
      },
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
        }
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
        }
      }
    }
  }), [isDark]);
  
  const doughnutChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: isDark ? '#d1d5db' : '#374151',
          font: {
            family: 'Inter, sans-serif',
            size: 12
          },
          padding: 20,
          usePointStyle: true
        }
      },
      title: {
        display: true,
        text: 'Data Completeness',
        color: isDark ? '#ffffff' : '#111827',
        font: {
          family: 'Inter, sans-serif',
          size: 14,
          weight: '600'
        }
      },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#ffffff',
        titleColor: isDark ? '#ffffff' : '#111827',
        bodyColor: isDark ? '#d1d5db' : '#374151',
        borderColor: isDark ? '#374151' : '#e5e7eb',
        borderWidth: 1
      }
    },
    cutout: '60%',
  }), [isDark]);

  
  return (
    <div className="py-2">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h1 className="text-gradient mb-0">Dashboard</h1>
          <div className="small text-muted mt-1">
            <i className="bi bi-clock"></i> Last updated: {lastUpdate.toLocaleTimeString()}
            <button 
              className="btn btn-link btn-sm p-0 ms-2" 
              onClick={handleRefresh}
              disabled={loading}
              title="Refresh dashboard data (bypasses cache)"
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i>
            </button>
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2">
          <Link to="/upload" className="btn-modern btn-modern-primary">
            <i className="bi bi-upload"></i> Import File
          </Link>
          <Link to="/scanner" className="btn-modern btn-modern-success">
            <i className="bi bi-upc-scan"></i> Scan Cartons
          </Link>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-5">
          <div className="loading-spinner-modern mx-auto mb-3" style={{width: '3rem', height: '3rem'}}></div>
          <p className="text-muted">Loading dashboard data...</p>
        </div>
      ) : error ? (
        <div className="alert-modern alert-modern-danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <strong>Connection Error:</strong> {error}
            <div className="mt-2 small">
              <i className="bi bi-info-circle"></i> Make sure XAMPP is running and the backend server is accessible.
            </div>
            <button 
              className="btn btn-outline-danger btn-sm mt-2" 
              onClick={refetch}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise"></i> Retry Connection
            </button>
          </div>
        </div>
      ) : !dashboardData && !loading ? (
        <div className="alert-modern alert-modern-warning">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <strong>No Data:</strong> Unable to load dashboard data.
            <div className="mt-2 small">
              <i className="bi bi-info-circle"></i> The server may be unavailable or there may be no data to display.
            </div>
          </div>
        </div>
      ) : dashboardData?.stats ? (
        <>
          {/* Summary Cards */}
          <div className="row g-3 g-md-4 mb-4">
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift">
                <div className="dashboard-stat-label">Total Cartons Expected</div>
                <div className="dashboard-stat-number">{dashboardData.stats?.totals?.total_cartons || 0}</div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift">
                <div className="dashboard-stat-label">Cartons Shipped</div>
                <div className="dashboard-stat-number">{dashboardData.stats?.status_counts?.exited || 0}</div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift">
                <div className="dashboard-stat-label">In Warehouse</div>
                <div className="dashboard-stat-number">{dashboardData.stats?.status_counts?.entered || 0}</div>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift">
                <div className="dashboard-stat-label">Total Orders</div>
                <div className="dashboard-stat-number">{dashboardData.stats?.totals?.total_shipments || 0}</div>
              </div>
            </div>
          </div>
          
          {/* Unit Statistics */}
          <div className="row g-3 g-md-4 mb-4">
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift" style={{ borderLeft: '4px solid #f59e0b' }}>
                <div className="dashboard-stat-label">Units in Factory</div>
                <div className="dashboard-stat-number text-warning">{dashboardData.stats?.unit_counts?.factory_units?.toLocaleString() || 0}</div>
                <small className="text-muted">Currently in warehouse</small>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift" style={{ borderLeft: '4px solid #10b981' }}>
                <div className="dashboard-stat-label">Units Shipped</div>
                <div className="dashboard-stat-number text-success">{dashboardData.stats?.unit_counts?.shipped_units?.toLocaleString() || 0}</div>
                <small className="text-muted">Successfully delivered</small>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift" style={{ borderLeft: '4px solid #6b7280' }}>
                <div className="dashboard-stat-label">Units Pending</div>
                <div className="dashboard-stat-number text-secondary">{dashboardData.stats?.unit_counts?.pending_units?.toLocaleString() || 0}</div>
                <small className="text-muted">Awaiting processing</small>
              </div>
            </div>
            <div className="col-6 col-lg-3">
              <div className="dashboard-stat-card hover-lift" style={{ borderLeft: '4px solid #3b82f6' }}>
                <div className="dashboard-stat-label">Total Units</div>
                <div className="dashboard-stat-number text-primary">{dashboardData.stats?.unit_counts?.total_units?.toLocaleString() || 0}</div>
                <small className="text-muted">All units in system</small>
              </div>
            </div>
          </div>
          
          {/* Charts */}
          <div className="row g-3 g-md-4 mb-4">
            <div className="col-12">
              <div className="modern-card h-100">
                <div className="modern-card-header">
                  <h5 className="mb-0">Carton Status</h5>
                </div>
                <div className="modern-card-body">
                  <div style={{ height: '300px' }}>
                    {statusChartData && <Doughnut data={statusChartData} options={doughnutChartOptions} key="status-chart" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Size Distribution and Daily Activity */}
          <div className="row g-3 g-md-4 mb-4">
            <div className="col-12 col-lg-6">
              <div className="modern-card h-100">
                <div className="modern-card-header">
                  <h5 className="mb-0">Size Distribution</h5>
                </div>
                <div className="modern-card-body">
                  <div style={{ height: '300px' }}>
                    {sizeDistributionChartData && <Bar data={sizeDistributionChartData} options={barChartOptions} key="size-chart" />}
                  </div>
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-6">
              <div className="modern-card h-100">
                <div className="modern-card-header">
                  <h5 className="mb-0">Daily Activity (Last 7 Days)</h5>
                </div>
                <div className="modern-card-body">
                  <div style={{ height: '300px' }}>
                    {dailyActivityChartData && <Bar data={dailyActivityChartData} options={barChartOptions} key="activity-chart" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recent Shipments */}
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h5 className="mb-0">Recent Shipments</h5>
            </div>
            <div className="modern-card-body p-0">
              <div className="table-responsive">
                <table className="table-modern mb-0">
                  <thead>
                    <tr>
                      <th>FTM PO Number</th>
                      <th className="d-none d-md-table-cell">File Name</th>
                      <th className="d-none d-lg-table-cell">Import Date</th>
                      <th>Cartons</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardData.stats && dashboardData.stats.recent_shipments ? dashboardData.stats.recent_shipments.map((shipment) => (
                      <tr key={shipment.id}>
                        <td className="fw-medium">{shipment.internal_po_number}</td>
                        <td className="d-none d-md-table-cell text-muted">{shipment.file_name}</td>
                        <td className="d-none d-lg-table-cell text-muted">{new Date(shipment.import_date).toLocaleDateString()}</td>
                        <td>{shipment.carton_count}</td>
                        <td>
                          <div className="d-flex flex-wrap gap-1">
                            <span className="badge-modern badge-modern-info">{shipment.entered_count} In</span>
                            <span className="badge-modern badge-modern-success">{shipment.exited_count} Out</span>
                          </div>
                        </td>
                        <td>
                          <div className="d-flex gap-1">
                            <Link to={`/po/${shipment.id}`} className="btn-modern btn-modern-primary" style={{padding: '0.375rem 0.75rem', fontSize: '0.875rem'}}>
                              <i className="bi bi-graph-up"></i>
                              <span className="d-none d-sm-inline ms-1">Analytics</span>
                            </Link>
                            <Link to={`/shipment/${shipment.id}`} className="btn-modern btn-modern-secondary" style={{padding: '0.375rem 0.75rem', fontSize: '0.875rem'}}>
                              <i className="bi bi-eye"></i>
                              <span className="d-none d-sm-inline ms-1">View</span>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="6" className="text-center py-4">
                          <p className="text-muted mb-0">No recent shipments found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default Dashboard;