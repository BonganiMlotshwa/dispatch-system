import React, { useState, useEffect } from 'react';
import { Alert, Form, Table, Badge, Button, Modal } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const TruckSummary = () => {
  const [trucks, setTrucks] = useState([]);
  const [summary, setSummary] = useState({ total_trucks: 0, total_cartons: 0, total_units: 0 });
  const [availableWeeks, setAvailableWeeks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
  const [editForm, setEditForm] = useState({
    truck_reg: '',
    driver_name: '',
    shipment_date: '',
    shipment_week: '',
    remarks: ''
  });
  
  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingTruck, setDeletingTruck] = useState(null);
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');
  
  // Filters
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: '',
    week: '',
    truck_reg: ''
  });

  useEffect(() => {
    fetchTruckSummary();
  }, []);

  const fetchTruckSummary = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.week) params.append('week', filters.week);
      if (filters.truck_reg) params.append('truck_reg', filters.truck_reg);
      
      const response = await axios.get(`${API_BASE_URL}/truck_summary.php?${params.toString()}`);
      
      if (response.data.success) {
        setTrucks(response.data.trucks);
        setSummary(response.data.summary);
        setAvailableWeeks(response.data.available_weeks);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load truck summary');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchTruckSummary();
  };

  const handleReset = () => {
    setFilters({
      start_date: '',
      end_date: '',
      week: '',
      truck_reg: ''
    });
    setTimeout(() => fetchTruckSummary(), 100);
  };

  const buildFilterParams = () => {
    const params = new URLSearchParams();
    if (filters.start_date) params.append('start_date', filters.start_date);
    if (filters.end_date) params.append('end_date', filters.end_date);
    if (filters.week) params.append('week', filters.week);
    if (filters.truck_reg) params.append('truck_reg', filters.truck_reg);
    return params;
  };

  const handleExport = (truckId, format) => {
    window.open(`${API_BASE_URL}/truck_shipment_export.php?id=${truckId}&format=${format}`, '_blank');
  };

  const handleReportExport = (format) => {
    const params = buildFilterParams();
    params.append('format', format);
    window.open(`${API_BASE_URL}/truck_summary_export.php?${params.toString()}`, '_blank');
  };

  const handleEditClick = (truck) => {
    setEditingTruck(truck);
    setEditForm({
      truck_reg: truck.truck_reg || '',
      driver_name: truck.driver_name || '',
      shipment_date: truck.shipment_date ? truck.shipment_date.split(' ')[0] : '',
      shipment_week: truck.shipment_week || '',
      remarks: truck.remarks || ''
    });
    setShowEditModal(true);
  };

  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSaveEdit = async () => {
    if (!editingTruck) return;
    setLoading(true);
    setError('');
    try {
      const response = await axios.put(`${API_BASE_URL}/truck_shipment.php`, {
        id: editingTruck.id,
        shipment_date: editForm.shipment_date,
        shipment_week: editForm.shipment_week,
        truck_reg: editForm.truck_reg,
        driver_name: editForm.driver_name,
        remarks: editForm.remarks
      });
      if (response.data.success) {
        setShowEditModal(false);
        setEditingTruck(null);
        await fetchTruckSummary();
      } else {
        setError(response.data.message || 'Failed to update truck');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update truck');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (truck) => {
    setDeletingTruck(truck);
    setDeleteCode(''); // Always reset code for fresh prompt
    setDeleteError('');
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTruck) return;
    if (!deleteCode.trim()) {
      setDeleteError('Please enter the admin code');
      return;
    }
    
    setLoading(true);
    setDeleteError('');
    
    try {
      const response = await axios.post(`${API_BASE_URL}/admin_delete.php`, {
        delete_type: 'truck_shipment',
        id: deletingTruck.id,
        admin_code: deleteCode.trim()
      });
      
      if (response.data.success) {
        setShowDeleteModal(false);
        setDeletingTruck(null);
        setDeleteCode(''); // Clear code after successful delete
        await fetchTruckSummary();
      } else {
        setDeleteError(response.data.message || 'Failed to delete truck');
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Invalid admin code or deletion failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
    setDeletingTruck(null);
    setDeleteCode(''); // Always clear code when closing
    setDeleteError('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="py-2">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 className="text-gradient mb-0">Truck Summary</h1>
          <p className="text-muted mb-0">View and filter truck shipments with carton and unit counts</p>
        </div>
        <div className="d-flex gap-2">
          <Button
            variant="outline-success"
            onClick={() => handleReportExport('csv')}
            disabled={loading || trucks.length === 0}
          >
            <i className="bi bi-file-earmark-spreadsheet me-1"></i>
            Export report CSV
          </Button>
          <Button
            variant="outline-danger"
            onClick={() => handleReportExport('pdf')}
            disabled={loading || trucks.length === 0}
          >
            <i className="bi bi-file-earmark-pdf me-1"></i>
            Export report PDF
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="modern-card mb-4">
        <div className="modern-card-header">
          <h5 className="mb-0"><i className="bi bi-funnel me-2"></i>Filters</h5>
        </div>
        <div className="modern-card-body">
          <Form onSubmit={handleSearch}>
            <div className="row g-3">
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="start_date"
                    value={filters.start_date}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="end_date"
                    value={filters.end_date}
                    onChange={handleFilterChange}
                  />
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Week</Form.Label>
                  <Form.Select
                    name="week"
                    value={filters.week}
                    onChange={handleFilterChange}
                  >
                    <option value="">All Weeks</option>
                    {availableWeeks.map(week => (
                      <option key={week} value={week}>{week}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </div>
              <div className="col-md-3">
                <Form.Group>
                  <Form.Label>Truck Registration</Form.Label>
                  <Form.Control
                    type="text"
                    name="truck_reg"
                    value={filters.truck_reg}
                    onChange={handleFilterChange}
                    placeholder="Search truck..."
                  />
                </Form.Group>
              </div>
            </div>
            <div className="d-flex gap-2 mt-3">
              <Button variant="primary" type="submit" disabled={loading}>
                <i className="bi bi-search me-1"></i>
                {loading ? 'Searching...' : 'Search'}
              </Button>
              <Button variant="secondary" onClick={handleReset} disabled={loading}>
                <i className="bi bi-arrow-clockwise me-1"></i>
                Reset
              </Button>
            </div>
          </Form>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="modern-card bg-primary text-white">
            <div className="modern-card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-white-50 mb-1">Total Trucks</h6>
                  <h2 className="mb-0">{summary.total_trucks}</h2>
                </div>
                <div className="fs-1 opacity-50">
                  <i className="bi bi-truck"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="modern-card bg-success text-white">
            <div className="modern-card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-white-50 mb-1">Total Cartons</h6>
                  <h2 className="mb-0">{summary.total_cartons.toLocaleString()}</h2>
                </div>
                <div className="fs-1 opacity-50">
                  <i className="bi bi-box-seam"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="modern-card bg-info text-white">
            <div className="modern-card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="text-white-50 mb-1">Total Units</h6>
                  <h2 className="mb-0">{summary.total_units.toLocaleString()}</h2>
                </div>
                <div className="fs-1 opacity-50">
                  <i className="bi bi-stack"></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          <i className="bi bi-exclamation-triangle me-2"></i>
          {error}
        </Alert>
      )}

      {/* Trucks Table */}
      <div className="modern-card">
        <div className="modern-card-header">
          <h5 className="mb-0">
            <i className="bi bi-list-ul me-2"></i>
            Truck Shipments ({trucks.length})
          </h5>
        </div>
        <div className="modern-card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="mt-2 text-muted">Loading trucks...</p>
            </div>
          ) : trucks.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-inbox fs-1 text-muted"></i>
              <p className="mt-2 text-muted">No trucks found for the selected filters</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Date</th>
                    <th>Week</th>
                    <th>Truck Reg</th>
                    <th>Driver</th>
                    <th>Customers</th>
                    <th className="text-end">POs</th>
                    <th className="text-end">Cartons</th>
                    <th className="text-end">Units</th>
                    <th className="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {trucks.map((truck) => (
                    <tr key={truck.id}>
                      <td>
                        <strong>{formatDate(truck.shipment_date)}</strong>
                      </td>
                      <td>
                        {truck.shipment_week ? (
                          <Badge bg="secondary">{truck.shipment_week}</Badge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td>
                        <strong className="text-primary">{truck.truck_reg}</strong>
                      </td>
                      <td>{truck.driver_name || '-'}</td>
                      <td>
                        <small className="text-muted">{truck.customers || '-'}</small>
                      </td>
                      <td className="text-end">
                        <Badge bg="info">{truck.total_pos}</Badge>
                      </td>
                      <td className="text-end">
                        <strong>{truck.total_cartons.toLocaleString()}</strong>
                      </td>
                      <td className="text-end">
                        <strong>{truck.total_units.toLocaleString()}</strong>
                      </td>
                      <td className="text-center">
                        <div className="btn-group btn-group-sm">
                          <button
                            className="btn btn-outline-warning"
                            onClick={() => handleEditClick(truck)}
                            title="Edit driver & truck info"
                          >
                            <i className="bi bi-pencil"></i>
                          </button>
                          <button
                            className="btn btn-outline-primary"
                            onClick={() => handleExport(truck.id, 'csv')}
                            title="Export to CSV"
                          >
                            <i className="bi bi-file-earmark-spreadsheet"></i>
                          </button>
                          <button
                            className="btn btn-outline-secondary"
                            onClick={() => handleExport(truck.id, 'pdf')}
                            title="Export to PDF"
                          >
                            <i className="bi bi-file-earmark-pdf"></i>
                          </button>
                          <button
                            className="btn btn-outline-danger"
                            onClick={() => handleDeleteClick(truck)}
                            title="Delete truck shipment"
                          >
                            <i className="bi bi-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </div>
      </div>

      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-pencil me-2"></i>
            Edit Truck / Driver
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Truck Registration</Form.Label>
              <Form.Control
                name="truck_reg"
                value={editForm.truck_reg}
                onChange={handleEditFormChange}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Driver Name</Form.Label>
              <Form.Control
                name="driver_name"
                value={editForm.driver_name}
                onChange={handleEditFormChange}
                placeholder="First and surname"
              />
            </Form.Group>
            <div className="row g-2">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Shipment Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="shipment_date"
                    value={editForm.shipment_date}
                    onChange={handleEditFormChange}
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Week</Form.Label>
                  <Form.Control
                    name="shipment_week"
                    value={editForm.shipment_week}
                    onChange={handleEditFormChange}
                    placeholder="e.g. Wk16"
                  />
                </Form.Group>
              </div>
            </div>
            <Form.Group>
              <Form.Label>Remarks</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="remarks"
                value={editForm.remarks}
                onChange={handleEditFormChange}
                placeholder="e.g. Incomplete load — goods arriving later"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal with Code Protection */}
      <Modal show={showDeleteModal} onHide={handleDeleteCancel} centered>
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title>
            <i className="bi bi-exclamation-triangle me-2"></i>
            Delete Truck Shipment
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deletingTruck && (
            <div className="mb-3">
              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                <strong>Warning:</strong> You are about to delete truck shipment:
                <div className="mt-2">
                  <strong>Truck:</strong> {deletingTruck.truck_reg}<br />
                  <strong>Driver:</strong> {deletingTruck.driver_name}<br />
                  <strong>Date:</strong> {formatDate(deletingTruck.shipment_date)}<br />
                  <strong>Cartons:</strong> {deletingTruck.total_cartons} | <strong>Units:</strong> {deletingTruck.total_units}
                </div>
                <div className="mt-2 text-danger">
                  <strong>This action cannot be undone!</strong>
                </div>
              </Alert>
            </div>
          )}
          
          <Form.Group>
            <Form.Label className="fw-bold">
              <i className="bi bi-shield-lock me-1"></i>
              Enter Admin Code to Confirm
            </Form.Label>
            <Form.Control
              type="password"
              value={deleteCode}
              onChange={(e) => {
                setDeleteCode(e.target.value);
                setDeleteError(''); // Clear error when typing
              }}
              placeholder="Admin code required"
              autoFocus
              className={deleteError ? 'is-invalid' : ''}
            />
            {deleteError && (
              <div className="invalid-feedback d-block">
                <i className="bi bi-x-circle me-1"></i>
                {deleteError}
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleDeleteCancel}>
            Cancel
          </Button>
          <Button 
            variant="danger" 
            onClick={handleDeleteConfirm} 
            disabled={loading || !deleteCode.trim()}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Deleting...
              </>
            ) : (
              <>
                <i className="bi bi-trash me-1"></i>
                Delete Truck
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default TruckSummary;
