import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const DatabaseTest = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shipments, setShipments] = useState([]);
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [cartons, setCartons] = useState([]);
  
  // Fetch shipments on component mount
  useEffect(() => {
    const fetchShipments = async () => {
      try {
        setLoading(true);
        // This would be a real API endpoint in production
        const response = await axios.get(`${API_BASE_URL}/test_shipments.php`);
        setShipments(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching shipments:', err);
        setError('Failed to fetch shipments. Please check the backend connection.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchShipments();
  }, []);
  
  // Fetch cartons when a shipment is selected
  useEffect(() => {
    if (!selectedShipment) {
      setCartons([]);
      return;
    }
    
    const fetchCartons = async () => {
      try {
        setLoading(true);
        // This would be a real API endpoint in production
        const response = await axios.get(`${API_BASE_URL}/test_cartons.php?shipment_id=${selectedShipment}`);
        setCartons(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching cartons:', err);
        setError('Failed to fetch cartons. Please check the backend connection.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCartons();
  }, [selectedShipment]);
  
  return (
    <div className="database-test">
      <h2>Database Connection Test</h2>
      
      {error && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {error}
        </div>
      )}
      
      <div className="card mb-4">
        <div className="card-header bg-primary text-white">
          <h3 className="card-title mb-0">Shipments</h3>
        </div>
        <div className="card-body">
          {loading && !shipments.length ? (
            <p>Loading shipments...</p>
          ) : shipments.length ? (
            <div className="table-responsive">
              <table className="table table-striped table-hover">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>PO Number</th>
                    <th>File Name</th>
                    <th>Import Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map(shipment => (
                    <tr key={shipment.id} className={selectedShipment === shipment.id ? 'table-primary' : ''}>
                      <td>{shipment.id}</td>
                      <td>{shipment.internal_po_number}</td>
                      <td>{shipment.file_name}</td>
                      <td>{new Date(shipment.import_date).toLocaleString()}</td>
                      <td>
                        <button 
                          className="btn btn-sm btn-info"
                          onClick={() => setSelectedShipment(shipment.id)}
                        >
                          View Cartons
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No shipments found. Please check the database connection.</p>
          )}
        </div>
      </div>
      
      {selectedShipment && (
        <div className="card">
          <div className="card-header bg-secondary text-white">
            <h3 className="card-title mb-0">Cartons for Shipment #{selectedShipment}</h3>
          </div>
          <div className="card-body">
            {loading ? (
              <p>Loading cartons...</p>
            ) : cartons.length ? (
              <div className="table-responsive">
                <table className="table table-striped table-hover">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Barcode</th>
                      <th>Size</th>
                      <th>Units</th>
                      <th>Status</th>
                      <th>Created At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cartons.map(carton => (
                      <tr key={carton.id}>
                        <td>{carton.id}</td>
                        <td>{carton.barcode_2d}</td>
                        <td>{carton.size}</td>
                        <td>{carton.units}</td>
                        <td>
                          <span className={`badge bg-${carton.status === 'pending' ? 'warning' : 
                                            carton.status === 'entered' ? 'success' : 
                                            carton.status === 'exited' ? 'info' : 'secondary'}`}>
                            {carton.status}
                          </span>
                        </td>
                        <td>{new Date(carton.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>No cartons found for this shipment.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseTest;