import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Row, Col, Form, Spinner } from 'react-bootstrap';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';

const CUSTOMER_CHART_COLORS = {
  MRP: { bg: 'rgba(59, 130, 246, 0.75)', border: 'rgba(59, 130, 246, 1)' },
  OTB: { bg: 'rgba(16, 185, 129, 0.75)', border: 'rgba(16, 185, 129, 1)' },
  OBSW: { bg: 'rgba(245, 158, 11, 0.75)', border: 'rgba(245, 158, 11, 1)' },
  Other: { bg: 'rgba(107, 114, 128, 0.75)', border: 'rgba(107, 114, 128, 1)' }
};

/**
 * Stacked bar charts: cartons & units entered daily per customer.
 */
const DailyEntryCharts = ({ period = 'all', startDate = '', endDate = '', chartHeight = 300, showFilters = false }) => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ period, startDate, endDate });

  useEffect(() => {
    setFilters({ period, startDate, endDate });
  }, [period, startDate, endDate]);

  const loadChart = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'getDailyEnteredByCustomer',
        filter_period: filters.period
      });
      if (filters.startDate && filters.endDate) {
        params.append('start_date', filters.startDate);
        params.append('end_date', filters.endDate);
      }
      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`);
      if (response.data.success) {
        setData(response.data);
      }
    } catch (err) {
      console.error('Failed to load daily entry chart:', err);
    } finally {
      setLoading(false);
    }
  }, [filters.period, filters.startDate, filters.endDate]);

  useEffect(() => {
    loadChart();
  }, [loadChart]);

  const buildChartData = useCallback((metric) => {
    if (!data?.series?.length) return null;
    const { dates, customers, series } = data;
    const labels = dates.map((d) =>
      new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    return {
      labels,
      datasets: customers.map((customer) => {
        const colors = CUSTOMER_CHART_COLORS[customer] || CUSTOMER_CHART_COLORS.Other;
        return {
          label: customer,
          data: dates.map((date) => {
            const row = series.find((s) => s.entry_date === date && s.customer === customer);
            if (!row) return 0;
            return metric === 'cartons' ? Number(row.cartons_entered) : Number(row.units_entered);
          }),
          backgroundColor: colors.bg,
          borderColor: colors.border,
          borderWidth: 1
        };
      })
    };
  }, [data]);

  const cartonsChart = useMemo(() => buildChartData('cartons'), [buildChartData]);
  const unitsChart = useMemo(() => buildChartData('units'), [buildChartData]);

  const chartOptions = useMemo(() => (title) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: { color: isDark ? '#d1d5db' : '#374151', font: { size: 11 } }
      },
      title: {
        display: true,
        text: title,
        color: isDark ? '#ffffff' : '#111827',
        font: { size: 13, weight: '600' }
      }
    },
    scales: {
      x: {
        stacked: true,
        ticks: { color: isDark ? '#9ca3af' : '#6b7280', maxRotation: 45 },
        grid: { color: isDark ? '#374151' : '#e5e7eb' }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { color: isDark ? '#9ca3af' : '#6b7280' },
        grid: { color: isDark ? '#374151' : '#e5e7eb' }
      }
    }
  }), [isDark]);

  return (
    <>
      {showFilters && (
        <Row className="g-3 mb-3">
          <Col md={4}>
            <Form.Group>
              <Form.Label className="form-label-modern small">Period</Form.Label>
              <Form.Select
                size="sm"
                className="form-control-modern"
                value={filters.period}
                onChange={(e) => setFilters((f) => ({ ...f, period: e.target.value }))}
              >
                <option value="all">Last 30 Days</option>
                <option value="daily">Today</option>
                <option value="weekly">This Week</option>
                <option value="monthly">This Month</option>
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label className="form-label-modern small">Start</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                className="form-control-modern"
                value={filters.startDate}
                onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              />
            </Form.Group>
          </Col>
          <Col md={4}>
            <Form.Group>
              <Form.Label className="form-label-modern small">End</Form.Label>
              <Form.Control
                type="date"
                size="sm"
                className="form-control-modern"
                value={filters.endDate}
                onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              />
            </Form.Group>
          </Col>
        </Row>
      )}

      {data && !loading && (
        <div className="d-flex flex-wrap gap-3 small text-muted mb-2">
          <span><strong>{data.totals?.cartons_entered?.toLocaleString() || 0}</strong> cartons entered</span>
          <span><strong>{data.totals?.units_entered?.toLocaleString() || 0}</strong> units entered</span>
          <span>{data.start_date} → {data.end_date}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <Spinner animation="border" size="sm" />
          <p className="mt-2 text-muted small mb-0">Loading entry charts...</p>
        </div>
      ) : cartonsChart ? (
        <Row className="g-3">
          <Col lg={6}>
            <div style={{ height: chartHeight }}>
              <Bar data={cartonsChart} options={chartOptions('Cartons Entered Daily')} />
            </div>
          </Col>
          <Col lg={6}>
            <div style={{ height: chartHeight }}>
              <Bar data={unitsChart} options={chartOptions('Units Entered Daily')} />
            </div>
          </Col>
        </Row>
      ) : (
        <div className="text-center py-4 text-muted small">
          <i className="bi bi-bar-chart d-block fs-4 mb-1"></i>
          No warehouse entries in this period.
        </div>
      )}
    </>
  );
};

export default DailyEntryCharts;
