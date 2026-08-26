import React, { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import apiService from '../services/apiService';

const weekNum = (label) => parseInt(String(label || '').match(/\d+/)?.[0] || '0', 10);

const WeeklyAnalysis = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const { data: dashboardData, loading, error, refetch } = useApi(`/dashboard_stats.php?refresh=${refreshKey > 0 ? 'true' : 'false'}`);
  const weeklyAnalysis = dashboardData?.stats?.weekly_analysis || [];
  const weeklyOutbound = dashboardData?.stats?.weekly_outbound || [];

  const [viewMode, setViewMode] = useState('list');
  const [sortAsc, setSortAsc] = useState(true);

  const handleRefresh = useCallback(() => {
    if (typeof apiService?.clearCache === 'function') apiService.clearCache();
    setRefreshKey((prev) => prev + 1);
  }, []);

  const sortedOutbound = [...weeklyOutbound].sort((a, b) =>
    sortAsc ? weekNum(a.week_label) - weekNum(b.week_label) : weekNum(b.week_label) - weekNum(a.week_label)
  );
  const sortedInbound = [...weeklyAnalysis].sort((a, b) =>
    sortAsc ? weekNum(a.week_label) - weekNum(b.week_label) : weekNum(b.week_label) - weekNum(a.week_label)
  );

  // ── Grid renderers (original card layout) ──────────────────────────────────

  const renderInboundCard = (week) => {
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

  const renderOutboundCard = (week) => (
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

  // ── List renderers (table rows) ────────────────────────────────────────────

  const renderOutboundTable = () => (
    <div className="modern-table-container">
      <table className="modern-table weekly-analysis-table mb-0">
        <thead>
          <tr>
            <th>Week</th>
            <th>Week start</th>
            <th>Truck loads</th>
            <th>Cartons (total)</th>
            <th>System</th>
            <th>Legacy</th>
            <th>Units (total)</th>
            <th>Legacy orders</th>
          </tr>
        </thead>
        <tbody>
          {sortedOutbound.map((week) => (
            <tr key={`out-${week.week_label}`}>
              <td><span className="badge bg-success">{week.week_label}</span></td>
              <td className="small">{week.week_start}</td>
              <td>{week.truck_loads}</td>
              <td className="fw-semibold">{week.total_cartons.toLocaleString()}</td>
              <td className="small">{week.cartons_shipped.toLocaleString()}</td>
              <td className="small">{week.legacy_cartons.toLocaleString()}</td>
              <td className="fw-semibold">{week.total_units.toLocaleString()}</td>
              <td>{week.legacy_orders > 0 ? week.legacy_orders : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderInboundTable = () => (
    <div className="modern-table-container">
      <table className="modern-table weekly-analysis-table mb-0">
        <thead>
          <tr>
            <th>Week</th>
            <th>Files</th>
            <th>Orders</th>
            <th>Received (ctns)</th>
            <th>Units received</th>
            <th>In warehouse (ctns)</th>
            <th>Units in WH</th>
            <th>Pending (ctns)</th>
            <th>Units pending</th>
            <th>Shipped (ctns)</th>
            <th>Units shipped</th>
            <th style={{ minWidth: 120 }}>Progress</th>
          </tr>
        </thead>
        <tbody>
          {sortedInbound.map((week) => {
            const total = week.expected_cartons || ((week.received || 0) + (week.pending_to_enter || 0)) || 0;
            const pct = total > 0 ? Math.min(100, Math.round((week.received / total) * 100)) : 0;
            return (
              <tr key={`in-${week.id}`}>
                <td>
                  <span className="fw-semibold">{week.week_label}</span>
                  {week.is_active === 1 && <span className="badge bg-primary ms-2">Active</span>}
                </td>
                <td className="small">{week.shipment_count}</td>
                <td className="small">{week.order_count}</td>
                <td className="fw-semibold text-primary">{week.received}</td>
                <td className="text-primary">{(week.units_received || 0).toLocaleString()}</td>
                <td className="text-info">{week.in_warehouse}</td>
                <td className="text-info">{(week.units_in_warehouse || 0).toLocaleString()}</td>
                <td className="text-warning">{week.pending_to_enter}</td>
                <td className="text-warning">{(week.units_pending || 0).toLocaleString()}</td>
                <td className="text-success">{week.shipped}</td>
                <td className="text-success">{(week.units_shipped || 0).toLocaleString()}</td>
                <td>
                  <div className="d-flex align-items-center gap-2">
                    <div className="progress flex-grow-1" style={{ height: 6 }}>
                      <div className="progress-bar bg-success" style={{ width: `${pct}%` }}></div>
                    </div>
                    <span className="small text-muted" style={{ minWidth: 32 }}>{pct}%</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
        <div className="d-flex gap-2 flex-wrap align-items-center">
          {/* Sort toggle */}
          <button
            className="btn-modern btn-modern-outline-secondary"
            onClick={() => setSortAsc((v) => !v)}
            title={sortAsc ? 'Showing Week 1 first — click to reverse' : 'Showing latest week first — click to reverse'}
          >
            <i className={`bi bi-sort-numeric-${sortAsc ? 'down' : 'down-alt'}`}></i>
            {sortAsc ? ' Week 1 first' : ' Latest first'}
          </button>

          {/* View toggle */}
          <div className="btn-group" role="group" aria-label="View mode">
            <button
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <i className="bi bi-list-ul"></i>
            </button>
            <button
              className={`btn btn-sm ${viewMode === 'grid' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >
              <i className="bi bi-grid-3x3-gap"></i>
            </button>
          </div>

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
          {/* Outbound shipment weeks — hidden for now */}

          {sortedInbound.length > 0 && (
            <section>
              <h4 className="mb-1">
                <i className="bi bi-calendar-week me-2 text-primary"></i>
                Delivery schedule weeks
              </h4>
              <p className="text-muted small mb-3">From uploaded Mr Price weekly schedules — goods received progress.</p>
              {viewMode === 'list' ? (
                <div className="modern-card">
                  <div className="modern-card-body p-0">
                    {renderInboundTable()}
                  </div>
                </div>
              ) : (
                <div className="row g-3 g-md-4">
                  {sortedInbound.map(renderInboundCard)}
                </div>
              )}
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
