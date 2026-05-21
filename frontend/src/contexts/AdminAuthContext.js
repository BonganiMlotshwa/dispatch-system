import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Modal, Form, Button, Alert } from 'react-bootstrap';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const AdminAuthContext = createContext(null);

const SESSION_KEY = 'dispatch_admin_code';
const SESSION_EXPIRY_KEY = 'dispatch_admin_expires';
const SESSION_MS = 30 * 60 * 1000;

function getStoredAdminCode() {
  const code = sessionStorage.getItem(SESSION_KEY);
  const expires = parseInt(sessionStorage.getItem(SESSION_EXPIRY_KEY) || '0', 10);
  if (!code || Date.now() > expires) {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_EXPIRY_KEY);
    return null;
  }
  return code;
}

function storeAdminCode(code) {
  sessionStorage.setItem(SESSION_KEY, code);
  sessionStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_MS));
}

export function AdminAuthProvider({ children }) {
  const [showModal, setShowModal] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [modalError, setModalError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [actionLabel, setActionLabel] = useState('this action');
  const resolverRef = useRef(null);

  const verifyAndStore = useCallback(async (code) => {
    const res = await axios.post(`${API_BASE_URL}/verify_admin.php`, { admin_code: code });
    if (res.data?.success) {
      storeAdminCode(code);
      return code;
    }
    throw new Error(res.data?.message || 'Invalid admin code');
  }, []);

  const requestAdminCode = useCallback((label = 'this action') => {
    const existing = getStoredAdminCode();
    if (existing) {
      return Promise.resolve(existing);
    }

    return new Promise((resolve, reject) => {
      setActionLabel(label);
      setAdminCodeInput('');
      setModalError('');
      resolverRef.current = { resolve, reject };
      setShowModal(true);
    });
  }, []);

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    const code = adminCodeInput.trim();
    if (!code) {
      setModalError('Please enter the admin code');
      return;
    }
    setVerifying(true);
    setModalError('');
    try {
      await verifyAndStore(code);
      setShowModal(false);
      resolverRef.current?.resolve(code);
      resolverRef.current = null;
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleModalCancel = () => {
    setShowModal(false);
    resolverRef.current?.reject(new Error('Admin verification cancelled'));
    resolverRef.current = null;
  };

  const withAdminAuth = useCallback(async (label, fn) => {
    const code = await requestAdminCode(label);
    return fn(code);
  }, [requestAdminCode]);

  return (
    <AdminAuthContext.Provider value={{ requestAdminCode, withAdminAuth, getStoredAdminCode }}>
      {children}
      <Modal show={showModal} onHide={handleModalCancel} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-shield-lock me-2"></i>
            Admin Authorization Required
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleModalSubmit}>
          <Modal.Body>
            <p className="text-muted mb-3">
              Enter the admin code to continue with <strong>{actionLabel}</strong>.
            </p>
            {modalError && (
              <Alert variant="danger" className="py-2 small">{modalError}</Alert>
            )}
            <Form.Group>
              <Form.Label>Admin Code</Form.Label>
              <Form.Control
                type="password"
                value={adminCodeInput}
                onChange={(e) => setAdminCodeInput(e.target.value)}
                placeholder="Enter admin code"
                autoFocus
                disabled={verifying}
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleModalCancel} disabled={verifying}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={verifying}>
              {verifying ? 'Verifying...' : 'Continue'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider');
  }
  return ctx;
}
