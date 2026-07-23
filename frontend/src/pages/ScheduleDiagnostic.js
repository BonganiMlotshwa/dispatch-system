import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const ScheduleDiagnostic = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDiagnostic();
  }, []);

  const loadDiagnostic = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/schedule_diagnostic.php`);
      if (res.data.success) {
        setData(res.data);
      } else {
        setError(res.data.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-center">
        <div className="spinner-border"></div>
        <p className="mt-2">Loading diagnostic data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <div className="alert alert-danger">Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { summary, match_analysis } = data;

  return (
    <div className="py-2">
      <h1 className="text-gradient mb-4">Schedule Linking Diagnostic</h1>

      {/* Summary */}
      <div className="modern-card mb-4">
        <div className="modern-card-header">
          <h5 className="mb-0">Summary</h5>
        </div>
        <div className="modern-card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <div className="text-center p-3 bg-light rounded">
                <h3 className="mb-0">{summary.total_schedules}</h3>
                <small className="text-muted">Total Schedules</small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 bg-light rounded">
                <h3 className="mb-0">{summary.total_schedule_orders}</h3>
                <small className="text-muted">Total Orders in Schedules</small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 bg-warning rounded text-white">
                <h3 className="mb-0">{summary.unlinked_files}</h3>
                <small>Unlinked Files</small>
              </div>
            </div>
            <div className="col-md-3">
              <div className="text-center p-3 bg-success rounded text-white">
                <h3 className="mb-0">{summary.linked_files}</h3>
                <small>Linked Files</small>
              </div>
            </div>
          </div>
          
          {summary.active_schedule && (
            <div className="mt-3 p-3 bg-info bg-opacity-10 rounded">
              <strong>Active Schedule:</strong> {summary.active_schedule.week_label} 
              <span className="text-muted ms-2">({summary.active_schedule.order_count} orders)</span>
            </div>
          )}
        </div>
      </div>

      {/* Match Analysis */}
      <div className="modern-card">
        <div className="modern-card-header">
          <h5 className="mb-0">Unlinked Files Analysis</h5>
        </div>
        <div className="modern-card-body p-0">
          {match_analysis && match_analysis.length > 0 ? (
            <div className="table-responsive">
              <table className="table table-modern mb-0">
                <thead>
                  <tr>
                    <th>File Name</th>
                    <th>Customer Order No</th>
                    <th>Status</th>
                    <th>Potential Matches</th>
                  </tr>
                </thead>
                <tbody>
                  {match_analysis.map((item, index) => (
                    <tr key={index}>
                      <td className="fw-medium">{item.file_name}</td>
                      <td>
                        <code>{item.customer_order_no}</code>
                      </td>
                      <td>
                        <span className={`badge ${
                          item.status.includes('EXACT MATCH') ? 'bg-danger' :
                          item.status.includes('Case mismatch') ? 'bg-warning' :
                          item.status.includes('Partial') ? 'bg-info' :
                          'bg-secondary'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                      <td>
                        {/* Exact Matches */}
                        {item.exact_matches && item.exact_matches.length > 0 && (
                          <div className="mb-2">
                            <strong className="text-danger">EXACT MATCHES:</strong>
                            {item.exact_matches.map((match, i) => (
                              <div key={i} className="ms-3 small">
                                → {match.schedule_week} - {match.ftm_po}
                                {match.is_active && <span className="badge bg-success ms-2">ACTIVE</span>}
                                <br />
                                <span className="text-muted">
                                  {match.description} - {match.colour}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Case Insensitive Matches */}
                        {item.case_insensitive_matches && item.case_insensitive_matches.length > 0 && (
                          <div className="mb-2">
                            <strong className="text-warning">Case Mismatch:</strong>
                            {item.case_insensitive_matches.map((match, i) => (
                              <div key={i} className="ms-3 small">
                                → {match.schedule_week} - {match.ftm_po}
                                <br />
                                <span className="text-muted">
                                  File: "<code>{match.file_value}</code>" vs Schedule: "<code>{match.schedule_value}</code>"
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Partial Matches */}
                        {item.partial_matches && item.partial_matches.length > 0 && (
                          <div>
                            <strong className="text-info">Partial Matches:</strong>
                            {item.partial_matches.map((match, i) => (
                              <div key={i} className="ms-3 small">
                                → {match.schedule_week} - {match.ftm_po}
                                <br />
                                <span className="text-muted">
                                  File: "<code>{match.file_value}</code>" vs Schedule: "<code>{match.schedule_value}</code>"
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {(!item.exact_matches || item.exact_matches.length === 0) &&
                         (!item.case_insensitive_matches || item.case_insensitive_matches.length === 0) &&
                         (!item.partial_matches || item.partial_matches.length === 0) && (
                          <span className="text-muted">No matches in any loaded schedule</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-5">
              <p className="text-success mb-0">All files are linked! No unlinked files found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleDiagnostic;
