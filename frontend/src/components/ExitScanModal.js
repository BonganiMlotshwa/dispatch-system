import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';

/**
 * Exit Scan Modal — driver info, optional manual-order truck assignment (OTB/OBSW), then scanning.
 */
const ExitScanModal = ({ show, onHide, onSuccess }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [driverInfo, setDriverInfo] = useState({
    truck_reg: '',
    driver_name: '',
    driver_surname: '',
    ftm_pin: '',
    shipment_date: new Date().toISOString().split('T')[0],
    shipment_week: `Wk${Math.ceil(new Date().getDate() / 7)}`
  });

  const [assignManualOrders, setAssignManualOrders] = useState(false);
  const [manualOrders, setManualOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set());

  const [currentTruck, setCurrentTruck] = useState(null);
  const [barcode, setBarcode] = useState('');
  const [scannedCartons, setScannedCartons] = useState([]);
  const [scanResult, setScanResult] = useState(null);

  const fetchManualOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/manual_truck_orders.php`);
      if (response.data.success) {
        setManualOrders(response.data.orders || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load manual orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (show && assignManualOrders && manualOrders.length === 0 && !loadingOrders) {
      fetchManualOrders();
    }
  }, [show, assignManualOrders]);

  const handleDriverInfoChange = (e) => {
    const { name, value } = e.target;
    setDriverInfo((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(orderId)) {
        next.delete(orderId);
      } else {
        next.add(orderId);
      }
      return next;
    });
  };

  const handleAssignManualToggle = (e) => {
    const checked = e.target.checked;
    setAssignManualOrders(checked);
    if (!checked) {
      setSelectedOrderIds(new Set());
    } else if (manualOrders.length === 0) {
      fetchManualOrders();
    }
  };

  const buildAssignOrdersPayload = () => {
    return manualOrders
      .filter((o) => selectedOrderIds.has(o.id))
      .map((o) => ({
        shipment_id: o.id,
        cartons_shipped: o.cartons_in_warehouse,
        units_shipped: o.units_in_warehouse
      }));
  };

  const handleDriverInfoSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (driverInfo.ftm_pin.length < 4) {
        throw new Error('Employee pin must be at least 4 digits');
      }

      if (assignManualOrders && selectedOrderIds.size === 0) {
        throw new Error('Select at least one manual order to assign, or turn off manual order assignment.');
      }

      const payload = {
        truck_reg: driverInfo.truck_reg,
        driver_name: `${driverInfo.driver_name} ${driverInfo.driver_surname}`.trim(),
        shipment_date: driverInfo.shipment_date,
        shipment_week: driverInfo.shipment_week
      };

      if (assignManualOrders && selectedOrderIds.size > 0) {
        payload.assign_orders = buildAssignOrdersPayload();
      }

      const response = await axios.post(`${API_BASE_URL}/quick_truck.php`, payload);

      if (response.data.success) {
        localStorage.setItem('active_truck', JSON.stringify(response.data.truck));

        if (onSuccess) {
          onSuccess({
            truck: response.data.truck,
            mode: 'created',
            assigned_orders: response.data.assigned_orders || [],
            assign_errors: response.data.assign_errors || []
          });
        }

        handleClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to create truck shipment');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = async (e) => {
    e.preventDefault();

    if (!barcode.trim()) {
      setError('Please enter a barcode');
      return;
    }

    setLoading(true);
    setError('');
    setScanResult(null);

    try {
      const employeeName = localStorage.getItem('employee_name') || 'System';

      const response = await axios.post(`${API_BASE_URL}/scan_carton_v2.php`, {
        barcode: barcode.trim(),
        action: 'exit',
        scanned_by: employeeName,
        truck_shipment_id: currentTruck.id,
        notes: `Loaded to ${currentTruck.truck_reg}`
      });

      if (response.data.success) {
        const newCarton = {
          barcode: response.data.carton.barcode,
          po_number: response.data.carton.po_number,
          units: response.data.carton.units,
          customer: response.data.shipment.customer,
          timestamp: new Date().toLocaleTimeString()
        };

        setScannedCartons((prev) => [newCarton, ...prev]);
        setScanResult(response.data);
        setBarcode('');

        if (navigator.vibrate) navigator.vibrate(200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Scan failed');
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = () => {
    if (onSuccess) {
      onSuccess({
        truck: currentTruck,
        cartonsScanned: scannedCartons.length,
        totalUnits: scannedCartons.reduce((sum, c) => sum + parseInt(c.units || 0, 10), 0)
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setStep(1);
    setDriverInfo({
      truck_reg: '',
      driver_name: '',
      driver_surname: '',
      ftm_pin: '',
      shipment_date: new Date().toISOString().split('T')[0],
      shipment_week: `Wk${Math.ceil(new Date().getDate() / 7)}`
    });
    setAssignManualOrders(false);
    setManualOrders([]);
    setSelectedOrderIds(new Set());
    setCurrentTruck(null);
    setBarcode('');
    setScannedCartons([]);
    setScanResult(null);
    setError('');
    onHide();
  };

  const totalUnits = scannedCartons.reduce((sum, c) => sum + parseInt(c.units || 0, 10), 0);

  return (
    <Modal show={show} onHide={handleClose} size="lg" backdrop="static">
      <Modal.Header closeButton>
        <Modal.Title>
          {step === 1 ? (
            <>
              <i className="bi bi-truck me-2"></i>
              Exit Warehouse - Driver Information
            </>
          ) : (
            <>
              <i className="bi bi-upc-scan me-2"></i>
              Scanning to: {currentTruck?.truck_reg}
            </>
          )}
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            <i className="bi bi-exclamation-triangle me-2"></i>
            {error}
          </Alert>
        )}

        {step === 1 ? (
          <Form onSubmit={handleDriverInfoSubmit}>
            <Alert variant="info" className="mb-3">
              <i className="bi bi-info-circle me-2"></i>
              Enter driver and truck information to begin exit scanning
            </Alert>

            <Form.Group className="mb-3">
              <Form.Label>Truck Registration *</Form.Label>
              <Form.Control
                type="text"
                name="truck_reg"
                value={driverInfo.truck_reg}
                onChange={handleDriverInfoChange}
                placeholder="e.g., ABC 123 GP"
                required
                autoFocus
                style={{ textTransform: 'uppercase' }}
              />
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Driver First Name *</Form.Label>
                  <Form.Control
                    type="text"
                    name="driver_name"
                    value={driverInfo.driver_name}
                    onChange={handleDriverInfoChange}
                    placeholder="First name"
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Driver Surname *</Form.Label>
                  <Form.Control
                    type="text"
                    name="driver_surname"
                    value={driverInfo.driver_surname}
                    onChange={handleDriverInfoChange}
                    placeholder="Last name"
                    required
                  />
                </Form.Group>
              </div>
            </div>

            <Form.Group className="mb-3">
              <Form.Label>Employee Pin *</Form.Label>
              <Form.Control
                type="text"
                name="ftm_pin"
                value={driverInfo.ftm_pin}
                onChange={handleDriverInfoChange}
                placeholder="Enter your employee pin"
                required
                minLength="4"
              />
              <Form.Text className="text-muted">Enter your employee pin (e.g., 12901)</Form.Text>
            </Form.Group>

            <div className="row">
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Shipment Date *</Form.Label>
                  <Form.Control
                    type="date"
                    name="shipment_date"
                    value={driverInfo.shipment_date}
                    onChange={handleDriverInfoChange}
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-md-6">
                <Form.Group className="mb-3">
                  <Form.Label>Week *</Form.Label>
                  <Form.Control
                    type="text"
                    name="shipment_week"
                    value={driverInfo.shipment_week}
                    onChange={handleDriverInfoChange}
                    placeholder="e.g., Wk16"
                    required
                  />
                  <Form.Text className="text-muted">Format: Wk## (e.g., Wk16)</Form.Text>
                </Form.Group>
              </div>
            </div>

            <div className="border rounded p-3 mb-3 bg-light">
              <Form.Check
                type="switch"
                id="assign-manual-orders"
                label={
                  <span>
                    <strong>Assign manual customer orders to this truck</strong>
                    <br />
                    <small className="text-muted">
                      For OTB, OBSW and other non-MRP orders entered via Manual Entry — ships whole orders without scanning each carton.
                    </small>
                  </span>
                }
                checked={assignManualOrders}
                onChange={handleAssignManualToggle}
              />

              {assignManualOrders && (
                <div className="mt-3">
                  {loadingOrders ? (
                    <div className="text-center py-3">
                      <Spinner size="sm" className="me-2" />
                      Loading manual orders…
                    </div>
                  ) : manualOrders.length === 0 ? (
                    <Alert variant="secondary" className="mb-0 small">
                      No manual orders (OTB/OBSW) with cartons still in the warehouse.
                    </Alert>
                  ) : (
                    <>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <small className="text-muted">Select orders to load onto this truck</small>
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0"
                          type="button"
                          onClick={() => {
                            if (selectedOrderIds.size === manualOrders.length) {
                              setSelectedOrderIds(new Set());
                            } else {
                              setSelectedOrderIds(new Set(manualOrders.map((o) => o.id)));
                            }
                          }}
                        >
                          {selectedOrderIds.size === manualOrders.length ? 'Clear all' : 'Select all'}
                        </Button>
                      </div>
                      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                        {manualOrders.map((order) => (
                          <Form.Check
                            key={order.id}
                            type="checkbox"
                            id={`manual-order-${order.id}`}
                            className="mb-2"
                            checked={selectedOrderIds.has(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            label={
                              <span>
                                <strong>{order.customer}</strong> — {order.internal_po_number}
                                {order.customer_po_number && order.customer_po_number !== 'N/A' && (
                                  <span className="text-muted"> ({order.customer_po_number})</span>
                                )}
                                <br />
                                <small className="text-muted">
                                  {order.cartons_in_warehouse} ctns · {order.units_in_warehouse.toLocaleString()} units
                                  {order.style ? ` · ${order.style}` : ''}
                                </small>
                              </span>
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="d-grid gap-2">
              <Button variant="primary" type="submit" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2"></span>
                    {assignManualOrders && selectedOrderIds.size > 0
                      ? 'Creating truck & assigning orders…'
                      : 'Creating Truck…'}
                  </>
                ) : (
                  <>
                    <i className="bi bi-arrow-right-circle me-2"></i>
                    Start Scanning
                    {assignManualOrders && selectedOrderIds.size > 0 && (
                      <span className="ms-1">({selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? 's' : ''} assigned)</span>
                    )}
                  </>
                )}
              </Button>
            </div>
          </Form>
        ) : (
          <div>
            <div className="alert alert-success mb-3">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <strong><i className="bi bi-truck me-2"></i>{currentTruck?.truck_reg}</strong>
                  <br />
                  <small>Driver: {currentTruck?.driver_name}</small>
                </div>
                <div className="text-end">
                  <h4 className="mb-0">{scannedCartons.length}</h4>
                  <small>Cartons Loaded</small>
                </div>
              </div>
            </div>

            <Form onSubmit={handleScan}>
              <Form.Group className="mb-3">
                <Form.Label>Scan Barcode</Form.Label>
                <div className="input-group input-group-lg">
                  <span className="input-group-text">
                    <i className="bi bi-upc-scan"></i>
                  </span>
                  <Form.Control
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Scan or enter barcode"
                    autoFocus
                    disabled={loading}
                  />
                  <Button variant="primary" type="submit" disabled={loading || !barcode.trim()}>
                    {loading ? 'Scanning...' : 'Scan'}
                  </Button>
                </div>
              </Form.Group>
            </Form>

            {scanResult && (
              <Alert variant="success" className="mb-3">
                <i className="bi bi-check-circle me-2"></i>
                <strong>Scanned:</strong> {scanResult.carton.barcode} - {scanResult.carton.units} units
              </Alert>
            )}

            {scannedCartons.length > 0 && (
              <div className="mt-3">
                <h6>Scanned Cartons ({scannedCartons.length} cartons, {totalUnits} units)</h6>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <table className="table table-sm table-striped">
                    <thead className="table-dark sticky-top">
                      <tr>
                        <th>Time</th>
                        <th>Barcode</th>
                        <th>PO</th>
                        <th>Customer</th>
                        <th className="text-end">Units</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scannedCartons.map((carton, index) => (
                        <tr key={index}>
                          <td><small>{carton.timestamp}</small></td>
                          <td><code>{carton.barcode}</code></td>
                          <td>{carton.po_number}</td>
                          <td>{carton.customer}</td>
                          <td className="text-end">{carton.units}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal.Body>

      <Modal.Footer>
        {step === 1 ? (
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
        ) : (
          <>
            <div className="me-auto">
              <strong>{scannedCartons.length}</strong> cartons, <strong>{totalUnits}</strong> units loaded
            </div>
            <Button variant="secondary" onClick={handleClose}>
              Cancel Loading
            </Button>
            <Button variant="success" onClick={handleComplete} disabled={scannedCartons.length === 0}>
              <i className="bi bi-check-circle me-2"></i>
              Complete Loading
            </Button>
          </>
        )}
      </Modal.Footer>
    </Modal>
  );
};

export default ExitScanModal;
