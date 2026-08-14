import axios from 'axios';
import { API_BASE_URL } from '../config';
import { performanceMonitor } from '../utils/performance';

// Enhanced in-memory cache for API responses
const cache = new Map();
const pendingRequests = new Map(); // Track pending requests to avoid duplicates
const CACHE_DURATION = 60000; // 1 minute for better performance
const MAX_CACHE_SIZE = 100; // Limit cache size

console.log('Creating API service with baseURL:', API_BASE_URL);

// Fix API connection issues by ensuring proper URL handling
const fixApiUrl = (url) => {
  // If URL already starts with http:// or https://, return as is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // Ensure we don't have double slashes
  const baseWithoutTrailingSlash = API_BASE_URL.endsWith('/')
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  const urlWithoutLeadingSlash = url.startsWith('/')
    ? url.slice(1)
    : url;

  return `${baseWithoutTrailingSlash}/${urlWithoutLeadingSlash}`;
};

const apiService = axios.create({
  baseURL: null, // We'll handle the URL construction manually
  timeout: 15000,
  withCredentials: true, // send session cookie with every request
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor to check cache, avoid duplicates, and fix URLs
apiService.interceptors.request.use(
  (config) => {
    // Fix the URL using our helper function
    config.url = fixApiUrl(config.url);
    console.log('Making request to:', config.url);

    // Start performance monitoring
    const requestKey = `${config.method?.toUpperCase()} ${config.url}`;
    performanceMonitor.startTimer(requestKey);
    config.metadata = { requestKey, startTime: Date.now() };

    // Only optimize GET requests
    if (config.method === 'get') {
      const cacheKey = config.url + JSON.stringify(config.params || {});

      // Check if there's already a pending request for this endpoint
      if (pendingRequests.has(cacheKey)) {
        config.adapter = () => pendingRequests.get(cacheKey);
        return config;
      }

      // Check cache first
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        performanceMonitor.endTimer(requestKey);
        config.adapter = () => Promise.resolve({
          ...cached.response,
          config,
          request: {}
        });
        return config;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to store in cache and manage pending requests
apiService.interceptors.response.use(
  (response) => {
    // End performance monitoring
    if (response.config.metadata?.requestKey) {
      const duration = performanceMonitor.endTimer(response.config.metadata.requestKey);
      if (duration > 1000) { // Log slow requests
        console.warn(`🐌 Slow API call: ${response.config.metadata.requestKey} took ${duration.toFixed(2)}ms`);
      }
    }

    // Handle GET responses
    if (response.config.method === 'get' && response.status === 200) {
      const cacheKey = response.config.url + JSON.stringify(response.config.params || {});

      pendingRequests.delete(cacheKey);

      // Cache successful responses
      if (cache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries if cache is full
        const oldestKey = cache.keys().next().value;
        cache.delete(oldestKey);
      }

      cache.set(cacheKey, {
        response: {
          data: response.data,
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        },
        timestamp: Date.now()
      });
    }
    return response;
  },
  (error) => {
    // End performance monitoring for errors
    if (error.config?.metadata?.requestKey) {
      performanceMonitor.endTimer(error.config.metadata.requestKey + ' (ERROR)');
    }

    // Clean up pending requests on error, but preserve valid cache entries
    if (error.config?.method === 'get') {
      const cacheKey = error.config.url + JSON.stringify(error.config.params || {});
      pendingRequests.delete(cacheKey);
      // Only evict from cache if there is no cached entry (network error should not wipe good data)
      const existing = cache.get(cacheKey);
      if (!existing) {
        cache.delete(cacheKey);
      }
    }
    return Promise.reject(error);
  }
);

// Clear cache function (useful for forced refreshes)
apiService.clearCache = () => {
  cache.clear();
};

export default apiService;