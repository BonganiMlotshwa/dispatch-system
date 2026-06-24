import React, { useCallback, useState } from 'react';
import { useApi } from '../hooks/useApi';
import apiService from '../services/apiService';

const WeeklyAnalysis = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: dashboardData, loading, error, refetch } = useApi(`/dashboard_stats.php?refresh=${refreshKey > 0 ? 'true' : 'false'}`);
  const weeklyAnalysis = dashboardData?.stats?.weekly_analysis || [];

  const handleRefresh = useCallback(() => {
    if (typeof apiService?.clearCache === 'function') {
      apiService.clearCache();
    }
    setRefreshKey((prev) => prev + 1);
  }, []);

  return (
    <div className="py-2">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h1 className="text-gradient mb-0">Weekly Analysis</h1>
          <div className="small text-muted mt-1">Schedule weeks and carton movement</div>
        </div>
        <button
          className="btn-modern btn-modern-primary"
          onClick={handleRefresh}
          disabled={loading}
          title="Refresh weekly analysis"
        >
          <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="loading-spinner-modern mx-auto mb-3" style={{ width: '3rem', height: '3rem' }}></div>
          <p className="text-muted">Loading weekly analysis...</p>
        </div>
      ) : error ? (
        <div className="alert-modern alert-modern-danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <strong>Connection Error:</strong> {error}
            <button className="btn btn-outline-danger btn-sm mt-2 d-block" onClick={refetch} disabled={loading}>
              <i className="bi bi-arrow-clockwise"></i> Retry Connection
            </button>
          </div>
        </div>
      ) : weeklyAnalysis.length > 0 ? (
        <div className="row g-3 g-md-4">
          {weeklyAnalysis.map((week) => {
            const total = week.expected_cartons || week.received + week.pending_to_enter || 0;
            const receivedPercent = total > 0 ? Math.round((week.received / total) * 100) : 0;
            return (
              <div key={week.id} className="col-12 col-lg-6 col-xxl-4">
                <div className="modern-card h-100">
                  <div className="modern-card-header d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">{week.week_label}</h5>
                    {week.is_active === 1 && <span className="badge bg-primary">Active</span>}
                  </div>
                  <div className="modern-card-body">
                    <div className="small text-muted mb-3">{week.shipment_count} file(s), {week.order_count} scheduled order(s)</div>
                    <div className="progress mb-3" style={{ height: '8px' }}>
                      <div className="progress-bar bg-success" style={{ width: `${receivedPercent}%` }}></div>
                    </div>
                    <div className="row g-3">
                      <div className="col-6">
                        <div className="text-muted small">Received</div>
                        <div className="fs-4 fw-bold text-primary">{week.received}</div>
                      </div>
                      <div className="col-6">
                        <div className="text-muted small">In Warehouse</div>
                        <div className="fs-4 fw-bold text-info">{week.in_warehouse}</div>
                      </div>
                      <div className="col-6">
                        <div className="text-muted small">Pending to Enter</div>
                        <div className="fs-4 fw-bold text-warning">{week.pending_to_enter}</div>
                      </div>
                      <div className="col-6">
                        <div className="text-muted small">Shipped</div>
                        <div className="fs-4 fw-bold text-success">{week.shipped}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="modern-card">
          <div className="modern-card-body text-muted text-center py-5">No weekly schedules loaded yet.</div>
        </div>
      )}
    </div>
  );
};

export default WeeklyAnalysis;
