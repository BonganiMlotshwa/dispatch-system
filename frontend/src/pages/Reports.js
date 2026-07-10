import React, { useState, useEffect, useCallback } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, Table, Badge, Modal, Spinner, Tab, Tabs } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatDaysToHumanReadable, getDaysBadgeColor } from '../utils/dateUtils';

// Configure axios with timeout
axios.defaults.timeout = 10000;

const Reports = () => {
  const [comprehensiveReport, setComprehensiveReport] = useState(null);
  const [warehouseInventory, setWarehouseInventory] = useState(null);
  const [timeBasedReports, setTimeBasedReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('comprehensive');
  const [timeBasedView, setTimeBasedView] = useState('list'); // 'list' or 'grid'

  // Report filters
  const [reportFilters, setReportFilters] = useState({
    period: 'all',
    startDate: '',
    endDate: '',
    timePeriod: 'daily',
    customer: 'all'
  });

  // Load comprehensive reports
  const loadComprehensiveReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'getComprehensiveReports', period: reportFilters.period });
      if (reportFilters.startDate && reportFilters.endDate) {
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      }
      if (reportFilters.customer && reportFilters.customer !== 'all') {
        params.append('customer', reportFilters.customer);
      }
      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`);
      if (response.data.success) {
        setComprehensiveReport(response.data);
      } else {
        setError(response.data.message || 'Failed to load comprehensive reports');
      }
    } catch (err) {
      setError('Failed to load comprehensive reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [reportFilters.period, reportFilters.startDate, reportFilters.endDate, reportFilters.customer]);

  // Load warehouse inventory
  const loadWarehouseInventory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_BASE_URL}/reports.php?action=getWarehouseInventory`);
      if (response.data.success) {
        setWarehouseInventory(response.data);
      } else {
        setError(response.data.message || 'Failed to load warehouse inventory');
      }
    } catch (err) {
      setError('Failed to load warehouse inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load time-based reports
  const loadTimeBasedReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: 'getTimeBasedReports', period: reportFilters.timePeriod });
      if (reportFilters.startDate && reportFilters.endDate) {
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      } else if (reportFilters.period !== 'all') {
        params.append('filter_period', reportFilters.period);
      }
      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`);
      if (response.data.success) {
        setTimeBasedReports(response.data.reports);
      } else {
        setError(response.data.message || 'Failed to load time-based reports');
      }
    } catch (err) {
      setError('Failed to load time-based reports. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [reportFilters.timePeriod, reportFilters.startDate, reportFilters.endDate, reportFilters.period]);

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setReportFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Export comprehensive report as CSV
  const exportComprehensiveCsv = async () => {
    try {
      const params = new URLSearchParams({
        action: 'generateComprehensiveCsvReport',
        period: reportFilters.period
      });
      if (reportFilters.startDate && reportFilters.endDate) {
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      }
      if (reportFilters.customer && reportFilters.customer !== 'all') {
        params.append('customer', reportFilters.customer);
      }
      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`, { responseType: 'blob' });
      if (response.data) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `comprehensive_report_${reportFilters.customer !== 'all' ? reportFilters.customer + '_' : ''}${reportFilters.period}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      setError('Failed to export CSV report');
    }
  };

  const exportComprehensivePdf = async () => {
    try {
      const params = new URLSearchParams({
        action: 'generateComprehensivePdfReport',
        period: reportFilters.period
      });
      if (reportFilters.startDate && reportFilters.endDate) {
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      }
      if (reportFilters.customer && reportFilters.customer !== 'all') {
        params.append('customer', reportFilters.customer);
      }
      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`);
      if (response.data.success) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(response.data.html);
        printWindow.document.close();
        printWindow.print();
      } else {
        setError(response.data.message || 'Failed to generate PDF report');
      }
    } catch (err) {
      setError('Failed to export PDF report');
    }
  };

  // Export time-based report as CSV
  const exportTimeBasedCsv = async () => {
    try {
      const params = new URLSearchParams({
        action: 'generateTimeBasedCsvReport',
        period: reportFilters.timePeriod
      });

      if (reportFilters.startDate && reportFilters.endDate) {
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      } else if (reportFilters.period !== 'all') {
        params.append('filter_period', reportFilters.period);
      }

      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`, {
        responseType: 'blob'
      });

      if (response.data) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `time_based_report_${reportFilters.timePeriod}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError('Failed to export CSV report');
    }
  };

  // Export time-based report as PDF
  const exportTimeBasedPdf = async () => {
    try {
      const params = new URLSearchParams({
        action: 'generateTimeBasedPdfReport',
        period: reportFilters.timePeriod
      });

      if (reportFilters.startDate && reportFilters.endDate) {
        params.append('start_date', reportFilters.startDate);
        params.append('end_date', reportFilters.endDate);
      } else if (reportFilters.period !== 'all') {
        params.append('filter_period', reportFilters.period);
      }

      const response = await axios.get(`${API_BASE_URL}/reports.php?${params}`);

      if (response.data.success) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(response.data.html);
        printWindow.document.close();
        printWindow.print();
      } else {
        setError(response.data.message || 'Failed to generate PDF report');
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export PDF report');
    }
  };

  // Export inventory report as CSV
  const exportInventoryCsv = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports.php?action=generateInventoryCsvReport`, {
        responseType: 'blob'
      });

      if (response.data) {
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `warehouse_inventory_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (err) {
      console.error('Error exporting CSV:', err);
      setError('Failed to export CSV report');
    }
  };

  // Export inventory report as PDF
  const exportInventoryPdf = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/reports.php?action=generateInventoryPdfReport`);

      if (response.data.success) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(response.data.html);
        printWindow.document.close();
        printWindow.print();
      } else {
        setError(response.data.message || 'Failed to generate PDF report');
      }
    } catch (err) {
      console.error('Error exporting PDF:', err);
      setError('Failed to export PDF report');
    }
  };

  // Load data when component mounts or filters change
  useEffect(() => {
    if (activeTab === 'comprehensive') {
      loadComprehensiveReports();
    } else if (activeTab === 'inventory') {
      loadWarehouseInventory();
    } else if (activeTab === 'timebased') {
      loadTimeBasedReports();
    }
  }, [activeTab, loadComprehensiveReports, loadWarehouseInventory, loadTimeBasedReports]);

  return (
    <div className="py-2">
      <div className="mb-4">
        <h1 className="text-gradient mb-0">Reports</h1>
        <p className="text-muted mt-2">Comprehensive warehouse reports and analytics</p>
      </div>

      {/* Filters */}
      <div className="modern-card mb-4">
        <div className="modern-card-header">
          <h5 className="mb-0"><i className="bi bi-funnel me-2"></i>Report Filters</h5>
        </div>
        <div className="modern-card-body">
          <Row className="g-3">
            <Col md={activeTab === 'timebased' ? 3 : activeTab === 'comprehensive' ? 3 : 4}>
              <Form.Group>
                <Form.Label className="form-label-modern">Filter by Period</Form.Label>
                <Form.Select
                  value={reportFilters.period}
                  onChange={(e) => handleFilterChange('period', e.target.value)}
                  className="form-control-modern"
                >
                  <option value="all">All Time</option>
                  <option value="daily">Today</option>
                  <option value="weekly">This Week</option>
                  <option value="monthly">This Month</option>
                  <option value="yearly">This Year</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={activeTab === 'timebased' ? 3 : activeTab === 'comprehensive' ? 3 : 4}>
              <Form.Group>
                <Form.Label className="form-label-modern">Start Date</Form.Label>
                <Form.Control
                  type="date"
                  value={reportFilters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="form-control-modern"
                />
              </Form.Group>
            </Col>
            <Col md={activeTab === 'timebased' ? 3 : activeTab === 'comprehensive' ? 3 : 4}>
              <Form.Group>
                <Form.Label className="form-label-modern">End Date</Form.Label>
                <Form.Control
                  type="date"
                  value={reportFilters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="form-control-modern"
                />
              </Form.Group>
            </Col>
            {activeTab === 'comprehensive' && (
              <Col md={3}>
                <Form.Group>
                  <Form.Label className="form-label-modern">Customer</Form.Label>
                  <Form.Select
                    value={reportFilters.customer}
                    onChange={(e) => handleFilterChange('customer', e.target.value)}
                    className="form-control-modern"
                  >
                    <option value="all">All Customers</option>
                    <option value="MRP">MRP</option>
                    <option value="OTB">OTB</option>
                    <option value="OBSW">OBSW</option>
                    <option value="Other">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            )}
            {activeTab === 'timebased' && (
              <Col md={3}>
                <Form.Group>
                  <Form.Label className="form-label-modern">Group By (Time-Based)</Form.Label>
                  <Form.Select
                    value={reportFilters.timePeriod}
                    onChange={(e) => handleFilterChange('timePeriod', e.target.value)}
                    className="form-control-modern"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            )}
          </Row>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="danger" className="mt-3 alert-modern alert-modern-danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <strong>Error:</strong> {error}
          </div>
        </Alert>
      )}

      {/* Reports Tabs */}
      <Tabs activeKey={activeTab} onSelect={(k) => setActiveTab(k)} className="mb-4">
        <Tab eventKey="comprehensive" title="Comprehensive Report">
          <div className="modern-card">
            <div className="modern-card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="bi bi-bar-chart me-2"></i>Comprehensive Report</h5>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={exportComprehensiveCsv}
                  disabled={loading}
                  className="btn-modern btn-modern-outline-primary"
                >
                  <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                  Export CSV
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={exportComprehensivePdf}
                  disabled={loading}
                  className="btn-modern btn-modern-outline-danger"
                >
                  <i className="bi bi-file-earmark-pdf me-1"></i>
                  Export PDF
                </Button>
              </div>
            </div>
            <div className="modern-card-body">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Loading comprehensive report...</p>
                </div>
              ) : comprehensiveReport ? (
                <div>
                  {/* Summary Statistics */}
                  <Row className="g-3 mb-4">
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-primary">{comprehensiveReport.summary.total_cartons.toLocaleString()}</div>
                          <div className="text-muted">Total Cartons Expected</div>
                          <small className="text-muted">{comprehensiveReport.summary.total_units.toLocaleString()} units</small>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-success">{comprehensiveReport.summary.cartons_entered.toLocaleString()}</div>
                          <div className="text-muted">Cartons Received</div>
                          <small className="text-muted">{comprehensiveReport.summary.units_entered.toLocaleString()} units</small>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-warning">{(comprehensiveReport.summary.cartons_pending || 0).toLocaleString()}</div>
                          <div className="text-muted">Pending Cartons</div>
                          <small className="text-muted">{(comprehensiveReport.summary.units_pending || 0).toLocaleString()} units</small>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-info">{comprehensiveReport.summary.cartons_in_warehouse.toLocaleString()}</div>
                          <div className="text-muted">In Warehouse</div>
                          <small className="text-muted">{comprehensiveReport.summary.cartons_shipped.toLocaleString()} shipped</small>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* Top Orders */}
                  <div className="mb-4">
                    <h5>Top Orders by Carton Count</h5>
                    <div className="table-responsive">
                      <Table className="table-modern">
                        <thead>
                          <tr>
                            <th>Customer</th>
                            <th>FTM PO</th>
                            <th>Customer PO</th>
                            <th>Total Cartons</th>
                            <th>Total Units</th>
                            <th>Pending Cartons</th>
                            <th>Pending Units</th>
                            <th>In Warehouse</th>
                            <th>Shipped</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comprehensiveReport.top_orders.map((order, index) => (
                            <tr key={index}>
                              <td>
                                <Badge bg="primary" className="badge-modern badge-modern-primary">
                                  {order.customer || 'MRP'}
                                </Badge>
                              </td>
                              <td>
                                <span className="fw-medium">{order.ftm_po}</span>
                              </td>
                              <td>
                                <span className="text-muted small">{order.customer_po || '—'}</span>
                              </td>
                              <td>
                                <Badge bg="primary" className="badge-modern badge-modern-primary">
                                  {order.carton_count}
                                </Badge>
                              </td>
                              <td>{order.total_units.toLocaleString()}</td>
                              <td>
                                <Badge bg="warning" className="badge-modern badge-modern-warning">
                                  {order.cartons_pending}
                                </Badge>
                              </td>
                              <td>{order.units_pending.toLocaleString()}</td>
                              <td>
                                <Badge bg="info" className="badge-modern badge-modern-info">
                                  {order.cartons_in_warehouse}
                                </Badge>
                              </td>
                              <td>
                                <Badge bg="success" className="badge-modern badge-modern-success">
                                  {order.cartons_shipped}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <i className="bi bi-bar-chart fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No comprehensive report data available</p>
                </div>
              )}
            </div>
          </div>
        </Tab>

        <Tab eventKey="inventory" title="Warehouse Inventory">
          <div className="modern-card">
            <div className="modern-card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="bi bi-boxes me-2"></i>Warehouse Inventory</h5>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={exportInventoryCsv}
                  disabled={loading || !warehouseInventory}
                  className="btn-modern btn-modern-outline-primary"
                >
                  <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                  Export Excel
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={exportInventoryPdf}
                  disabled={loading || !warehouseInventory}
                  className="btn-modern btn-modern-outline-danger"
                >
                  <i className="bi bi-file-earmark-pdf me-1"></i>
                  Export PDF
                </Button>
              </div>
            </div>
            <div className="modern-card-body">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Loading warehouse inventory...</p>
                </div>
              ) : warehouseInventory ? (
                <div>
                  {/* Inventory Summary */}
                  <Row className="g-3 mb-4">
                    <Col md={2}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-primary">{warehouseInventory.total_cartons.toLocaleString()}</div>
                          <div className="text-muted">Total Cartons</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={2}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-info">{(warehouseInventory.total_units || 0).toLocaleString()}</div>
                          <div className="text-muted">Total Units</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={2}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-success">{warehouseInventory.total_orders.toLocaleString()}</div>
                          <div className="text-muted">Active Orders</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={2}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-secondary">{(warehouseInventory.total_legacy_orders || 0).toLocaleString()}</div>
                          <div className="text-muted">Total Legacy Orders</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={2}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-danger">
                            {formatDaysToHumanReadable(warehouseInventory.max_days_in_warehouse || 0)}
                          </div>
                          <div className="text-muted">Longest in Warehouse</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={2}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-warning">
                            {formatDaysToHumanReadable(Math.round(warehouseInventory.avg_days_in_warehouse || 0))}
                          </div>
                          <div className="text-muted">Average Time in Warehouse</div>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* Inventory Details */}
                  <div className="table-responsive">
                    <Table className="table-modern">
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>FTM PO</th>
                          <th>Customer PO</th>
                          <th>File Name</th>
                          <th>Import Date</th>
                          <th>Cartons</th>
                          <th>Units</th>
                          <th>Pending Cartons</th>
                          <th>Pending Units</th>
                          <th>Time in Warehouse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warehouseInventory.inventory.map((item, index) => (
                          <tr key={index}>
                            <td>
                              <Badge bg="primary" className="badge-modern badge-modern-primary">
                                {item.customer || 'MRP'}
                              </Badge>
                            </td>
                            <td>
                              <span className="fw-medium">{item.ftm_po}</span>
                            </td>
                            <td>
                              <span className="text-muted small">{item.customer_po || '—'}</span>
                            </td>
                            <td>{item.file_name}</td>
                            <td>{new Date(item.import_date).toLocaleDateString()}</td>
                            <td>
                              <Badge bg="primary" className="badge-modern badge-modern-primary">
                                {item.total_cartons}
                              </Badge>
                            </td>
                            <td>{item.total_units.toLocaleString()}</td>
                            <td>
                              <Badge bg="warning" className="badge-modern badge-modern-warning">
                                {item.cartons_pending || 0}
                              </Badge>
                            </td>
                            <td>{(item.units_pending || 0).toLocaleString()}</td>
                            <td>
                              <Badge
                                bg={getDaysBadgeColor(item.oldest_carton_days)}
                                className={`badge-modern badge-modern-${getDaysBadgeColor(item.oldest_carton_days)}`}
                              >
                                {formatDaysToHumanReadable(item.oldest_carton_days)}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <i className="bi bi-boxes fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No warehouse inventory data available</p>
                </div>
              )}
            </div>
          </div>
        </Tab>

        <Tab eventKey="timebased" title="Time-Based Analysis">
          <div className="modern-card">
            <div className="modern-card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="bi bi-calendar me-2"></i>Time-Based Analysis ({reportFilters.timePeriod})</h5>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={exportTimeBasedCsv}
                  disabled={loading || timeBasedReports.length === 0}
                  className="btn-modern btn-modern-outline-primary"
                >
                  <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                  Export Excel
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={exportTimeBasedPdf}
                  disabled={loading || timeBasedReports.length === 0}
                  className="btn-modern btn-modern-outline-danger"
                >
                  <i className="bi bi-file-earmark-pdf me-1"></i>
                  Export PDF
                </Button>
              </div>
            </div>
            <div className="modern-card-body">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" />
                  <p className="mt-2 text-muted">Loading time-based reports...</p>
                </div>
              ) : timeBasedReports.length > 0 ? (
                <div>
                  {/* Summary Statistics */}
                  <Row className="g-3 mb-4">
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-info">
                            {timeBasedReports.reduce((sum, r) => sum + parseInt(r.cartons_received || 0), 0).toLocaleString()}
                          </div>
                          <div className="text-muted">Cartons Expected</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-primary">
                            {timeBasedReports.reduce((sum, r) => sum + parseInt(r.units_received || 0), 0).toLocaleString()}
                          </div>
                          <div className="text-muted">Units Expected</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-success">
                            {timeBasedReports.reduce((sum, r) => sum + parseInt(r.cartons_shipped || 0), 0).toLocaleString()}
                          </div>
                          <div className="text-muted">Cartons Shipped</div>
                        </div>
                      </div>
                    </Col>
                    <Col md={3}>
                      <div className="modern-card text-center">
                        <div className="modern-card-body">
                          <div className="fs-2 fw-bold text-warning">
                            {new Set(timeBasedReports.map(r => r.po_number)).size}
                          </div>
                          <div className="text-muted">Total POs</div>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* PO Details — view toggle */}
                  <div className="mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h5 className="mb-0">PO Details by {reportFilters.timePeriod.charAt(0).toUpperCase() + reportFilters.timePeriod.slice(1)} Period</h5>
                      <div className="btn-group btn-group-sm">
                        <Button
                          variant={timeBasedView === 'list' ? 'primary' : 'outline-secondary'}
                          size="sm"
                          onClick={() => setTimeBasedView('list')}
                          title="List view"
                        >
                          <i className="bi bi-list-ul"></i>
                        </Button>
                        <Button
                          variant={timeBasedView === 'grid' ? 'primary' : 'outline-secondary'}
                          size="sm"
                          onClick={() => setTimeBasedView('grid')}
                          title="Grid view"
                        >
                          <i className="bi bi-grid-3x3-gap"></i>
                        </Button>
                      </div>
                    </div>

                    {/* LIST VIEW */}
                    {timeBasedView === 'list' && (
                      <div className="table-responsive">
                        <Table className="table-modern">
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>PO Number</th>
                              <th>Customer PO</th>
                              <th>Total Cartons</th>
                              <th>Total Units</th>
                              <th>Pending Cartons</th>
                              <th>Pending Units</th>
                              <th>Cartons Entered</th>
                              <th>Cartons Shipped</th>
                            </tr>
                          </thead>
                          <tbody>
                            {timeBasedReports.map((report, index) => (
                              <tr key={index}>
                                <td>
                                  <span className="fw-medium">
                                    {reportFilters.timePeriod === 'daily' && report.date}
                                    {reportFilters.timePeriod === 'weekly' && `Week of ${report.week_start}`}
                                    {reportFilters.timePeriod === 'monthly' && report.month}
                                    {reportFilters.timePeriod === 'yearly' && report.year}
                                  </span>
                                </td>
                                <td><span className="fw-medium">{report.po_number}</span></td>
                                <td><span className="text-muted small">{report.customer_po || '—'}</span></td>
                                <td>
                                  <Badge bg="info" className="badge-modern badge-modern-info">{report.cartons_received}</Badge>
                                </td>
                                <td>{report.units_received.toLocaleString()}</td>
                                <td>
                                  <Badge bg="warning" className="badge-modern badge-modern-warning">{report.cartons_pending || 0}</Badge>
                                </td>
                                <td>{(report.units_pending || 0).toLocaleString()}</td>
                                <td>
                                  <Badge bg="primary" className="badge-modern badge-modern-primary">{report.cartons_entered}</Badge>
                                </td>
                                <td>
                                  <Badge bg="success" className="badge-modern badge-modern-success">{report.cartons_shipped}</Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    )}

                    {/* GRID VIEW */}
                    {timeBasedView === 'grid' && (
                      <Row className="g-3">
                        {timeBasedReports.map((report, index) => {
                          const period =
                            reportFilters.timePeriod === 'daily' ? report.date :
                            reportFilters.timePeriod === 'weekly' ? `Wk ${report.week_start}` :
                            reportFilters.timePeriod === 'monthly' ? report.month :
                            String(report.year);
                          const shipped = parseInt(report.cartons_shipped || 0);
                          const total = parseInt(report.cartons_received || 0);
                          const pct = total > 0 ? Math.round((shipped / total) * 100) : 0;
                          return (
                            <Col key={index} xs={12} sm={6} md={4} lg={3}>
                              <div className="modern-card h-100">
                                <div className="modern-card-body">
                                  <div className="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                      <div className="fw-bold small">{report.po_number}</div>
                                      {report.customer_po && report.customer_po !== 'N/A' && (
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>{report.customer_po}</div>
                                      )}
                                    </div>
                                    <Badge bg="light" text="dark" className="small">{period}</Badge>
                                  </div>
                                  <div className="row g-1 text-center mb-2">
                                    <div className="col-6">
                                      <div className="fw-bold text-info">{report.cartons_received}</div>
                                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>Cartons</div>
                                    </div>
                                    <div className="col-6">
                                      <div className="fw-bold text-primary">{parseInt(report.units_received || 0).toLocaleString()}</div>
                                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>Units</div>
                                    </div>
                                    <div className="col-6">
                                      <div className="fw-bold text-warning">{report.cartons_pending || 0}</div>
                                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>Pending</div>
                                    </div>
                                    <div className="col-6">
                                      <div className="fw-bold text-success">{shipped}</div>
                                      <div className="text-muted" style={{ fontSize: '0.7rem' }}>Shipped</div>
                                    </div>
                                  </div>
                                  <div className="progress" style={{ height: 6 }}>
                                    <div
                                      className={`progress-bar bg-${pct === 100 ? 'success' : pct > 0 ? 'primary' : 'secondary'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                  <div className="text-end text-muted mt-1" style={{ fontSize: '0.7rem' }}>{pct}% shipped</div>
                                </div>
                              </div>
                            </Col>
                          );
                        })}
                      </Row>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-5">
                  <i className="bi bi-calendar fs-1 text-muted"></i>
                  <p className="text-muted mt-2">No time-based report data available</p>
                </div>
              )}
            </div>
          </div>
        </Tab>
      </Tabs>
    </div>
  );
};

export default Reports;
