/**
 * Application Configuration
 */

// API Base URL - set REACT_APP_API_URL in .env.production for the Linux server.
// Falls back to the PHP dev server on localhost for local development.
const getApiBaseUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8001/api';
  }
  return `http://${hostname}/api`;
};

export const API_BASE_URL = getApiBaseUrl();

// Other configuration constants can be added here
export const APP_NAME = 'Dispatch System';
export const APP_VERSION = '1.0.0';