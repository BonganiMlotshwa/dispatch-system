import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { getCustomerPoPrefix, getInternalPoPrefix } from '../utils/poDisplay';

const ManualEntry = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    customer: 'OTB',
    order_no: '',
    customer_po: '',
    style: '',
    color: '',
    order_qty: '',
    cartons_expected: '',
    units_expected: '',
    cartons_received: '',
    units_received: ''
  });

  const customers = ['MRP', 'OTB', 'OBSW', 'Other'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'customer') {
      setFormData({
        ...formData,
        customer: value,
        customer_po: ''
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await apiService.post('/manual_entry.php', formData);
      
      if (response.data && response.data.success) {
        setSuccess('Entry created successfully!');
        setTimeout(() => {
          navigate(`/shipment/${response.data.shipment_id}`);
        }, 1500);
      } else {
        setError(response.data?.message || 'Failed to create entry');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const customerPrefix = getCustomerPoPrefix(formData.customer);
  const internalPrefix = getInternalPoPrefix(formData.customer);
  const orderDigits = formData.order_no ? formData.order_no.replace(/^[A-Za-z]+-/i, '') : '';
  const orderPreview = orderDigits ? `${internalPrefix}${orderDigits}` : `${internalPrefix}___`;
  const customerPoPreview = `${customerPrefix}${formData.customer_po || '___'}`;

  return (
    <div className="py-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="text-gradient mb-0">Manual Entry</h1>
      </div>

      <div className="row">
        <div className="col-lg-8">
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0">Enter Customer Order</h5>
            </div>
            <div className="modern-card-body">
              {error && (
                <div className="alert-modern alert-modern-danger mb-3">
                  <i className="bi bi-exclamation-triangle-fill"></i>
                  <div>{error}</div>
                </div>
              )}

              {success && (
                <div className="alert-modern alert-modern-success mb-3">
                  <i className="bi bi-check-circle-fill"></i>
                  <div>{success}</div>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label">Customer *</label>
                    <select
                      className="form-control"
                      name="customer"
                      value={formData.customer}
                      onChange={handleChange}
                      required
                    >
                      {customers.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Order No *</label>
                    <div className="input-group">
                      <span className="input-group-text">{internalPrefix}</span>
                      <input
                        type="text"
                        className="form-control"
                        name="order_no"
                        value={formData.order_no}
                        onChange={handleChange}
                        placeholder={formData.customer === 'OTB' ? 'e.g., 809' : 'e.g., 125459'}
                        required
                      />
                    </div>
                    <small className="text-muted">Internal PO: {orderPreview}</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Customer PO *</label>
                    <div className="input-group">
                      <span className="input-group-text">{customerPrefix}</span>
                      <input
                        type="text"
                        className="form-control"
                        name="customer_po"
                        value={formData.customer_po}
                        onChange={handleChange}
                        placeholder="e.g., 809"
                        required
                      />
                    </div>
                    <small className="text-muted">Customer PO: {customerPoPreview}</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Style *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="style"
                      value={formData.style}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Color *</label>
                    <input
                      type="text"
                      className="form-control"
                      name="color"
                      value={formData.color}
                      onChange={handleChange}
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Order Quantity *</label>
                    <input
                      type="number"
                      className="form-control"
                      name="order_qty"
                      value={formData.order_qty}
                      onChange={handleChange}
                      min="1"
                      required
                    />
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Cartons Expected *</label>
                    <input
                      type="number"
                      className="form-control"
                      name="cartons_expected"
                      value={formData.cartons_expected}
                      onChange={handleChange}
                      min="1"
                      required
                    />
                    <small className="text-muted">Total cartons in order</small>
                  </div>

                  <div className="col-md-4">
                    <label className="form-label">Units Expected *</label>
                    <input
                      type="number"
                      className="form-control"
                      name="units_expected"
                      value={formData.units_expected}
                      onChange={handleChange}
                      min="1"
                      required
                    />
                    <small className="text-muted">Total units in order</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Cartons Received Today</label>
                    <input
                      type="number"
                      className="form-control"
                      name="cartons_received"
                      value={formData.cartons_received}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                    />
                    <small className="text-muted">Leave 0 if none received yet</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label">Units Received Today</label>
                    <input
                      type="number"
                      className="form-control"
                      name="units_received"
                      value={formData.units_received}
                      onChange={handleChange}
                      min="0"
                      placeholder="0"
                    />
                    <small className="text-muted">Leave 0 if none received yet</small>
                  </div>

                </div>

                <div className="mt-4">
                  <button
                    type="submit"
                    className="btn-modern btn-modern-primary me-2"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Creating...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        Create Entry
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn-modern btn-modern-secondary"
                    onClick={() => navigate('/dashboard')}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-4">
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0">Instructions</h5>
            </div>
            <div className="modern-card-body">
              <p className="small text-muted mb-2">
                Use this form to manually enter data for customers like Otto, OBSW, etc.
              </p>
              <ul className="small text-muted">
                <li><strong>Order No</strong> is your internal FTM PO (e.g. FTM-125459)</li>
                <li><strong>Customer PO</strong> is the customer&apos;s PO (e.g. OTTO-809 for OTB)</li>
                <li>Provide style and color information</li>
                <li>Enter order quantity and expected cartons/units</li>
                <li>System will automatically create carton records</li>
              </ul>
              <hr className="my-3" />
              <p className="small fw-semibold mb-2">Prior-year stock still in warehouse? (Spec 1.5)</p>
              <p className="small text-muted mb-2">
                Cancelled, failed audit, waiting for booking, not audited, etc. — use the legacy tracker (not this form).
              </p>
              <Link to="/legacy-warehouse" className="btn btn-sm btn-outline-primary w-100">
                <i className="bi bi-archive me-1"></i>
                Legacy Warehouse Stock
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualEntry;
