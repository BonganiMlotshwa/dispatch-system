import React, { useState } from 'react';
import DailyEntryCharts from '../components/DailyEntryCharts';

const DailyEntryReport = () => {
  const [filters] = useState({ period: 'all', startDate: '', endDate: '' });

  return (
    <div className="py-2">
      <div className="mb-4">
        <h1 className="text-gradient mb-0">Daily Entry Report</h1>
        <p className="text-muted mt-2">
          Cartons and units entered into the warehouse daily, by customer
        </p>
      </div>

      <div className="modern-card">
        <div className="modern-card-header">
          <h5 className="mb-0"><i className="bi bi-bar-chart-line me-2"></i>Entry by Customer</h5>
        </div>
        <div className="modern-card-body">
          <DailyEntryCharts
            period={filters.period}
            startDate={filters.startDate}
            endDate={filters.endDate}
            chartHeight={360}
            showFilters
          />
        </div>
      </div>
    </div>
  );
};

export default DailyEntryReport;
