import React, { useState } from 'react';
import { Modal, Button, ListGroup, Form, Spinner } from 'react-bootstrap';

/**
 * Choose how to handle exit / truck loading when starting exit scans.
 */
const TruckLoadChoiceModal = ({
  show,
  onHide,
  activeTrucks = [],
  loadingTrucks = false,
  onContinueTruck,
  onNewTruck
}) => {
  const [selectedId, setSelectedId] = useState('');

  const handleOpen = () => {
    if (activeTrucks.length === 1) {
      setSelectedId(String(activeTrucks[0].id));
    } else {
      setSelectedId('');
    }
  };

  const selectedTruck = activeTrucks.find((t) => String(t.id) === String(selectedId));

  const handleContinue = () => {
    if (selectedTruck) {
      onContinueTruck(selectedTruck);
    }
  };

  const formatTruckMeta = (truck) => {
    const ctns = Number(truck.cartons_loaded || 0);
    const units = Number(truck.units_loaded || 0);
    const date = truck.shipment_date
      ? new Date(truck.shipment_date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })
      : '';
    const parts = [];
    if (date) parts.push(date);
    if (ctns > 0) parts.push(`${ctns} ctns`);
    if (units > 0) parts.push(`${units} units`);
    return parts.join(' · ') || 'No cartons loaded yet';
  };

  return (
    <Modal show={show} onHide={onHide} centered onShow={handleOpen} onEnter={handleOpen}>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-truck me-2"></i>
          Exit Warehouse — Load Options
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          You can load onto an open truck or start a new truck before scanning cartons out.
        </p>

        {loadingTrucks ? (
          <div className="text-center py-3 text-muted small">
            <Spinner animation="border" size="sm" className="me-2" />
            Loading open trucks…
          </div>
        ) : activeTrucks.length > 0 ? (
          <div className="mb-4 p-3 rounded border bg-light">
            <p className="fw-semibold mb-2">
              <i className="bi bi-arrow-repeat me-1"></i>
              Load onto existing truck
            </p>
            <p className="text-muted small mb-3">
              {activeTrucks.length === 1
                ? 'One open truck is waiting — continue loading or pick another option below.'
                : `${activeTrucks.length} open trucks — select the one you want to continue loading.`}
            </p>

            {activeTrucks.length === 1 ? (
              <ListGroup className="mb-3">
                <ListGroup.Item
                  action
                  active
                  onClick={() => onContinueTruck(activeTrucks[0])}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{activeTrucks[0].truck_reg}</strong>
                    <div className="small text-muted">{activeTrucks[0].driver_name || 'No driver name'}</div>
                    <div className="small text-muted">{formatTruckMeta(activeTrucks[0])}</div>
                  </div>
                  <i className="bi bi-arrow-right-circle text-primary fs-5"></i>
                </ListGroup.Item>
              </ListGroup>
            ) : (
              <>
                <Form.Group className="mb-2">
                  <Form.Label className="small text-muted mb-1">Select truck</Form.Label>
                  <Form.Select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="form-control-modern"
                  >
                    <option value="">Choose a truck…</option>
                    {activeTrucks.map((truck) => (
                      <option key={truck.id} value={truck.id}>
                        {truck.truck_reg} — {truck.driver_name || 'No driver'} ({formatTruckMeta(truck)})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
                <div className="d-grid mb-2">
                  <Button variant="success" disabled={!selectedTruck} onClick={handleContinue}>
                    <i className="bi bi-truck me-2"></i>
                    Continue loading selected truck
                  </Button>
                </div>
                <ListGroup className="mb-0">
                  {activeTrucks.map((truck) => (
                    <ListGroup.Item
                      key={truck.id}
                      action
                      active={String(truck.id) === String(selectedId)}
                      onClick={() => {
                        setSelectedId(String(truck.id));
                        onContinueTruck(truck);
                      }}
                      className="d-flex justify-content-between align-items-center py-2"
                    >
                      <div>
                        <strong>{truck.truck_reg}</strong>
                        <div className="small text-muted">{truck.driver_name || 'No driver name'}</div>
                        <div className="small text-muted">{formatTruckMeta(truck)}</div>
                      </div>
                      <i className="bi bi-arrow-right-circle text-primary"></i>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </>
            )}
          </div>
        ) : (
          <p className="text-muted small mb-3">
            <i className="bi bi-info-circle me-1"></i>
            No open trucks right now. Start a new truck before scanning cartons out.
          </p>
        )}

        <div className="d-grid gap-2">
          <Button variant="primary" onClick={onNewTruck}>
            <i className="bi bi-plus-circle me-2"></i>
            Load onto new truck
          </Button>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={onHide}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default TruckLoadChoiceModal;
