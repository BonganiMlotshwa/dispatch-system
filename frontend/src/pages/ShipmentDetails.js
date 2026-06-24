import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Badge, Button, Alert, Form, Spinner, ProgressBar, InputGroup, Modal } from 'react-bootstrap';
import { CSVLink } from 'react-csv';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import DataTable from 'react-data-table-component';
import { API_BASE_URL } from '../config';
import { formatDate } from '../utils/formatters';
import { formatCustomerPoForDisplay, formatInternalPoDisplay, formatCartonDateTime, getCartonEntryTime, getCartonExitTime } from '../utils/poDisplay';

/**
 * ShipmentDetails Page Component
 * 
 * Displays detailed information about a specific shipment
 * and its associated cartons with filtering capabilities
 */
const ShipmentDetails = () => {
  const { id } = useParams();
  const [shipment, setShipment] = useState(null);
  const [cartons, setCartons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    size: ''
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Receive cartons modal state
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveCount, setReceiveCount] = useState('');
  const [receiveLoading, setReceiveLoading] = useState(false);
  const [receiveMsg, setReceiveMsg] = useState('');

  const pendingCount = cartons.filter(c => c.status === 'pending').length;

  const handleReceiveCartons = async () => {
    const count = parseInt(receiveCount);
    if (!count || count < 1 || count > pendingCount) return;
    setReceiveLoading(true);
    setReceiveMsg('');
    try {
      const res = await axios.post(`${API_BASE_URL}/receive_cartons.php`, {
        shipment_id: parseInt(id),
        cartons_to_receive: count
      });
      if (res.data.success) {
        setReceiveMsg(res.data.message);
        // Refresh carton list
        const updated = await axios.get(`${API_BASE_URL}/shipments.php?id=${id}&cartons=true`);
        setCartons(updated.data.cartons || []);
        setShipment(updated.data.shipment);
        setTimeout(() => { setShowReceiveModal(false); setReceiveMsg(''); setReceiveCount(''); }, 1500);
      } else {
        setReceiveMsg(res.data.message || 'Failed to receive cartons');
      }
    } catch (err) {
      setReceiveMsg('Error: ' + (err.response?.data?.message || err.message));
    } finally {
      setReceiveLoading(false);
    }
  };

  // Fetch shipment data on component mount
  useEffect(() => {
    const fetchShipmentData = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/shipments.php?id=${id}&cartons=true`);
        setShipment(response.data.shipment);
        setCartons(response.data.cartons || []);
        setError(null);
      } catch (err) {
        setError('Failed to load shipment data. Please try again later.');
        console.error('Shipment data fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchShipmentData();
    }
  }, [id]);

  // Handle filter changes - apply filters in real-time
  const handleFilterChange = async (e) => {
    const { name, value } = e.target;
    const newFilters = {
      ...filters,
      [name]: value
    };
    setFilters(newFilters);
    
    // Apply filters immediately
    try {
        setLoading(true);
        let url = `${API_BASE_URL}/shipments.php?id=${id}&cartons=true`;
        
        if (newFilters.status) {
          url += `&status=${newFilters.status}`;
        }
        
        if (newFilters.size) {
          url += `&size=${newFilters.size}`;
        }
        
        console.log('Applying filters with URL:', url);
        const response = await axios.get(url);
        setCartons(response.data.cartons || []);
        setError(null);
    } catch (err) {
      setError('Failed to apply filters. Please try again.');
      console.error('Filter application error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Apply filters function (kept for compatibility)
  const applyFilters = async () => {
    // This function is now redundant as filters are applied in real-time
    // but kept for backward compatibility
    try {
      setLoading(true);
      let url = `${API_BASE_URL}/shipments.php?id=${id}&cartons=true`;
      
      if (filters.status) {
        url += `&status=${filters.status}`;
      }
      
      if (filters.size) {
        url += `&size=${filters.size}`;
      }
      
      console.log('Applying filters with URL:', url);
      const response = await axios.get(url);
      setCartons(response.data.cartons || []);
      setError(null);
    } catch (err) {
      setError('Failed to apply filters. Please try again.');
      console.error('Filter application error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Reset filters
  const resetFilters = async () => {
    setFilters({
      status: '',
      size: ''
    });
    
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/shipments.php?id=${id}&cartons=true`);
      setCartons(response.data.cartons || []);
      setError(null);
    } catch (err) {
      setError('Failed to reset filters. Please try again.');
      console.error('Filter reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Generate CSV export
  const handleExportCsv = () => {
    window.location.href = `${API_BASE_URL}/shipments.php?id=${id}&export=csv`;
  };

  // Get status badge variant
  const getStatusBadgeVariant = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'entered':
        return 'success';
      case 'exited':
        return 'secondary';
      case 'in_warehouse':
        return 'primary';
      case 'qc_verified':
        return 'info';
      case 'finishing_complete':
        return 'warning';
      case 'shipped':
        return 'success';
      default:
        return 'light';
    }
  };

  // Format status for display
  const formatStatus = (status) => {
    if (status === 'entered') return 'In Warehouse';
    if (status === 'exited') return 'Shipped';
    
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Get unique sizes from cartons for filter dropdown
  const getUniqueSizes = () => {
    if (!cartons || cartons.length === 0) return [];
    const sizes = [...new Set(cartons.map(carton => carton.size))];
    return sizes.filter(size => size); // Filter out null/undefined/empty values
  };

  // Show loading state
  if (loading && !shipment) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-primary">Loading shipment data...</p>
        </div>
      </Container>
    );
  }

  // Show error state
  if (error && !shipment) {
    return (
      <Container className="py-4">
        <Alert variant="danger" className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>{error}</div>
        </Alert>
        <Button as={Link} to="/reports" variant="primary">
          <i className="bi bi-arrow-left me-2"></i> Back to Reports
        </Button>
      </Container>
    );
  }

  // Show not found state
  if (!loading && !shipment) {
    return (
      <Container className="py-4">
        <Alert variant="warning" className="d-flex align-items-center">
          <i className="bi bi-question-circle-fill me-2"></i>
          <div>Shipment not found. The requested shipment may have been deleted or does not exist.</div>
        </Alert>
        <Button as={Link} to="/reports" variant="primary">
          <i className="bi bi-arrow-left me-2"></i> Back to Reports
        </Button>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">
          <i className="bi bi-box-seam me-2 text-primary"></i>
          Shipment Details
        </h1>
        <div>
          <Link to="/dashboard" className="btn btn-outline-primary me-2">
            <i className="bi bi-speedometer2 me-1"></i> Dashboard
          </Link>
          <Button as={Link} to="/reports" variant="outline-secondary">
            <i className="bi bi-arrow-left me-1"></i> Back to Reports
          </Button>
        </div>
      </div>
      
      {/* Shipment Information */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Header className="bg-primary text-white">
          <i className="bi bi-info-circle me-2"></i> Shipment Information
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={6}>
              <div className="mb-3">
                <h5 className="border-bottom pb-2 mb-3">
                  <i className="bi bi-file-earmark-text me-2 text-primary"></i>
                  Order Details
                </h5>
                <p>
                  <i className="bi bi-person-badge me-2 text-secondary"></i>
                  <strong>Customer:</strong> 
                  <Badge bg="primary" className="ms-2">{shipment.customer || 'MRP'}</Badge>
                </p>
                <p>
                  <i className="bi bi-receipt me-2 text-secondary"></i>
                  <strong>Customer PO:</strong> 
                  <span className="ms-2">
                    {cartons && cartons.length > 0
                      ? formatCustomerPoForDisplay(shipment.customer, cartons[0].po_number)
                      : 'N/A'}
                  </span>
                </p>
                <p>
                  <i className="bi bi-file-earmark-text me-2 text-secondary"></i>
                  <strong>FTM PO (Internal):</strong> 
                  <Badge bg="info" className="ms-2">{formatInternalPoDisplay(shipment.customer, shipment.internal_po_number)}</Badge>
                </p>
                {shipment.style && (
                  <p>
                    <i className="bi bi-tag me-2 text-secondary"></i>
                    <strong>Style:</strong> 
                    <span className="ms-2">{shipment.style}</span>
                  </p>
                )}
                {shipment.color && (
                  <p>
                    <i className="bi bi-palette me-2 text-secondary"></i>
                    <strong>Color:</strong> 
                    <span className="ms-2">{shipment.color}</span>
                  </p>
                )}
                {shipment.order_qty && (
                  <p>
                    <i className="bi bi-cart-check me-2 text-secondary"></i>
                    <strong>Order Quantity:</strong> 
                    <span className="ms-2 fw-bold">{shipment.order_qty.toLocaleString()}</span>
                  </p>
                )}
                <p>
                  <i className="bi bi-calendar-event me-2 text-secondary"></i>
                  <strong>Import Date:</strong> 
                  <span className="ms-2">{new Date(shipment.import_date).toLocaleDateString()}</span>
                </p>
                <p>
                  <i className="bi bi-file-earmark me-2 text-secondary"></i>
                  <strong>File Name:</strong> 
                  <code className="ms-2">{shipment.file_name || 'N/A'}</code>
                </p>
                {shipment.entry_type && (
                  <p>
                    <i className="bi bi-input-cursor me-2 text-secondary"></i>
                    <strong>Entry Type:</strong> 
                    <Badge bg={shipment.entry_type === 'manual' ? 'warning' : 'success'} className="ms-2">
                      {shipment.entry_type === 'manual' ? 'Manual Entry' : 'XML Import'}
                    </Badge>
                  </p>
                )}
              </div>
            </Col>
            <Col md={6}>
              <div className="mb-3">
                <h5 className="border-bottom pb-2 mb-3">
                  <i className="bi bi-box me-2 text-primary"></i>
                  Carton Summary
                </h5>
                <p>
                  <i className="bi bi-boxes me-2 text-secondary"></i>
                  <strong>Total Cartons:</strong> 
                  <span className="ms-2 fw-bold">{cartons.length || shipment.carton_count}</span>
                </p>
                
                {shipment.status_summary && (
                  <div className="mt-3">
                    <p className="mb-2">
                      <i className="bi bi-pie-chart me-2 text-secondary"></i>
                      <strong>Status Breakdown:</strong>
                    </p>
                    
                    {Object.entries(shipment.status_summary).map(([status, count]) => {
                      const percentage = Math.round((count / shipment.carton_count) * 100);
                      return (
                        <div key={status} className="mb-2">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <div>
                              <Badge bg={getStatusBadgeVariant(status)} className="me-2">
                                {formatStatus(status)}
                              </Badge>
                              <small>{count} cartons</small>
                            </div>
                            <small>{percentage}%</small>
                          </div>
                          <ProgressBar 
                            variant={getStatusBadgeVariant(status)} 
                            now={percentage} 
                            className="mb-2" 
                            style={{height: '8px'}} 
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Col>
          </Row>
        </Card.Body>
        <Card.Footer className="bg-light">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <strong>Export Options:</strong>
            </div>
            <div>
              <Button variant="success" onClick={handleExportCsv} className="me-2">
                <i className="bi bi-file-earmark-excel me-1"></i> Export to CSV
              </Button>
              <Button 
                variant="danger" 
                href={`${API_BASE_URL}/shipments.php?id=${id}&export=pdf`}
                target="_blank"
              >
                <i className="bi bi-file-earmark-pdf me-1"></i> Export to PDF
              </Button>
            </div>
          </div>
        </Card.Footer>
      </Card>
      
      {/* Carton Filters */}
      <Card className="mb-4 shadow-sm border-0">
        <Card.Header className="bg-primary text-white">
          <i className="bi bi-funnel me-2"></i> Filter Cartons
        </Card.Header>
        <Card.Body>
          <Row>
            <Col md={5}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <i className="bi bi-tag me-1"></i> Status
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-filter"></i>
                  </InputGroup.Text>
                  <Form.Select 
                    name="status" 
                    value={filters.status} 
                    onChange={handleFilterChange}
                  >
                    <option value="">All Statuses</option>
                    <option value="pending">Pending</option>
                    <option value="entered">In Warehouse</option>
                    <option value="exited">Shipped</option>
                    {shipment.status_summary && Object.keys(shipment.status_summary)
                      .filter(status => !['pending', 'entered', 'exited'].includes(status))
                      .map(status => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                      ))
                    }
                  </Form.Select>
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={5}>
              <Form.Group className="mb-3">
                <Form.Label>
                  <i className="bi bi-rulers me-1"></i> Size
                </Form.Label>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-filter"></i>
                  </InputGroup.Text>
                  <Form.Select 
                    name="size" 
                    value={filters.size} 
                    onChange={handleFilterChange}
                  >
                    <option value="">All Sizes</option>
                    {getUniqueSizes().map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </Form.Select>
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={2} className="d-flex align-items-end mb-3">
              <div>
                <Button 
                  variant="outline-secondary" 
                  onClick={resetFilters}
                  disabled={loading}
                  className="w-100"
                >
                  <i className="bi bi-x-circle me-1"></i> Reset Filters
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      {/* Cartons Table */}
      <Card className="shadow-sm border-0">
        <Card.Header className="bg-primary text-white">
          <div className="d-flex justify-content-between align-items-center">
            <span>
              <i className="bi bi-box me-2"></i> Cartons
              <Badge bg="light" text="dark" className="ms-2" style={{fontSize: '1rem', padding: '8px 12px'}}>
                <strong>Total Cartons: {cartons.length}</strong>
              </Badge>
            </span>
            <div className="d-flex align-items-center gap-2">
              {loading && <Spinner animation="border" size="sm" variant="light" />}
              {shipment?.entry_type === 'manual' && pendingCount > 0 && (
                <Button size="sm" variant="warning" onClick={() => { setShowReceiveModal(true); setReceiveCount(''); setReceiveMsg(''); }}>
                  <i className="bi bi-box-arrow-in-down me-1"></i> Receive Cartons ({pendingCount} pending)
                </Button>
              )}
            </div>
          </div>
        </Card.Header>
        <Card.Body>
          {error && (
            <Alert variant="danger" dismissible onClose={() => setError(null)} className="d-flex align-items-center">
              <i className="bi bi-exclamation-triangle-fill me-2"></i>
              <div>{error}</div>
            </Alert>
          )}
          
          {cartons.length > 0 ? (
            <DataTable
              customStyles={{
                headCells: {
                  style: {
                    fontSize: '1rem',
                    fontWeight: 'bold',
                    paddingLeft: '8px',
                    paddingRight: '8px',
                  },
                },
                cells: {
                  style: {
                    fontSize: '0.95rem',
                    paddingLeft: '8px',
                    paddingRight: '8px',
                  },
                },
              }}
              columns={[
                {
                  name: '#',
                  selector: (row, index) => index + 1,
                  cell: (row, index) => ((currentPage - 1) * rowsPerPage) + index + 1,
                  width: '60px'
                },
                {
                  name: 'Barcode',
                  selector: row => row.barcode_2d || row.barcode,
                  sortable: true,
                  cell: row => <code>{row.barcode_2d || row.barcode}</code>
                },
                {
                  name: 'Status',
                  selector: row => row.status,
                  sortable: true,
                  cell: row => (
                    <Badge bg={getStatusBadgeVariant(row.status)} pill>
                      {formatStatus(row.status)}
                    </Badge>
                  )
                },
                {
                  name: 'Units',
                  selector: row => row.units,
                  sortable: true,
                  cell: row => row.units || 'N/A'
                },
                {
                  name: 'Customer',
                  selector: row => row.customer,
                  sortable: true,
                  cell: row => shipment?.customer || row.division || 'N/A'
                },
                {
                  name: 'Scan In Time',
                  selector: row => getCartonEntryTime(row),
                  sortable: true,
                  cell: row => formatCartonDateTime(getCartonEntryTime(row))
                },
                {
                  name: 'Scan Out Time',
                  selector: row => getCartonExitTime(row),
                  sortable: true,
                  cell: row => formatCartonDateTime(getCartonExitTime(row))
                }
              ]}
              data={cartons}
              pagination
              highlightOnHover
              responsive
              striped
              subHeader
              subHeaderComponent={
                <div className="w-100 d-flex justify-content-end mb-2">
                  <Form.Control
                    type="text"
                    placeholder="Search..."
                    className="w-25"
                    onChange={e => {
                      // Real-time filtering handled by DataTable
                      // This will automatically filter as user types
                    }}
                    autoFocus
                  />
                </div>
              }
              fixedHeader
              fixedHeaderScrollHeight="500px"
              persistTableHead
              onChangePage={page => setCurrentPage(page)}
              onChangeRowsPerPage={(newPerPage, page) => { setRowsPerPage(newPerPage); setCurrentPage(page); }}
            />
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-search text-secondary" style={{ fontSize: '2rem' }}></i>
              <p className="mt-3 text-secondary">No cartons found matching the selected filters.</p>
              <Button 
                variant="outline-primary" 
                onClick={resetFilters}
                disabled={loading}
              >
                <i className="bi bi-arrow-repeat me-1"></i> Reset Filters
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Receive Cartons Modal */}
      <Modal show={showReceiveModal} onHide={() => setShowReceiveModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title><i className="bi bi-box-arrow-in-down me-2"></i>Receive Cartons</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            There are <strong>{pendingCount}</strong> pending cartons for this shipment.
            Enter how many you have received today.
          </p>
          <Form.Group>
            <Form.Label>Cartons Received</Form.Label>
            <Form.Control
              type="number"
              min="1"
              max={pendingCount}
              value={receiveCount}
              onChange={e => setReceiveCount(e.target.value)}
              placeholder={`Max ${pendingCount}`}
              autoFocus
            />
            <Form.Text className="text-muted">Max: {pendingCount}</Form.Text>
          </Form.Group>
          {receiveMsg && (
            <Alert variant={receiveMsg.startsWith('Error') ? 'danger' : 'success'} className="mt-3 mb-0">
              {receiveMsg}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowReceiveModal(false)} disabled={receiveLoading}>
            Cancel
          </Button>
          <Button
            variant="warning"
            onClick={handleReceiveCartons}
            disabled={receiveLoading || !receiveCount || parseInt(receiveCount) < 1 || parseInt(receiveCount) > pendingCount}
          >
            {receiveLoading ? <><Spinner size="sm" className="me-1" />Receiving...</> : 'Confirm Receive'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ShipmentDetails;
