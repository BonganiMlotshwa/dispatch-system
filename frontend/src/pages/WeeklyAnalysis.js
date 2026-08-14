import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import apiService from '../services/apiService';

const WeeklyAnalysis = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: dashboardData, loading, error, refetch } = useApi(`/dashboard_stats.php?refresh=${refreshKey > 0 ? 'true' : 'false'}`);
  const weeklyAnalysis = dashboardData?.stats?.weekly_analysis || [];
  const weeklyOutbound = dashboardData?.stats?.weekly_outbound || [];

  const handleRefresh = useCallback(() => {
    if (typeof apiService?.clearCache === 'function') {
      apiService.clearCache();
    }
    setRefreshKey((prev) => prev + 1);
  }, []);

  const renderInboundWeek = (week) => {
    const total = week.expected_cartons || ((week.received || 0) + (week.pending_to_enter || 0)) || 0;
    const receivedPercent = total > 0 ? Math.round((week.received / total) * 100) : 0;
    return (
      <div key={`in-${week.id}`} className="col-12 col-lg-6 col-xxl-4">
        <div className="modern-card h-100">
          <div className="modern-card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">{week.week_label}</h5>
            {week.is_active === 1 && <span className="badge bg-primary">Active</span>}
          </div>
          <div className="modern-card-body">
            <div className="small text-muted mb-1">Delivery schedule — goods in</div>
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
  };

  const renderOutboundWeek = (week) => (
    <div key={`out-${week.week_label}`} className="col-12 col-lg-6 col-xxl-4">
      <div className="modern-card h-100 border-success border-opacity-25">
        <div className="modern-card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">{week.week_label}</h5>
          <span className="badge bg-success">Shipped out</span>
        </div>
        <div className="modern-card-body">
          <div className="small text-muted mb-3">
            {week.truck_loads} truck load(s) · week starting {week.week_start}
          </div>
          <div className="row g-3">
            <div className="col-6">
              <div className="text-muted small">Cartons shipped</div>
              <div className="fs-4 fw-bold text-success">{week.total_cartons}</div>
              <div className="small text-muted">System: {week.cartons_shipped} · Legacy: {week.legacy_cartons}</div>
            </div>
            <div className="col-6">
              <div className="text-muted small">Units shipped</div>
              <div className="fs-4 fw-bold text-primary">{week.total_units.toLocaleString()}</div>
              <div className="small text-muted">System: {week.units_shipped.toLocaleString()} · Legacy: {week.legacy_units.toLocaleString()}</div>
            </div>
            {week.legacy_orders > 0 && (
              <div className="col-12">
                <div className="small text-muted">{week.legacy_orders} legacy order(s) included this week</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const hasData = weeklyAnalysis.length > 0 || weeklyOutbound.length > 0;

  return (
    <div className="py-2">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h1 className="text-gradient mb-0">Weekly Analysis</h1>
          <div className="small text-muted mt-1">Delivery schedules (inbound) and shipment weeks (outbound)</div>
        </div>
        <div className="d-flex gap-2">
          <Link to="/truck-summary" className="btn-modern btn-modern-outline-primary">
            <i className="bi bi-truck"></i> Truck Summary
          </Link>
          <button
            className="btn-modern btn-modern-primary"
            onClick={handleRefresh}
            disabled={loading}
            title="Refresh weekly analysis"
          >
            <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`}></i> Refresh
          </button>
        </div>
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
      ) : hasData ? (
        <>
          {weeklyOutbound.length > 0 && (
            <section className="mb-5">
              <h4 className="mb-3">
                <i className="bi bi-truck me-2 text-success"></i>
                Outbound shipment weeks
              </h4>
              <p className="text-muted small mb-3">
                Auto-created when orders ship — manual entry, exit scan, or legacy stock marked shipped.
              </p>
              <div className="row g-3 g-md-4">
                {weeklyOutbound.map(renderOutboundWeek)}
              </div>
            </section>
          )}

          {weeklyAnalysis.length > 0 && (
            <section>
              <h4 className="mb-3">
                <i className="bi bi-calendar-week me-2 text-primary"></i>
                Delivery schedule weeks
              </h4>
              <p className="text-muted small mb-3">From uploaded Mr Price weekly schedules — goods received progress.</p>
              <div className="row g-3 g-md-4">
                {weeklyAnalysis.map(renderInboundWeek)}
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="modern-card">
          <div className="modern-card-body text-muted text-center py-5">
            No weekly data yet. Ship orders or upload a delivery schedule to see progress here.
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyAnalysis;
