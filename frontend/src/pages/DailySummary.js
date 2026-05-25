import React, { useState, useEffect } from 'react';
import { useApi } from '../hooks/useApi';
import apiService from '../services/apiService';
import { downloadCsv } from '../utils/csvExport';
import { formatInternalPoDisplay } from '../utils/poDisplay';

const DailySummary = () => {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const { data, loading, error, refetch } = useApi(`/daily_summary.php?date=${selectedDate}`);

  useEffect(() => {
    refetch();
  }, [selectedDate]);

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const exportToCSV = () => {
    if (!data?.pos || data.pos.length === 0) return;

    const rows = [
      ['Goods Received Today', selectedDate],
      [],
      ['Customer', 'FTM PO', 'Ctns Expected', 'Units Expected', 'Ctns Entered Today', 'Units Entered Today', 'Ctns Pending', 'Units Pending'],
      ...data.pos.map(po => [
        po.customer || '',
        formatInternalPoDisplay(po.customer, po.internal_po_number),
        po.cartons_expected || 0,
        po.units_expected || 0,
        po.cartons_entered_today || 0,
        po.units_entered_today || 0,
        po.cartons_pending || 0,
        po.units_pending || 0
      ]),
      [
        'Total',
        '',
        data.totals?.cartons_expected || 0,
        data.totals?.units_expected || 0,
        data.totals?.cartons_entered_today || 0,
        data.totals?.units_entered_today || 0,
        data.totals?.cartons_pending || 0,
        data.totals?.units_pending || 0
      ]
    ];

    downloadCsv(`daily-summary-${selectedDate}.csv`, rows);
  };

  const exportToPDF = () => {
    if (!data?.pos || data.pos.length === 0) return;

    // Create HTML content for PDF
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Daily Summary Report - ${selectedDate}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            color: #1a1a1a;
          }
          .header p {
            margin: 5px 0;
            color: #666;
          }
          .report-date {
            text-align: center;
            font-size: 18px;
            margin: 20px 0;
            font-weight: bold;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #4a5568;
            color: white;
            font-weight: bold;
          }
          tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .total-row {
            background-color: #e2e8f0 !important;
            font-weight: bold;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 10px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 12px;
          }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>FTM Garments Warehouse</h1>
          <p>Daily Summary Report</p>
        </div>
        
        <div class="report-date">
          Goods Received on ${new Date(selectedDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </div>
        
        <table>
          <thead>
            <tr>
              <th rowspan="2">Customer</th>
              <th rowspan="2">PO Number</th>
              <th colspan="2" style="text-align: center; border-bottom: 1px solid #ddd;">Expected</th>
              <th colspan="2" style="text-align: center; border-bottom: 1px solid #ddd;">Entered Today</th>
              <th colspan="2" style="text-align: center; border-bottom: 1px solid #ddd;">Pending</th>
            </tr>
            <tr>
              <th style="text-align: right;">Ctns</th>
              <th style="text-align: right;">Units</th>
              <th style="text-align: right;">Ctns</th>
              <th style="text-align: right;">Units</th>
              <th style="text-align: right;">Ctns</th>
              <th style="text-align: right;">Units</th>
            </tr>
          </thead>
          <tbody>
            ${data.pos.map(po => `
              <tr>
                <td>${po.customer || ''}</td>
                <td>${formatInternalPoDisplay(po.customer, po.internal_po_number)}</td>
                <td style="text-align: right;">${(po.cartons_expected || 0)}</td>
                <td style="text-align: right;">${(po.units_expected || 0).toLocaleString()}</td>
                <td style="text-align: right;">${(po.cartons_entered_today || 0)}</td>
                <td style="text-align: right;">${(po.units_entered_today || 0).toLocaleString()}</td>
                <td style="text-align: right;">${(po.cartons_pending || 0)}</td>
                <td style="text-align: right;">${(po.units_pending || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="2">Total</td>
              <td style="text-align: right;">${(data.totals?.cartons_expected || 0)}</td>
              <td style="text-align: right;">${(data.totals?.units_expected || 0).toLocaleString()}</td>
              <td style="text-align: right;">${(data.totals?.cartons_entered_today || 0)}</td>
              <td style="text-align: right;">${(data.totals?.units_entered_today || 0).toLocaleString()}</td>
              <td style="text-align: right;">${(data.totals?.cartons_pending || 0)}</td>
              <td style="text-align: right;">${(data.totals?.units_pending || 0).toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>Generated on ${new Date().toLocaleString()}</p>
          <p>&copy; ${new Date().getFullYear()} FTM Garments Warehouse - All Rights Reserved</p>
        </div>
      </body>
      </html>
    `;

    // Open in new window and trigger print
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      
      // Wait for content to load then print
      setTimeout(() => {
        printWindow.print();
      }, 250);
    }
  };

  return (
    <div className="py-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="text-gradient mb-0">Daily Summary Report</h1>
        <div className="d-flex gap-2">
          <input
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={handleDateChange}
            max={new Date().toISOString().split('T')[0]}
          />
          <button
            className="btn-modern btn-modern-success"
            onClick={exportToCSV}
            disabled={!data?.pos?.length}
          >
            <i className="bi bi-file-earmark-spreadsheet"></i> Export CSV
          </button>
          <button
            className="btn-modern btn-modern-danger"
            onClick={exportToPDF}
            disabled={!data?.pos?.length}
          >
            <i className="bi bi-file-earmark-pdf"></i> Export PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-5">
          <div className="loading-spinner-modern mx-auto mb-3"></div>
          <p className="text-muted">Loading summary...</p>
        </div>
      ) : error ? (
        <div className="alert-modern alert-modern-danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>{error}</div>
        </div>
      ) : (
        <div className="modern-card">
          <div className="modern-card-header">
            <h5 className="mb-0">Goods Received on {new Date(selectedDate).toLocaleDateString()}</h5>
            <p className="small text-muted mb-0 mt-1">Only purchase orders with cartons physically received on this date</p>
          </div>
          <div className="modern-card-body p-0">
            <div className="table-responsive">
              <table className="table-modern mb-0">
                <thead>
                  <tr>
                    <th rowSpan="2">Customer</th>
                    <th rowSpan="2">PO Number</th>
                    <th colSpan="2" className="text-center" style={{borderBottom: '1px solid #dee2e6'}}>Expected</th>
                    <th colSpan="2" className="text-center" style={{borderBottom: '1px solid #dee2e6'}}>Entered Today</th>
                    <th colSpan="2" className="text-center" style={{borderBottom: '1px solid #dee2e6'}}>Pending</th>
                  </tr>
                  <tr>
                    <th className="text-end">Ctns</th>
                    <th className="text-end">Units</th>
                    <th className="text-end">Ctns</th>
                    <th className="text-end">Units</th>
                    <th className="text-end">Ctns</th>
                    <th className="text-end">Units</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.pos?.length > 0 ? (
                    <>
                      {data.pos.map((po, index) => (
                        <tr key={index}>
                          <td className="fw-medium">{po.customer}</td>
                          <td>{formatInternalPoDisplay(po.customer, po.internal_po_number)}</td>
                          <td className="text-end">{po.cartons_expected}</td>
                          <td className="text-end">{po.units_expected.toLocaleString()}</td>
                          <td className="text-end">{po.cartons_entered_today}</td>
                          <td className="text-end">{po.units_entered_today.toLocaleString()}</td>
                          <td className="text-end">{po.cartons_pending}</td>
                          <td className="text-end">{po.units_pending.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="table-active fw-bold">
                        <td colSpan="2">Total</td>
                        <td className="text-end">{data.totals.cartons_expected}</td>
                        <td className="text-end">{data.totals.units_expected.toLocaleString()}</td>
                        <td className="text-end">{data.totals.cartons_entered_today}</td>
                        <td className="text-end">{data.totals.units_entered_today.toLocaleString()}</td>
                        <td className="text-end">{data.totals.cartons_pending}</td>
                        <td className="text-end">{data.totals.units_pending.toLocaleString()}</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        <p className="text-muted mb-0">No data for selected date</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailySummary;
