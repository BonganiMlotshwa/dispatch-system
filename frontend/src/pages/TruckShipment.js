import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { getInternalPoSortValue } from '../utils/poDisplay';

const TruckShipment = () => {
  const [shipments, setShipments] = useState([]);
  const [availableOrders, setAvailableOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [formData, setFormData] = useState({
    shipment_date: new Date().toISOString().split('T')[0],
    shipment_week: '',
    truck_reg: '',
    driver_name: '',
    remarks: '',
    items: []
  });

  useEffect(() => {
    fetchShipments();
    fetchAvailableOrders();
  }, []);

  const fetchShipments = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/truck_shipment.php`);
      if (response.data.success) {
        setShipments(response.data.shipments);
      }
    } catch (error) {
      console.error('Error fetching shipments:', error);
    }
  };

  const fetchAvailableOrders = async () => {
    try {
      // Get shipments with entered cartons
      const response = await axios.get(`${API_BASE_URL}/shipments.php`);
      if (response.data.success) {
        const sorted = [...(response.data.shipments || [])].sort((a, b) => {
          const aVal = getInternalPoSortValue(a.internal_po_number);
          const bVal = getInternalPoSortValue(b.internal_po_number);
          if (aVal === bVal) {
            return String(a.internal_po_number || '').localeCompare(String(b.internal_po_number || ''));
          }
          return aVal - bVal;
        });
        setAvailableOrders(sorted);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const addOrderToShipment = (order) => {
    if (formData.items.find(item => item.shipment_id === order.id)) {
      alert('This order is already added');
      return;
    }

    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        shipment_id: order.id,
        internal_po_number: order.internal_po_number,
        customer: order.customer,
        cartons_shipped: order.in_warehouse_count || 0,
        units_shipped: 0,
        order_qty: order.order_qty || 0
      }]
    }));
  };

  const removeOrderFromShipment = (shipmentId) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.shipment_id !== shipmentId)
    }));
  };

  const updateItemQuantity = (shipmentId, field, value) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.map(item =>
        item.shipment_id === shipmentId
          ? { ...item, [field]: parseInt(value) || 0 }
          : item
      )
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      alert('Please add at least one order to the shipment');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/truck_shipment.php`, formData);
      
      if (response.data.success) {
        alert('Truck shipment created successfully!');
        setShowForm(false);
        setFormData({
          shipment_date: new Date().toISOString().split('T')[0],
          shipment_week: '',
          truck_reg: '',
          driver_name: '',
          remarks: '',
          items: []
        });
        fetchShipments();
      }
    } catch (error) {
      alert('Error creating truck shipment: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = (shipment) => {
    window.location.href = `${API_BASE_URL}/truck_shipment_export.php?id=${shipment.id}&format=csv`;
  };

  const exportToPDF = (shipment) => {
    window.open(`${API_BASE_URL}/truck_shipment_export.php?id=${shipment.id}&format=pdf`, '_blank');
  };

  const totalCartons = formData.items.reduce((sum, item) => sum + item.cartons_shipped, 0);
  const totalUnits = formData.items.reduce((sum, item) => sum + item.units_shipped, 0);

  return (
    <div className="py-2">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="text-gradient mb-0">Truck Shipment Management</h1>
        <button
          className="btn-modern btn-modern-primary"
          onClick={() => setShowForm(!showForm)}
        >
          <i className="bi bi-plus-circle"></i> {showForm ? 'Cancel' : 'New Shipment'}
        </button>
      </div>

      {showForm && (
        <div className="modern-card mb-4">
          <div className="modern-card-header">
            <h5 className="mb-0">Create Truck Shipment</h5>
          </div>
          <div className="modern-card-body">
            <form onSubmit={handleSubmit}>
              <div className="row mb-3">
                <div className="col-md-3">
                  <label className="form-label">Shipment Date *</label>
                  <input
                    type="date"
                    className="form-control"
                    name="shipment_date"
                    value={formData.shipment_date}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Shipment Week</label>
                  <input
                    type="text"
                    className="form-control"
                    name="shipment_week"
                    value={formData.shipment_week}
                    onChange={handleInputChange}
                    placeholder="e.g., Wk16"
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Truck Registration *</label>
                  <input
                    type="text"
                    className="form-control"
                    name="truck_reg"
                    value={formData.truck_reg}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Driver Name</label>
                  <input
                    type="text"
                    className="form-control"
                    name="driver_name"
                    value={formData.driver_name}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label">Remarks</label>
                <textarea
                  className="form-control"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleInputChange}
                  rows="2"
                  placeholder="E.g., shipment incomplete, short of 1 box due to less cut of PO"
                />
              </div>

              <hr />

              <h6 className="mb-3">Add Orders to Shipment</h6>
              <div className="mb-3">
                <select
                  className="form-select"
                  onChange={(e) => {
                    const order = availableOrders.find(o => o.id === parseInt(e.target.value));
                    if (order) addOrderToShipment(order);
                    e.target.value = '';
                  }}
                >
                  <option value="">Select an order to add...</option>
                  {availableOrders.map(order => (
                    <option key={order.id} value={order.id}>
                      {order.internal_po_number} - {order.customer} ({order.in_warehouse_count || 0} cartons available)
                    </option>
                  ))}
                </select>
              </div>

              {formData.items.length > 0 && (
                <div className="table-responsive mb-3">
                  <table className="table-modern">
                    <thead>
                      <tr>
                        <th>PO Number</th>
                        <th>Customer</th>
                        <th>Order Qty</th>
                        <th>Cartons Shipped</th>
                        <th>Units Shipped</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {formData.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.internal_po_number}</td>
                          <td>{item.customer}</td>
                          <td>{item.order_qty.toLocaleString()}</td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              value={item.cartons_shipped}
                              onChange={(e) => updateItemQuantity(item.shipment_id, 'cartons_shipped', e.target.value)}
                              min="0"
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              className="form-control form-control-sm"
                              value={item.units_shipped}
                              onChange={(e) => updateItemQuantity(item.shipment_id, 'units_shipped', e.target.value)}
                              min="0"
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm btn-danger"
                              onClick={() => removeOrderFromShipment(item.shipment_id)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr className="table-active fw-bold">
                        <td colSpan="3">Total</td>
                        <td>{totalCartons}</td>
                        <td>{totalUnits.toLocaleString()}</td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modern btn-modern-success"
                  disabled={loading || formData.items.length === 0}
                >
                  {loading ? 'Creating...' : 'Create Shipment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="modern-card">
        <div className="modern-card-header">
          <h5 className="mb-0">Truck Shipments</h5>
        </div>
        <div className="modern-card-body p-0">
          <div className="table-responsive">
            <table className="table-modern mb-0">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Week</th>
                  <th>Truck Reg</th>
                  <th>Driver</th>
                  <th>Orders</th>
                  <th>Total Cartons</th>
                  <th>Total Units</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {shipments.length > 0 ? (
                  shipments.map(shipment => (
                    <tr key={shipment.id}>
                      <td>{new Date(shipment.shipment_date).toLocaleDateString()}</td>
                      <td>{shipment.shipment_week || '-'}</td>
                      <td className="fw-medium">{shipment.truck_reg}</td>
                      <td>{shipment.driver_name || '-'}</td>
                      <td>{shipment.total_orders || 0}</td>
                      <td>{shipment.total_cartons || 0}</td>
                      <td>{(shipment.total_units || 0).toLocaleString()}</td>
                      <td>{shipment.remarks || '-'}</td>
                      <td>
                        <button
                          className="btn btn-sm btn-success me-1"
                          onClick={() => exportToCSV(shipment)}
                          title="Export to CSV"
                        >
                          <i className="bi bi-file-earmark-spreadsheet"></i>
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => exportToPDF(shipment)}
                          title="Export to PDF"
                        >
                          <i className="bi bi-file-earmark-pdf"></i>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="text-center py-4">
                      <p className="text-muted mb-0">No truck shipments found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Signature Section */}
      <div className="modern-card mt-5 print-only" style={{ borderTop: '3px solid #dee2e6' }}>
        <div className="modern-card-body">
          <div className="row g-4 text-center">
            <div className="col-md-4">
              <div style={{ minHeight: '80px', borderBottom: '2px solid #000', marginBottom: '8px' }}></div>
              <div className="fw-bold">1. PREPARED BY:</div>
              <div className="small text-muted">NAME AND SIGNATURE</div>
            </div>
            <div className="col-md-4">
              <div style={{ minHeight: '80px', borderBottom: '2px solid #000', marginBottom: '8px' }}></div>
              <div className="fw-bold">2. NOTED BY:</div>
              <div className="small text-muted">DEPARTMENT MANAGER</div>
            </div>
            <div className="col-md-4">
              <div style={{ minHeight: '80px', borderBottom: '2px solid #000', marginBottom: '8px' }}></div>
              <div className="fw-bold">3. NOTED BY:</div>
              <div className="small text-muted">VICE FACTORY MANAGER</div>
            </div>
          </div>
          <div className="row g-4 text-center mt-3">
            <div className="col-md-4">
              <div style={{ minHeight: '80px', borderBottom: '2px solid #000', marginBottom: '8px' }}></div>
              <div className="fw-bold">4. APPROVED BY:</div>
              <div className="small text-muted">VICE FACTORY ADMINISTRATION DIRECTOR</div>
            </div>
            <div className="col-md-4">
              <div style={{ minHeight: '60px' }}></div>
            </div>
            <div className="col-md-4">
              <div style={{ minHeight: '80px', borderBottom: '2px solid #000', marginBottom: '8px' }}></div>
              <div className="fw-bold">5. NOTED BY:</div>
              <div className="small text-muted">MANAGING DIRECTOR</div>
            </div>
          </div>
          <div className="text-muted small mt-3" style={{ fontSize: '0.75rem' }}>
            Note: Please Print (Name, Signature, Date & Time)
          </div>
          
          {/* Company Logos Section */}
          <div className="row g-4 mt-4 pt-3" style={{ borderTop: '1px solid #dee2e6' }}>
            <div className="col-md-4 text-start">
              <img src={process.env.PUBLIC_URL + '/sabs_iso.png'} alt="SABS ISO 9001" style={{ maxHeight: '80px', maxWidth: '100%' }} />
            </div>
            <div className="col-md-4 text-center">
              <img src={process.env.PUBLIC_URL + '/ftm.png'} alt="FTM" style={{ maxHeight: '80px', maxWidth: '100%' }} />
            </div>
            <div className="col-md-4 text-end">
              <img src={process.env.PUBLIC_URL + '/sabs.png'} alt="SABS Approved" style={{ maxHeight: '80px', maxWidth: '100%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TruckShipment;
