import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const [employeeCode, setEmployeeCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/employee_login.php`, {
        employee_code: employeeCode
      });

      if (!response.data.success) {
        setError(response.data.message || 'Login failed. Please check your code.');
        return;
      }

      if (response.data.success) {
        // Store employee info in localStorage
        localStorage.setItem('employee', JSON.stringify(response.data.employee));
        localStorage.setItem('employee_token', response.data.employee.token);
        localStorage.setItem('employee_name', response.data.employee.name);
        
        // Redirect to scanner
        navigate('/scanner');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="modern-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="modern-card-header text-center">
          <h4 className="mb-0">Warehouse Employee Login</h4>
        </div>
        <div className="modern-card-body">
          {error && (
            <div className="alert-modern alert-modern-danger mb-3">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div>{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label className="form-label">Employee Code</label>
              <input
                type="text"
                className="form-control form-control-lg text-center"
                value={employeeCode}
                onChange={(e) => setEmployeeCode(e.target.value.toUpperCase())}
                placeholder="Enter your code"
                required
                autoFocus
                style={{ letterSpacing: '2px', fontSize: '1.5rem' }}
              />
              <small className="text-muted">Enter your assigned employee code</small>
            </div>

            <button
              type="submit"
              className="btn-modern btn-modern-primary w-100"
              disabled={loading || !employeeCode}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  Logging in...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right me-2"></i>
                  Login
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center">
            <small className="text-muted">
              <i className="bi bi-info-circle me-1"></i>
              Contact your supervisor if you don't have a code
            </small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
