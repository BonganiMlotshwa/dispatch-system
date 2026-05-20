import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import apiService from '../services/apiService';

export const useApi = (url, options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const currentRequest = useRef(null);
  const hasAttemptedFetch = useRef(false);
  const isInitialLoad = useRef(true);
  const lastUrl = useRef(url);
  const requestCount = useRef(0);

  const { autoFetch = true, dependencies = [], debounceMs = 100 } = options;

  const fetchData = useCallback(async () => {
    // Skip if URL hasn't changed and we already have data (unless forced)
    if (lastUrl.current === url && data && !isInitialLoad.current) {
      return;
    }

    // Cancel previous request if still pending
    if (currentRequest.current) {
      currentRequest.current.cancel?.();
    }

    // Debounce rapid requests
    const currentRequestId = ++requestCount.current;
    if (debounceMs > 0) {
      await new Promise(resolve => setTimeout(resolve, debounceMs));
      if (currentRequestId !== requestCount.current) {
        return; // A newer request has been made
      }
    }

    try {
      setLoading(true);
      if (!isInitialLoad.current) {
        setError(null);
      }
      hasAttemptedFetch.current = true;
      lastUrl.current = url;

      // Create cancelable request
      const source = axios.CancelToken?.source?.();
      currentRequest.current = source;
      const response = await apiService.get(url, {
        cancelToken: source?.token
      });

      // Check if this is still the current request
      if (currentRequestId !== requestCount.current || !mounted.current) {
        return;
      }

      console.log('useApi - Response received for URL:', url, response);

      setData(response.data);
      setError(null);
      isInitialLoad.current = false;
    } catch (err) {
      // Check if this is still the current request
      if (currentRequestId !== requestCount.current || !mounted.current) {
        return;
      }

      console.error('useApi - Error fetching data:', err);
      console.error('useApi - Error details:', err.response?.data || err.message);

      // Ignore cancelled requests
      if (axios.isCancel?.(err)) {
        return;
      }

      console.error('API Error:', err);
      let errorMessage = 'Unable to load data. Please try refreshing the page.';

      if (err.response) {
        errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
      } else if (err.request) {
        errorMessage = 'Unable to connect to server. Please check your connection.';
      } else {
        errorMessage = err.message || 'An unexpected error occurred';
      }

      setError(errorMessage);
    } finally {
      if (currentRequestId === requestCount.current && mounted.current) {
        setLoading(false);
      }
      currentRequest.current = null;
    }
  }, [url, data, debounceMs]);

  useEffect(() => {
    mounted.current = true;
    if (autoFetch) {
      fetchData();
    }

    return () => {
      mounted.current = false;
      // Cancel any pending request on cleanup
      if (currentRequest.current) {
        currentRequest.current.cancel?.();
      }
    };
  }, [fetchData, autoFetch, ...dependencies]);

  const refetch = useCallback(() => {
    // Clear cache for forced refresh
    apiService.clearCache?.();
    
    // Force a fresh fetch by resetting the URL tracking
    lastUrl.current = null;
    isInitialLoad.current = true;
    
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
};

export const useApiMutation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mutate = useCallback(async (method, url, data) => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService[method](url, data);
      return response.data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { mutate, loading, error };
};