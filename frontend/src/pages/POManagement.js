import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Badge, Button, Form, 
  InputGroup, Spinner, Alert, ProgressBar, Dropdown,
  OverlayTrigger, Tooltip, Modal
} from 'react-bootstrap';
import { useApi } from '../hooks/useApi';
import apiService from '../services/apiService';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { formatInternalPoDisplay, formatCustomerPoForDisplay, getInternalPoSortValue } from '../utils/poDisplay';
import {
  WAREHOUSE_ORDER_STATUS_OPTIONS,
  getWarehouseOrderStatusBadge,
  getWarehouseOrderStatusLabel
} from '../utils/warehouseOrderStatuses';

/**
 * Enhanced PO Management Page
 * 
 * Modern card-based interface for managing Purchase Orders
 */
const POManagement = () => {
  const { withAdminAuth } = useAdminAuth();

  // State management
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('internal_po_number');
  const [sortOrder, setSortOrder] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState('list'); // 'cards' or 'list'
  const [selectedPOs, setSelectedPOs] = useState([]);
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPO, setEditingPO] = useState(null);
  const [newPONumber, setNewPONumber] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPO, setDeletingPO] = useState(null);
  const [alertMessage, setAlertMessage] = useState(null); // { type: 'success'|'danger'|'warning', message: 'text' }
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(15);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  // Auto-dismiss alert after 4 seconds
  useEffect(() => {
    if (alertMessage) {
      const timer = setTimeout(() => {
        setAlertMessage(null);
      }, 4000);
      
      return () => clearTimeout(timer);
    }
  }, [alertMessage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder]);

  // When viewing all statuses, default to smallest FTM number first.
  useEffect(() => {
    if (statusFilter === 'all') {
      setSortBy('internal_po_number');
      setSortOrder('asc');
    }
  }, [statusFilter]);

  // API calls - no caching, always fresh data
  const { data: posData, loading, error, refetch } = useApi('/shipments.php');

  // Manual refresh function
  const handleRefresh = useCallback(async () => {
    try {
      // Clear API service cache and refetch
      if (typeof apiService?.clearCache === 'function') {
        apiService.clearCache();
      }
      
      // Trigger refetch
      if (typeof refetch === 'function') {
        await refetch();
      }
    } catch (err) {
      console.error('Error refreshing PO data:', err);
    }
  }, [refetch]);

  // Clear cache when component mounts to ensure fresh data
  useEffect(() => {
    if (typeof apiService?.clearCache === 'function') {
      apiService.clearCache();
    }
  }, []); // Run once on mount

  // Memoized filtered and sorted data
  const filteredPOs = useMemo(() => {
    if (!posData?.shipments) return [];
    
    let filtered = [...posData.shipments];
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(po => 
        po.internal_po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.customer_po_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.file_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // Apply spec 1.5 warehouse order status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter((po) => {
        const status = po.warehouse_order_status || 'active';
        return status === statusFilter;
      });
    }
    
    // Apply sorting
    filtered.sort((a, b) => {
      if (sortBy === 'internal_po_number') {
        const aVal = getInternalPoSortValue(a.internal_po_number);
        const bVal = getInternalPoSortValue(b.internal_po_number);
        if (aVal === bVal) {
          return String(a.internal_po_number || '').localeCompare(String(b.internal_po_number || ''));
        }
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'import_date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      }

      if (aVal === bVal) return 0;
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });
    
    return filtered;
  }, [posData, searchTerm, sortBy, sortOrder, statusFilter]);

  // Paginated data
  const paginatedPOs = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return filteredPOs.slice(startIndex, endIndex);
  }, [filteredPOs, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(filteredPOs.length / rowsPerPage);

  // Helper functions
  const getStatusBadge = (po) => {
    const status = po.warehouse_order_status || 'active';
    const label = po.warehouse_order_status_label || getWarehouseOrderStatusLabel(status);
    return (
      <Badge bg={getWarehouseOrderStatusBadge(status)}>{label}</Badge>
    );
  };

  const getProgressBadge = (po) => {
    const completionRate = po.carton_count > 0 ? (po.shipped_count / po.carton_count) * 100 : 0;
    
    if (completionRate === 0) {
      return <Badge bg="light" text="dark">No scans</Badge>;
    } else if (completionRate === 100) {
      return <Badge bg="success">Completed</Badge>;
    } else {
      return <Badge bg="info">In Progress</Badge>;
    }
  };

  const getCompletionRate = (po) => {
    return po.carton_count > 0 ? Math.round((po.shipped_count / po.carton_count) * 100) : 0;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleBulkAction = (action) => {
    console.log(`Performing ${action} on POs:`, selectedPOs);
    
    if (action === 'delete') {
      // Show confirmation modal for bulk delete
      setShowBulkDeleteConfirm(true);
      setShowBulkActions(false);
    } else {
      // Implement other bulk actions here
      setShowBulkActions(false);
      setSelectedPOs([]);
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedPOs.length === 0) {
      return;
    }

    try {
    await withAdminAuth('delete purchase orders', async (adminCode) => {
    console.log('=== BULK DELETE REQUEST ===');
    console.log('Deleting PO IDs:', selectedPOs);

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    // Delete each PO
    for (const poId of selectedPOs) {
      try {
        const response = await axios.post(`${API_BASE_URL}/delete_po.php`, {
          id: poId,
          admin_code: adminCode
        });

        if (response.data.success) {
          successCount++;
        } else {
          failCount++;
          errors.push(`PO ID ${poId}: ${response.data.error}`);
        }
      } catch (err) {
        failCount++;
        const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
        errors.push(`PO ID ${poId}: ${errorMsg}`);
      }
    }

    // Show results
    if (successCount > 0 && failCount === 0) {
      setAlertMessage({
        type: 'success',
        message: `Successfully deleted ${successCount} purchase order${successCount > 1 ? 's' : ''}`
      });
    } else if (successCount > 0 && failCount > 0) {
      setAlertMessage({
        type: 'warning',
        message: `Deleted ${successCount} PO(s), but ${failCount} failed. Check console for details.`
      });
      console.error('Bulk delete errors:', errors);
    } else {
      setAlertMessage({
        type: 'danger',
        message: `Failed to delete ${failCount} purchase order${failCount > 1 ? 's' : ''}. Check console for details.`
      });
      console.error('Bulk delete errors:', errors);
    }

    // Refresh data and close modal
    await handleRefresh();
    setShowBulkDeleteConfirm(false);
    setSelectedPOs([]);
    });
    } catch (_) {
      /* admin cancelled */
    }
  };

  const togglePOSelection = (poId) => {
    setSelectedPOs(prev => 
      prev.includes(poId) 
        ? prev.filter(id => id !== poId)
        : [...prev, poId]
    );
  };

  const handleEditClick = (po) => {
    setEditingPO(po);
    setNewPONumber(po.internal_po_number);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingPO || !newPONumber.trim()) {
      console.log('Edit validation failed:', { editingPO, newPONumber });
      return;
    }

    // Check if the PO number hasn't changed
    if (newPONumber.trim() === editingPO.internal_po_number) {
      setAlertMessage({
        type: 'info',
        message: 'No changes detected. The PO number is the same.'
      });
      setShowEditModal(false);
      setEditingPO(null);
      setNewPONumber('');
      return;
    }

    const url = `${API_BASE_URL}/update_po_number.php`;
    const payload = {
      id: editingPO.id,
      internal_po_number: newPONumber.trim()
    };

    console.log('=== EDIT PO REQUEST ===');
    console.log('URL:', url);
    console.log('Payload:', payload);
    console.log('API_BASE_URL:', API_BASE_URL);

    try {
      const response = await axios.post(url, payload);
      
      console.log('Edit response:', response);
      console.log('Response data:', response.data);
      console.log('Response status:', response.status);

      if (response.data.success) {
        console.log('Edit successful, refreshing data...');
        setAlertMessage({
          type: 'success',
          message: `PO number successfully updated to ${newPONumber.trim()}`
        });
        // Refresh the data
        await handleRefresh();
        setShowEditModal(false);
        setEditingPO(null);
        setNewPONumber('');
      } else {
        console.error('Edit failed:', response.data);
        setAlertMessage({
          type: 'danger',
          message: response.data.error || 'Failed to update PO number'
        });
      }
    } catch (err) {
      console.error('=== EDIT ERROR ===');
      console.error('Error object:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error response status:', err.response?.status);
      console.error('Error message:', err.message);
      
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      setAlertMessage({
        type: 'danger',
        message: `Error updating PO number: ${errorMsg}`
      });
    }
  };

  const handleDeleteClick = (po) => {
    setDeletingPO(po);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPO) {
      console.log('Delete validation failed: no deletingPO');
      return;
    }

    try {
    await withAdminAuth('delete purchase order', async (adminCode) => {
    const url = `${API_BASE_URL}/delete_po.php`;
    const payload = {
      id: deletingPO.id,
      admin_code: adminCode
    };

    console.log('=== DELETE PO REQUEST ===');
    console.log('URL:', url);
    console.log('Payload:', payload);
    console.log('API_BASE_URL:', API_BASE_URL);
    console.log('Deleting PO:', deletingPO);

    try {
      const response = await axios.post(url, payload);
      
      console.log('Delete response:', response);
      console.log('Response data:', response.data);
      console.log('Response status:', response.status);

      if (response.data.success) {
        console.log('Delete successful, refreshing data...');
        setAlertMessage({
          type: 'success',
          message: `PO ${deletingPO.internal_po_number} successfully deleted`
        });
        // Refresh the data
        await handleRefresh();
        setShowDeleteModal(false);
        setDeletingPO(null);
      } else {
        console.error('Delete failed:', response.data);
        setAlertMessage({
          type: 'danger',
          message: response.data.error || 'Failed to delete PO'
        });
      }
    } catch (err) {
      console.error('=== DELETE ERROR ===');
      console.error('Error object:', err);
      console.error('Error response:', err.response);
      console.error('Error response data:', err.response?.data);
      console.error('Error response status:', err.response?.status);
      console.error('Error message:', err.message);
      
      const errorMsg = err.response?.data?.error || err.message || 'Unknown error';
      setAlertMessage({
        type: 'danger',
        message: `Error deleting PO: ${errorMsg}`
      });
    }
    });
    } catch (_) {
      /* admin cancelled */
    }
  };

  // Loading state
  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted">Loading Purchase Orders...</p>
        </div>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger" className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>
            <strong>Error:</strong> {error}
            <div className="mt-2">
              <Button variant="outline-danger" size="sm" onClick={refetch}>
                <i className="bi bi-arrow-clockwise me-1"></i> Retry
              </Button>
            </div>
          </div>
        </Alert>
      </Container>
    );
  }

  return (
    <Container fluid className="py-3">
      {/* Custom Alert Message */}
      {alertMessage && (
        <Alert 
          variant={alertMessage.type} 
          dismissible 
          onClose={() => setAlertMessage(null)}
          className="mb-3"
        >
          <div className="d-flex align-items-center">
            <i className={`bi ${
              alertMessage.type === 'success' ? 'bi-check-circle-fill' :
              alertMessage.type === 'danger' ? 'bi-exclamation-triangle-fill' :
              alertMessage.type === 'warning' ? 'bi-exclamation-circle-fill' :
              'bi-info-circle-fill'
            } me-2`}></i>
            <span>{alertMessage.message}</span>
          </div>
        </Alert>
      )}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="display-6 mb-2">
            <i className="bi bi-kanban me-2 text-primary"></i>
            Purchase Orders
          </h1>
          <p className="text-muted mb-0">
            Manage and analyze your purchase orders with comprehensive insights
          </p>
        </div>
        
        <div className="d-flex gap-2">
          <Button variant="outline-primary" as={Link} to="/upload">
            <i className="bi bi-plus-circle me-1"></i> New PO
          </Button>
          <Button variant="primary" onClick={handleRefresh} disabled={loading}>
            <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`}></i> Refresh
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <Card className="border-0 shadow-sm mb-4">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col md={4}>
              <Form.Label className="small fw-medium text-muted">SEARCH</Form.Label>
              <InputGroup>
                <InputGroup.Text>
                  <i className="bi bi-search"></i>
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search PO number, customer PO, or file name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </InputGroup>
            </Col>
            
            <Col md={2}>
              <Form.Label className="small fw-medium text-muted">STATUS</Form.Label>
              <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">All statuses</option>
                {Object.entries(WAREHOUSE_ORDER_STATUS_OPTIONS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Form.Select>
            </Col>
            
            <Col md={2}>
              <Form.Label className="small fw-medium text-muted">SORT BY</Form.Label>
              <Form.Select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="import_date">Import Date</option>
                <option value="internal_po_number">FTM PO Number</option>
                <option value="carton_count">Carton Count</option>
                <option value="shipped_count">Shipped Count</option>
              </Form.Select>
            </Col>
            
            <Col md={2}>
              <Form.Label className="small fw-medium text-muted">ORDER</Form.Label>
              <Form.Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </Form.Select>
            </Col>
            
            <Col md={2}>
              <Form.Label className="small fw-medium text-muted">VIEW</Form.Label>
              <div className="btn-group w-100" role="group">
                <Button 
                  variant={viewMode === 'cards' ? 'primary' : 'outline-primary'} 
                  size="sm"
                  onClick={() => setViewMode('cards')}
                >
                  <i className="bi bi-grid-3x3-gap"></i>
                </Button>
                <Button 
                  variant={viewMode === 'list' ? 'primary' : 'outline-primary'} 
                  size="sm"
                  onClick={() => setViewMode('list')}
                >
                  <i className="bi bi-list"></i>
                </Button>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Results Summary */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted">
            Showing {filteredPOs.length === 0 ? 0 : ((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredPOs.length)} of {filteredPOs.length} purchase orders
            {loading && (
              <span className="ms-2">
                <i className="bi bi-arrow-clockwise spin text-primary"></i>
                <small className="ms-1">Updating...</small>
              </span>
            )}
          </span>
          
          <div className="d-flex align-items-center gap-2">
            <Form.Label className="mb-0 small text-muted">Rows per page:</Form.Label>
            <Form.Select 
              size="sm" 
              value={rowsPerPage} 
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              style={{ width: 'auto' }}
            >
              <option value={10}>10</option>
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Form.Select>
          </div>
        </div>
        
        {selectedPOs.length > 0 && (
          <div className="d-flex align-items-center gap-2">
            <span className="small text-muted">{selectedPOs.length} selected</span>
            <Button 
              variant="outline-primary" 
              size="sm"
              onClick={() => setShowBulkActions(true)}
            >
              <i className="bi bi-gear me-1"></i> Bulk Actions
            </Button>
          </div>
        )}
      </div>

      {/* PO Cards/List */}
      {viewMode === 'cards' ? (
        <Row className="g-4">
          {paginatedPOs.map(po => {
            const completionRate = getCompletionRate(po);
            const isSelected = selectedPOs.includes(po.id);
            
            return (
              <Col key={po.id} lg={4} md={6}>
                <Card className={`border-0 shadow-sm h-100 position-relative ${isSelected ? 'border-primary' : ''}`}>
                  <Card.Body className="p-4">
                    {/* Selection checkbox */}
                    <Form.Check
                      type="checkbox"
                      className="position-absolute top-0 end-0 m-3"
                      checked={isSelected}
                      onChange={() => togglePOSelection(po.id)}
                    />
                    
                    {/* PO Header */}
                    <div className="mb-3">
                      <h5 className="mb-1 fw-bold">
                        <Link 
                          to={`/po/${po.id}`} 
                          className="text-decoration-none text-dark"
                        >
                          {formatInternalPoDisplay(po.customer, po.internal_po_number)}
                        </Link>
                      </h5>
                      <div className="d-flex align-items-center gap-2">
                        {getStatusBadge(po)}
                        <small className="text-muted">
                          {formatDate(po.import_date)}
                        </small>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="text-muted">Completion</small>
                        <small className="fw-medium">{completionRate}%</small>
                      </div>
                      <ProgressBar 
                        now={completionRate} 
                        variant={
                          completionRate === 100 ? 'success' :
                          completionRate > 0 ? 'info' : 'warning'
                        }
                        style={{ height: '6px' }}
                      />
                    </div>
                    
                    {/* Stats */}
                    <Row className="g-2 mb-3">
                      <Col xs={6}>
                        <div className="text-center p-2 bg-light rounded">
                          <div className="fs-5 fw-bold text-primary">{po.carton_count}</div>
                          <small className="text-muted">Total Cartons</small>
                        </div>
                      </Col>
                      <Col xs={6}>
                        <div className="text-center p-2 bg-light rounded">
                          <div className="fs-5 fw-bold text-success">{po.shipped_count}</div>
                          <small className="text-muted">Shipped</small>
                        </div>
                      </Col>
                    </Row>
                    
                    {/* Customer PO */}
                    {po.customer_po_number && (
                      <div className="mb-2">
                        <small className="text-muted">Customer PO:</small>
                        <div className="small fw-medium">{formatCustomerPoForDisplay(po.customer, po.customer_po_number)}</div>
                      </div>
                    )}
                    
                    {/* Actions */}
                    <div className="d-flex gap-1 mt-3">
                      <Button 
                        variant="primary" 
                        size="sm" 
                        as={Link} 
                        to={`/po/${po.id}`}
                        className="flex-fill"
                      >
                        <i className="bi bi-graph-up me-1"></i>
                        Analytics
                      </Button>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        as={Link}
                        to={`/shipment/${po.id}`}
                      >
                        <i className="bi bi-eye"></i>
                      </Button>
                      <Button 
                        variant="outline-primary" 
                        size="sm"
                        onClick={() => handleEditClick(po)}
                      >
                        <i className="bi bi-pencil"></i>
                      </Button>
                      <Button 
                        variant="outline-danger" 
                        size="sm"
                        onClick={() => handleDeleteClick(po)}
                      >
                        <i className="bi bi-trash"></i>
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            );
          })}
        </Row>
      ) : (
        /* List View */
        <Card className="border-0 shadow-sm">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead className="bg-light">
                <tr>
                  <th width="30">
                    <Form.Check
                      type="checkbox"
                      checked={selectedPOs.length === paginatedPOs.length && paginatedPOs.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPOs(paginatedPOs.map(po => po.id));
                        } else {
                          setSelectedPOs([]);
                        }
                      }}
                    />
                  </th>
                  <th>PO Number</th>
                  <th>Customer PO</th>
                  <th>Status</th>
                  <th>Cartons</th>
                  <th>Progress</th>
                  <th>Import Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPOs.map(po => {
                  const completionRate = getCompletionRate(po);
                  const isSelected = selectedPOs.includes(po.id);
                  
                  return (
                    <tr key={po.id} className={isSelected ? 'table-primary' : ''}>
                      <td>
                        <Form.Check
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => togglePOSelection(po.id)}
                        />
                      </td>
                      <td>
                        <Link 
                          to={`/po/${po.id}`} 
                          className="text-decoration-none fw-medium"
                        >
                          {formatInternalPoDisplay(po.customer, po.internal_po_number)}
                        </Link>
                      </td>
                      <td>{po.customer_po_number ? formatCustomerPoForDisplay(po.customer, po.customer_po_number) : '-'}</td>
                      <td>{getStatusBadge(po)}</td>
                      <td>
                        <span className="fw-medium">{po.carton_count}</span>
                        <small className="text-muted ms-1">
                          ({po.shipped_count} shipped)
                        </small>
                      </td>
                      <td>
                        <div style={{ width: '100px' }}>
                          <ProgressBar 
                            now={completionRate} 
                            variant={
                              completionRate === 100 ? 'success' :
                              completionRate > 0 ? 'info' : 'warning'
                            }
                            style={{ height: '6px' }}
                          />
                          <small className="text-muted">{completionRate}%</small>
                        </div>
                      </td>
                      <td className="text-muted">{formatDate(po.import_date)}</td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            as={Link}
                            to={`/po/${po.id}`}
                          >
                            <i className="bi bi-graph-up"></i>
                          </Button>
                          <Button 
                            variant="outline-secondary" 
                            size="sm"
                            as={Link}
                            to={`/shipment/${po.id}`}
                          >
                            <i className="bi bi-eye"></i>
                          </Button>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            onClick={() => handleEditClick(po)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleDeleteClick(po)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center mt-4">
          <nav>
            <ul className="pagination mb-0">
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                >
                  <i className="bi bi-chevron-double-left"></i>
                </button>
              </li>
              <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <i className="bi bi-chevron-left"></i>
                </button>
              </li>
              
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <li key={pageNum} className={`page-item ${currentPage === pageNum ? 'active' : ''}`}>
                    <button 
                      className="page-link" 
                      onClick={() => setCurrentPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  </li>
                );
              })}
              
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  <i className="bi bi-chevron-right"></i>
                </button>
              </li>
              <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                <button 
                  className="page-link" 
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <i className="bi bi-chevron-double-right"></i>
                </button>
              </li>
            </ul>
          </nav>
        </div>
      )}

      {/* Empty State */}
      {filteredPOs.length === 0 && !loading && (
        <div className="text-center py-5">
          <i className="bi bi-inbox text-muted" style={{ fontSize: '3rem' }}></i>
          <h4 className="mt-3 text-muted">No Purchase Orders Found</h4>
          <p className="text-muted">
            {searchTerm || statusFilter !== 'all' 
              ? 'Try adjusting your search criteria or filters'
              : 'Import your first PO to get started'
            }
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button variant="primary" as={Link} to="/upload">
              <i className="bi bi-plus-circle me-1"></i> Import First PO
            </Button>
          )}
        </div>
      )}

      {/* Bulk Actions Modal */}
      <Modal show={showBulkActions} onHide={() => setShowBulkActions(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Bulk Actions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Select an action to perform on {selectedPOs.length} selected POs:</p>
          <div className="d-grid gap-2">
            <Button variant="outline-primary" onClick={() => handleBulkAction('export')}>
              <i className="bi bi-download me-2"></i>
              Export Selected POs
            </Button>
            <Button variant="outline-info" onClick={() => handleBulkAction('refresh')}>
              <i className="bi bi-arrow-clockwise me-2"></i>
              Refresh Analytics
            </Button>
            <Button variant="outline-secondary" onClick={() => handleBulkAction('archive')}>
              <i className="bi bi-archive me-2"></i>
              Archive Selected POs
            </Button>
            <Button variant="outline-danger" onClick={() => handleBulkAction('delete')}>
              <i className="bi bi-trash me-2"></i>
              Delete Selected POs
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal show={showBulkDeleteConfirm} onHide={() => setShowBulkDeleteConfirm(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Bulk Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <i className="bi bi-exclamation-triangle-fill me-2"></i>
            This action cannot be undone!
          </Alert>
          <p>
            Are you sure you want to delete <strong>{selectedPOs.length}</strong> purchase order{selectedPOs.length > 1 ? 's' : ''}? You will be asked for the admin code to confirm.
          </p>
          <p className="text-muted small">
            This will permanently delete the selected POs and all their associated cartons from the database.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowBulkDeleteConfirm(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBulkDeleteConfirm}>
            <i className="bi bi-trash me-1"></i>
            Delete {selectedPOs.length} PO{selectedPOs.length > 1 ? 's' : ''}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit PO Number Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit FTM PO Number</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingPO && (
            <>
              <p className="text-muted">
                Editing PO: <strong>{editingPO.internal_po_number}</strong>
              </p>
              <Form.Group>
                <Form.Label>New FTM PO Number</Form.Label>
                <Form.Control
                  type="text"
                  value={newPONumber}
                  onChange={(e) => setNewPONumber(e.target.value)}
                  placeholder="Enter new PO number"
                  autoFocus
                />
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleEditSave} disabled={!newPONumber.trim()}>
            <i className="bi bi-check-circle me-1"></i>
            Save Changes
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Purchase Order</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deletingPO && (
            <>
              <Alert variant="warning">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                This action cannot be undone!
              </Alert>
              <p>
                Are you sure you want to delete the following purchase order? You will be asked for the admin code to confirm.
              </p>
              <div className="bg-light p-3 rounded">
                <strong>PO Number:</strong> {deletingPO.internal_po_number}<br />
                <strong>Cartons:</strong> {deletingPO.carton_count}<br />
                <strong>Import Date:</strong> {formatDate(deletingPO.import_date)}
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            <i className="bi bi-trash me-1"></i>
            Delete PO
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default POManagement;
