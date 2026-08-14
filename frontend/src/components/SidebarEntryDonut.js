import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useTheme } from '../contexts/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

/** Mockup-style segment colors: blue, green, orange (+ gray fallback) */
const CUSTOMER_COLORS = {
  MRP: { bg: '#93c5fd', border: '#3b82f6' },
  OTB: { bg: '#86efac', border: '#22c55e' },
  OBSW: { bg: '#fdba74', border: '#f97316' },
  Other: { bg: '#d1d5db', border: '#9ca3af' }
};

const SidebarEntryDonut = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const [byCustomer, setByCustomer] = useState({});
  const [totals, setTotals] = useState({ cartons: 0, units: 0 });
  const [loading, setLoading] = useState(true);
  const [periodLabel, setPeriodLabel] = useState('today');

  const loadData = useCallback(async (signal) => {
    setLoading(true);
    try {
      let rows = [];
      let label = 'today';

      const todayRes = await axios.get(
        `${API_BASE_URL}/reports.php?action=getDailyEnteredByCustomer&filter_period=daily`,
        { signal }
      );
      rows = todayRes.data?.series || [];

      if (!rows.length) {
        const weekRes = await axios.get(
          `${API_BASE_URL}/reports.php?action=getDailyEnteredByCustomer&filter_period=weekly`,
          { signal }
        );
        rows = weekRes.data?.series || [];
        label = 'this week';
      }

      const grouped = {};
      rows.forEach((row) => {
        const c = row.customer || 'Other';
        if (!grouped[c]) grouped[c] = { cartons: 0, units: 0 };
        grouped[c].cartons += Number(row.cartons_entered || 0);
        grouped[c].units += Number(row.units_entered || 0);
      });

      setByCustomer(grouped);
      setPeriodLabel(label);
      setTotals({
        cartons: rows.reduce((s, r) => s + Number(r.cartons_entered || 0), 0),
        units: rows.reduce((s, r) => s + Number(r.units_entered || 0), 0)
      });
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'CanceledError') return;
      console.error('Sidebar entry chart:', err);
      setByCustomer({});
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadData(controller.signal);
    const interval = setInterval(() => loadData(controller.signal), 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [loadData]);

  const buildDonut = useCallback((metric) => {
    const customers = Object.keys(byCustomer).filter((c) => byCustomer[c][metric] > 0);
    if (customers.length === 0) return null;

    return {
      labels: customers,
      datasets: [
        {
          data: customers.map((c) => byCustomer[c][metric]),
          backgroundColor: customers.map((c) => (CUSTOMER_COLORS[c] || CUSTOMER_COLORS.Other).bg),
          borderColor: isDark ? '#1f2937' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 4
        }
      ]
    };
  }, [byCustomer, isDark]);

  const cartonsData = useMemo(() => buildDonut('cartons'), [buildDonut]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: isDark ? '#1f2937' : '#fff',
        titleColor: isDark ? '#fff' : '#111',
        bodyColor: isDark ? '#d1d5db' : '#374151',
        callbacks: {
          label: (ctx) => {
            const c = ctx.label;
            const d = byCustomer[c];
            if (!d) return '';
            return [`Cartons: ${d.cartons}`, `Units: ${d.units}`];
          }
        }
      }
    }
  }), [isDark, byCustomer]);

  const customers = Object.keys(byCustomer).filter(
    (c) => byCustomer[c].cartons > 0 || byCustomer[c].units > 0
  );

  const hasData = customers.length > 0;

  return (
    <div className="sidebar-under-reports-chart">
      <p className="sidebar-under-reports-caption">
        Ctns &amp; units entered daily per customer
      </p>

      {loading ? (
        <div className="sidebar-under-reports-loading">
          <span className="spinner-border spinner-border-sm text-secondary" />
        </div>
      ) : hasData ? (
        <>
          <div className="sidebar-under-reports-wheel">
            {cartonsData && <Doughnut data={cartonsData} options={chartOptions} />}
          </div>

          <ul className="sidebar-under-reports-legend">
            {customers.map((c) => (
              <li key={c}>
                <span
                  className="sidebar-under-reports-swatch"
                  style={{ background: (CUSTOMER_COLORS[c] || CUSTOMER_COLORS.Other).bg }}
                />
                <span className="sidebar-under-reports-legend-label">{c}</span>
                <span className="sidebar-under-reports-legend-values">
                  {byCustomer[c].cartons} ctns · {byCustomer[c].units} units
                </span>
              </li>
            ))}
          </ul>

          <p className="sidebar-under-reports-period">
            {totals.cartons} ctns · {totals.units.toLocaleString()} units ({periodLabel})
          </p>
        </>
      ) : (
        <p className="sidebar-under-reports-empty">No entries {periodLabel}</p>
      )}
    </div>
  );
};

export default SidebarEntryDonut;
