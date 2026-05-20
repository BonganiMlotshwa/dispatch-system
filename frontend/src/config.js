/**
 * Application Configuration
 */

// API Base URL - Dynamic based on how the app is accessed
const getApiBaseUrl = () => {
  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:8001/api';
  } else {
    return `http://${hostname}:8001/api`;
  }
};

export const API_BASE_URL = getApiBaseUrl();

// Other configuration constants can be added here
export const APP_NAME = 'Dispatch System';
export const APP_VERSION = '1.0.0';