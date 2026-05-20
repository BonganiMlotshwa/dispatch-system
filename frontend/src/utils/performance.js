/**
 * Performance monitoring utilities
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
    this.enabled = process.env.NODE_ENV === 'development';
  }

  startTimer(key) {
    if (!this.enabled) return;
    this.metrics.set(key, { start: performance.now() });
  }

  endTimer(key, logResult = true) {
    if (!this.enabled) return;
    
    const metric = this.metrics.get(key);
    if (!metric) return;
    
    const duration = performance.now() - metric.start;
    metric.duration = duration;
    
    if (logResult) {
      console.log(`⏱️ ${key}: ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  getMetric(key) {
    return this.metrics.get(key);
  }

  getAllMetrics() {
    const results = {};
    for (const [key, value] of this.metrics.entries()) {
      if (value.duration !== undefined) {
        results[key] = value.duration;
      }
    }
    return results;
  }

  clear() {
    this.metrics.clear();
  }

  // Monitor API calls
  wrapApiCall(apiCall, name) {
    if (!this.enabled) return apiCall;
    
    return async (...args) => {
      this.startTimer(`API: ${name}`);
      try {
        const result = await apiCall(...args);
        this.endTimer(`API: ${name}`);
        return result;
      } catch (error) {
        this.endTimer(`API: ${name} (ERROR)`);
        throw error;
      }
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  return {
    startTimer: (key) => performanceMonitor.startTimer(key),
    endTimer: (key, logResult) => performanceMonitor.endTimer(key, logResult),
    getMetrics: () => performanceMonitor.getAllMetrics(),
    clear: () => performanceMonitor.clear()
  };
};