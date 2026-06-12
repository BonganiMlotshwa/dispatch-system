import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Button, Modal, Badge, Spinner, Alert, ProgressBar } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import {
  LEGACY_STATUS_OPTIONS,
  LEGACY_STATUS_BADGE,
  emptyLegacyForm
} from '../utils/legacyWarehouseStatuses';

const CUSTOMERS = ['MRP', 'OTB', 'OBSW', 'Other'];

const LegacyWarehouseGoods = () => {
  const navigate = useNavigate();
  const { withAdminAuth } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [statusCounts, setStatusCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    status: 'active',
    customer: '',
    source_year: '',
    in_warehouse_only: false,
    search: ''
  });

  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRow, setDeletingRow] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyLegacyForm());
  const [saving, setSaving] = useState(false);
  const [savingStatusId, setSavingStatusId] = useState(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.status) params.append('status', filters.status);
      if (filters.customer) params.append('customer', filters.customer);
      if (filters.source_year !== '') params.append('source_year', filters.source_year);
      if (filters.in_warehouse_only) params.append('in_warehouse_only', '1');
      if (filters.search.trim()) params.append('search', filters.search.trim());

      const res = await axios.get(`${API_BASE_URL}/warehouse_stock_list.php?${params}`);
      if (res.data.success) {
        setItems(res.data.items || []);
        setStatusCounts(res.data.status_counts || {});
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load list');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyLegacyForm());
    setShowModal(true);
  };

  const openEdit = (row) => {
    if (row.source_type === 'system') {
      navigate(`/po/${row.source_id}`);
      return;
    }
    setEditingId(row.source_id);
    setForm({
      internal_po: (row.internal_po || '').replace(/^FTM-/i, ''),
      customer_order_number: row.customer_order_number || '',
      customer: row.customer || 'MRP',
      customer_other: row.customer_other || '',
      style: row.style || '',
      color: row.color || '',
      order_qty: row.order_qty ?? '',
      quantity_inside: row.quantity_inside ?? '',
      cartons_label: row.cartons_label || '',
      cartons_count: row.cartons_count ?? '',
      status: row.status || 'active',
      remarks: row.remarks || '',
      new_developments: row.new_developments || '',
      shipped_qty: row.shipped_qty ?? '0',
      source_year: String(row.source_year || 2025)
    });
    setShowModal(true);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (form.customer === 'Other' && !String(form.customer_other || '').trim()) {
      setError('Please enter a customer name when Customer is Other');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        internal_po: form.internal_po.startsWith('FTM-')
          ? form.internal_po
          : `FTM-${form.internal_po.replace(/^FTM-/i, '')}`
      };
      if (editingId) {
        await axios.put(`${API_BASE_URL}/legacy_warehouse_goods.php`, { ...payload, id: editingId });
      } else {
        await axios.post(`${API_BASE_URL}/legacy_warehouse_goods.php`, payload);
      }
      setShowModal(false);
      await loadList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (row, newStatus) => {
    if (newStatus === row.status) return;
    setSavingStatusId(row.id);
    setError('');
    try {
      if (row.source_type === 'system') {
        await axios.post(`${API_BASE_URL}/update_shipment_warehouse_status.php`, {
          shipment_id: row.source_id,
          warehouse_order_status: newStatus
        });
      } else {
        await axios.put(`${API_BASE_URL}/legacy_warehouse_goods.php`, {
          id: row.source_id,
          internal_po: row.internal_po,
          customer_order_number: row.customer_order_number || '',
          customer: row.customer || 'MRP',
          customer_other: row.customer_other || '',
          style: row.style || '',
          color: row.color || '',
          order_qty: row.order_qty ?? '',
          quantity_inside: row.quantity_inside ?? '',
          cartons_label: row.cartons_label || '',
          status: newStatus,
          remarks: row.remarks || '',
          new_developments: row.new_developments || '',
          shipped_qty: row.shipped_qty ?? 0,
          source_year: row.source_year || 2025
        });
      }
      await loadList();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update status');
    } finally {
      setSavingStatusId(null);
    }
  };

  const handleDeleteClick = (row) => {
    if (row.source_type === 'system') {
      setError('System orders cannot be deleted here — change status or open the PO in Purchase Orders.');
      return;
    }
    setDeletingRow(row);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRow) return;
    try {
      await withAdminAuth('delete legacy warehouse entry', async (adminCode) => {
        await axios.delete(`${API_BASE_URL}/legacy_warehouse_goods.php`, {
          params: { id: deletingRow.source_id, admin_code: adminCode },
          data: { id: deletingRow.source_id, admin_code: adminCode }
        });
        setShowDeleteModal(false);
        setDeletingRow(null);
        await loadList();
      });
    } catch (err) {
      if (err?.message === 'Admin verification cancelled') return;
      setError(err.response?.data?.message || err.message || 'Failed to delete');
    }
  };

  const handleExport = () => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.customer) params.append('customer', filters.customer);
    if (filters.source_year) params.append('source_year', filters.source_year);
    if (filters.in_warehouse_only) params.append('in_warehouse_only', '1');
    if (filters.search.trim()) params.append('search', filters.search.trim());
    window.open(`${API_BASE_URL}/legacy_warehouse_goods_export.php?${params}`, '_blank');
  };

  const totalInList = items.length;

  const formatCell = (val) => (val !== null && val !== undefined && val !== '' ? val : null);

  const renderCartonProgress = (row) => {
    const total = row.cartons_total || 0;
    if (!total && row.source_type === 'legacy') {
      return <span className="text-muted small">{row.cartons_label || '—'}</span>;
    }
    if (!total) return <span className="text-muted">—</span>;
    const shipped = row.cartons_shipped || 0;
    const inWh = row.cartons_in_wh || 0;
    const pct = Math.min(100, Math.round((shipped / total) * 100));
    return (
      <div className="warehouse-stock-progress">
        <div className="d-flex justify-content-between small mb-1">
          <span><strong className="text-success">{shipped}</strong> shipped</span>
          <span><strong className="text-primary">{inWh}</strong> in WH</span>
          <span className="text-muted">/ {total}</span>
        </div>
        <ProgressBar now={pct} variant={pct >= 100 ? 'success' : 'primary'} style={{ height: 6 }} />
      </div>
    );
  };

  return (
    <div className="py-2">
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-4">
        <div>
          <h1 className="text-gradient mb-1">Legacy Warehouse Stock</h1>
          <p className="text-muted mb-0 small">
            All warehouse orders — <strong>system POs</strong> (scanned/imported) and <strong>manual legacy</strong> rows.
            Default filter shows <strong>Active</strong> orders. Use <strong>Add entry</strong> for spreadsheet-only prior-year stock.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Button variant="outline-secondary" onClick={handleExport}>
            <i className="bi bi-download me-1"></i> Export CSV
          </Button>
          <Button variant="primary" onClick={openAdd}>
            <i className="bi bi-plus-circle me-1"></i> Add entry
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Status summary chips */}
      <div className="modern-card mb-4">
        <div className="modern-card-body py-3">
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <span className="small text-muted me-1">By status:</span>
            {Object.entries(LEGACY_STATUS_OPTIONS).map(([key, label]) => {
              const cnt = statusCounts[key] || 0;
              if (cnt === 0 && filters.status && filters.status !== key) return null;
              return (
                <Badge
                  key={key}
                  bg={filters.status === key ? LEGACY_STATUS_BADGE[key] : 'light'}
                  text={filters.status === key ? undefined : 'dark'}
                  className="cursor-pointer"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setFilters((f) => ({
                    ...f,
                    status: f.status === key ? '' : key
                  }))}
                >
                  {label}: {cnt}
                </Badge>
              );
            })}
            <span className="small text-muted ms-auto">
              Showing <strong>{totalInList}</strong> matching row{totalInList !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="modern-card mb-4">
        <div className="modern-card-header">
          <h5 className="mb-0"><i className="bi bi-funnel me-2"></i>Filters</h5>
        </div>
        <div className="modern-card-body">
          <Form onSubmit={(e) => { e.preventDefault(); loadList(); }}>
            <div className="row g-3">
              <div className="col-md-3">
                <Form.Label className="small">Status</Form.Label>
                <Form.Select name="status" value={filters.status} onChange={handleFilterChange}>
                  <option value="">All statuses</option>
                  {Object.entries(LEGACY_STATUS_OPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Label className="small">Customer</Form.Label>
                <Form.Select name="customer" value={filters.customer} onChange={handleFilterChange}>
                  <option value="">All</option>
                  {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
              </div>
              <div className="col-md-2">
                <Form.Label className="small">Source year</Form.Label>
                <Form.Control
                  type="number"
                  name="source_year"
                  value={filters.source_year}
                  onChange={handleFilterChange}
                  placeholder="All years"
                />
              </div>
              <div className="col-md-3">
                <Form.Label className="small">Search</Form.Label>
                <Form.Control
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={handleFilterChange}
                  placeholder="PO, order no, style, remarks…"
                />
              </div>
              <div className="col-md-2 d-flex align-items-end">
                <Form.Check
                  type="checkbox"
                  name="in_warehouse_only"
                  label="Inside warehouse only"
                  checked={filters.in_warehouse_only}
                  onChange={handleFilterChange}
                  className="mb-2"
                />
              </div>
            </div>
            <div className="mt-3 d-flex gap-2">
              <Button type="submit" variant="primary" size="sm">Apply filters</Button>
              <Button
                type="button"
                variant="outline-secondary"
                size="sm"
                onClick={() => setFilters({
                  status: 'active',
                  customer: '',
                  source_year: '',
                  in_warehouse_only: false,
                  search: ''
                })}
              >
                Reset
              </Button>
            </div>
          </Form>
        </div>
      </div>

      {/* Table */}
      <div className="modern-card">
        <div className="modern-card-body p-0">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="text-muted mt-2 mb-0">Loading…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-inbox fs-1 d-block mb-2"></i>
              No orders match your filters. Try <strong>Reset</strong> (clear source year), or view{' '}
              <Link to="/pos">Purchase Orders</Link>.
            </div>
          ) : (
            <div className="modern-table-container">
              <table className="modern-table warehouse-stock-table mb-0">
                <thead>
                  <tr>
                    <th>Purchase order</th>
                    <th>Customer</th>
                    <th>Product</th>
                    <th className="text-end">Units</th>
                    <th style={{ minWidth: 140 }}>Cartons</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="fw-semibold">{row.internal_po}</div>
                        {row.customer_order_number && (
                          <div className="small text-muted">Order {row.customer_order_number}</div>
                        )}
                        {row.source_type === 'legacy' && (
                          <Badge bg="secondary" className="mt-1">Manual sheet</Badge>
                        )}
                      </td>
                      <td>{row.customer || '—'}{row.customer === 'Other' && row.customer_other ? ` (${row.customer_other})` : ''}</td>
                      <td>
                        {formatCell(row.style) || formatCell(row.color) ? (
                          <>
                            <div>{row.style || '—'}</div>
                            <div className="small text-muted">{row.color || ''}</div>
                          </>
                        ) : (
                          <span className="text-muted small">—</span>
                        )}
                        {row.source_type === 'legacy' && (row.remarks || row.new_developments) && (
                          <div className="small text-muted mt-1 text-truncate" style={{ maxWidth: 220 }} title={[row.remarks, row.new_developments].filter(Boolean).join(' · ')}>
                            {[row.remarks, row.new_developments].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="text-end small">
                        <div><span className="text-muted">Order</span> {row.order_qty != null ? row.order_qty.toLocaleString() : '—'}</div>
                        <div><span className="text-muted">In WH</span> <strong>{row.quantity_inside != null ? row.quantity_inside.toLocaleString() : '—'}</strong></div>
                        <div><span className="text-muted">Shipped</span> {row.shipped_qty != null ? row.shipped_qty.toLocaleString() : '—'}</div>
                      </td>
                      <td>{renderCartonProgress(row)}</td>
                      <td style={{ minWidth: 160 }}>
                        <Form.Select
                          size="sm"
                          value={row.status}
                          disabled={savingStatusId === row.id}
                          onChange={(e) => handleStatusChange(row, e.target.value)}
                          aria-label={`Status for ${row.internal_po}`}
                        >
                          {Object.entries(LEGACY_STATUS_OPTIONS).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </Form.Select>
                      </td>
                      <td className="text-end text-nowrap">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-1"
                          onClick={() => openEdit(row)}
                        >
                          <i className={`bi ${row.source_type === 'system' ? 'bi-box-arrow-up-right' : 'bi-pencil'} me-1`}></i>
                          {row.source_type === 'system' ? 'Open' : 'Edit'}
                        </Button>
                        {row.source_type === 'legacy' && (
                          <Button variant="outline-danger" size="sm" onClick={() => handleDeleteClick(row)}>
                            <i className="bi bi-trash"></i>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete entry</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deletingRow && (
            <p className="mb-0">
              Delete <strong>{deletingRow.internal_po}</strong>
              {deletingRow.style ? ` — ${deletingRow.style}` : ''}? You will be asked for the admin code to confirm.
            </p>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>Delete</Button>
        </Modal.Footer>
      </Modal>

      {/* Add / Edit modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>{editingId ? 'Edit entry' : 'Add legacy warehouse entry'}</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSave}>
          <Modal.Body>
            <div className="row g-3">
              <div className="col-md-4">
                <Form.Label>PO (FTM) *</Form.Label>
                <div className="input-group">
                  <span className="input-group-text">FTM-</span>
                  <Form.Control
                    name="internal_po"
                    value={form.internal_po}
                    onChange={handleFormChange}
                    required
                    placeholder="15730"
                  />
                </div>
              </div>
              <div className="col-md-4">
                <Form.Label>Order number</Form.Label>
                <Form.Control
                  name="customer_order_number"
                  value={form.customer_order_number}
                  onChange={handleFormChange}
                  placeholder="107256"
                />
              </div>
              <div className="col-md-4">
                <Form.Label>Customer</Form.Label>
                <Form.Select name="customer" value={form.customer} onChange={handleFormChange}>
                  {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Form.Select>
                {form.customer === 'Other' && (
                  <Form.Control
                    className="mt-2"
                    name="customer_other"
                    value={form.customer_other || ''}
                    onChange={handleFormChange}
                    placeholder="Enter customer name"
                    required
                  />
                )}
              </div>
              <div className="col-md-6">
                <Form.Label>Style</Form.Label>
                <Form.Control name="style" value={form.style} onChange={handleFormChange} />
              </div>
              <div className="col-md-6">
                <Form.Label>Colour</Form.Label>
                <Form.Control name="color" value={form.color} onChange={handleFormChange} />
              </div>
              <div className="col-md-3">
                <Form.Label>Order quantity</Form.Label>
                <Form.Control type="number" name="order_qty" value={form.order_qty} onChange={handleFormChange} min="0" />
              </div>
              <div className="col-md-3">
                <Form.Label>Quantity inside</Form.Label>
                <Form.Control type="number" name="quantity_inside" value={form.quantity_inside} onChange={handleFormChange} min="0" />
              </div>
              <div className="col-md-3">
                <Form.Label>No. of ctns (label)</Form.Label>
                <Form.Control name="cartons_label" value={form.cartons_label} onChange={handleFormChange} placeholder="70 CTNS" />
              </div>
              <div className="col-md-3">
                <Form.Label>Shipped qty</Form.Label>
                <Form.Control type="number" name="shipped_qty" value={form.shipped_qty} onChange={handleFormChange} min="0" />
              </div>
              <div className="col-md-6">
                <Form.Label>Status *</Form.Label>
                <Form.Select name="status" value={form.status} onChange={handleFormChange} required>
                  {Object.entries(LEGACY_STATUS_OPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Form.Select>
              </div>
              <div className="col-md-3">
                <Form.Label>Source year</Form.Label>
                <Form.Control type="number" name="source_year" value={form.source_year} onChange={handleFormChange} />
              </div>
              <div className="col-12">
                <Form.Label>Remarks</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  name="remarks"
                  value={form.remarks}
                  onChange={handleFormChange}
                  placeholder="e.g. CANCELLED, MOVED TO WEEK 32, GOODS LEFT AFTER SHIPPING"
                />
              </div>
              <div className="col-12">
                <Form.Label>New developments</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  name="new_developments"
                  value={form.new_developments}
                  onChange={handleFormChange}
                  placeholder="e.g. Taken by IE dept to stockroom on 2026-05-18"
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default LegacyWarehouseGoods;
