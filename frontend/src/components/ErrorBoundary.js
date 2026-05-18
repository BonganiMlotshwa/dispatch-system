import React, { Component } from 'react';

/**
 * Error Boundary Component
 * 
 * Catches JavaScript errors in child component tree and displays a fallback UI
 * instead of crashing the whole application
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  render() {
    if (this.state.hasError) {
      // You can render any custom fallback UI
      return (
        <div className="py-5 px-3">
          <div className="modern-card mx-auto" style={{maxWidth: '600px'}}>
            <div className="modern-card-header" style={{backgroundColor: 'var(--danger-color)', color: 'white'}}>
              <h4 className="mb-0">
                <i className="bi bi-exclamation-triangle-fill me-2"></i>
                Application Error
              </h4>
            </div>
            <div className="modern-card-body">
              <div className="alert-modern alert-modern-danger">
                <i className="bi bi-bug-fill"></i>
                <div>
                  <strong>Something went wrong</strong>
                  <div className="mt-2">An error occurred that prevented this feature from working correctly.</div>
                </div>
              </div>
              {this.state.error && (
                <details className="mt-3" style={{ whiteSpace: 'pre-wrap' }}>
                  <summary className="fw-medium text-muted">Technical Details</summary>
                  <div className="mt-2 p-3 bg-light rounded small">
                    <div className="text-danger">{this.state.error.toString()}</div>
                    {this.state.errorInfo?.componentStack && (
                      <div className="text-muted mt-2">{this.state.errorInfo.componentStack}</div>
                    )}
                  </div>
                </details>
              )}
              <div className="d-flex flex-wrap gap-2 justify-content-end mt-4">
                <button 
                  className="btn-modern btn-modern-secondary" 
                  onClick={() => window.location.href = '/'}
                >
                  <i className="bi bi-house-door"></i> Dashboard
                </button>
                <button 
                  className="btn-modern btn-modern-primary" 
                  onClick={this.handleReset}
                >
                  <i className="bi bi-arrow-clockwise"></i> Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;