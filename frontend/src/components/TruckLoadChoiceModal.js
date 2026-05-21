import React from 'react';
import { Modal, Button, ListGroup } from 'react-bootstrap';

/**
 * Choose how to handle exit / truck loading when starting exit scans.
 */
const TruckLoadChoiceModal = ({
  show,
  onHide,
  activeTrucks = [],
  onContinueTruck,
  onNewTruck,
  onExitWithoutTruck
}) => {
  return (
    <Modal show={show} onHide={onHide} centered>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-truck me-2"></i>
          Exit Warehouse — Load Options
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="text-muted small mb-3">
          You can load onto an open truck, start a new truck, or exit cartons without assigning a truck
          (useful when goods arrive later or multiple trucks load at once).
        </p>

        {activeTrucks.length > 0 && (
          <>
            <p className="fw-medium mb-2">Continue loading an open truck</p>
            <ListGroup className="mb-3">
              {activeTrucks.map((truck) => (
                <ListGroup.Item
                  key={truck.id}
                  action
                  onClick={() => onContinueTruck(truck)}
                  className="d-flex justify-content-between align-items-center"
                >
                  <div>
                    <strong>{truck.truck_reg}</strong>
                    <div className="small text-muted">{truck.driver_name || 'No driver name'}</div>
                  </div>
                  <i className="bi bi-arrow-right-circle text-primary"></i>
                </ListGroup.Item>
              ))}
            </ListGroup>
          </>
        )}

        <div className="d-grid gap-2">
          <Button variant="primary" onClick={onNewTruck}>
            <i className="bi bi-plus-circle me-2"></i>
            Load onto new truck
          </Button>
          <Button variant="outline-secondary" onClick={onExitWithoutTruck}>
            <i className="bi bi-box-arrow-right me-2"></i>
            Exit without truck (no load assignment)
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
