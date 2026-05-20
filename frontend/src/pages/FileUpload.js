import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

/**
 * FileUpload Page Component
 * 
 * Handles XML file imports for shipment and carton data
 */
const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [internalPoNumber, setInternalPoNumber] = useState('');
  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState(null);

  // Auto-clear success messages after 6 seconds
  useEffect(() => {
    if (uploadResult?.success) {
      const timer = setTimeout(() => {
        setUploadResult(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [uploadResult]);

  // Auto-clear error messages after 8 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Validate file before setting
  const validateFile = (selectedFile) => {
    const errors = [];
    
    if (!selectedFile) {
      errors.push('Please select a file');
      return errors;
    }
    
    // Check file extension
    if (!selectedFile.name.toLowerCase().endsWith('.mrpg')) {
      errors.push('Only .mrpg files are allowed');
    }
    
    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (selectedFile.size > maxSize) {
      errors.push('File size must be less than 10MB');
    }
    
    // Check minimum file size (should be at least 100 bytes for a valid XML)
    const minSize = 100; // 100 bytes
    if (selectedFile.size < minSize) {
      errors.push('File appears to be too small to contain valid XML data');
    }
    
    // Check file type (MIME type)
    const allowedTypes = ['text/xml', 'application/xml', 'text/plain', 'application/octet-stream'];
    if (selectedFile.type && !allowedTypes.includes(selectedFile.type)) {
      errors.push('Invalid file type. Please select a valid XML file.');
    }
    
    return errors;
  };

  // Handle file selection with validation
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    processSelectedFile(selectedFile);
    if (e.target) e.target.value = ''; // Clear the input for re-selection
  };

  // Process selected file (used by both file input and drag & drop)
  const processSelectedFile = (selectedFile) => {
    if (selectedFile) {
      const errors = validateFile(selectedFile);
      setValidationErrors(errors);
      
      if (errors.length === 0) {
        setFile(selectedFile);
        setError(null);
      } else {
        setFile(null);
      }
    } else {
      setFile(null);
      setValidationErrors([]);
    }
    
    setUploadResult(null);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  // Handle file upload with comprehensive validation
  const handleUpload = async (e) => {
    e.preventDefault();
    
    // Pre-upload validation
    if (!file) {
      setError('Please select a file to upload');
      return;
    }
    
    if (!internalPoNumber.trim()) {
      setError('Please enter a PO number');
      return;
    }
    
    if (!style.trim()) {
      setError('Please enter a Style');
      return;
    }
    
    if (!color.trim()) {
      setError('Please enter a Color');
      return;
    }
    
    if (!quantity.trim()) {
      setError('Please enter a Quantity');
      return;
    }
    
    // Re-validate file before upload
    const fileErrors = validateFile(file);
    if (fileErrors.length > 0) {
      setValidationErrors(fileErrors);
      setError('Please fix the file validation errors before uploading');
      return;
    }

    // Create form data for upload
    const formData = new FormData();
    formData.append('xmlFile', file);
    formData.append('internalPoNumber', 'FTM-' + internalPoNumber.trim());
    formData.append('style', style.trim());
    formData.append('color', color.trim());
    formData.append('quantity', quantity.trim());

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setValidationErrors([]);
      setUploadStartTime(Date.now());
      setUploadSpeed(0);
      setTimeRemaining(0);
      
      // Upload file with progress tracking
      const response = await axios.post('http://localhost:8001/api/upload.php', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setUploadProgress(percentCompleted);
          
          // Calculate upload speed and time remaining
          if (uploadStartTime) {
            const elapsedTime = (Date.now() - uploadStartTime) / 1000; // seconds
            const uploadedBytes = progressEvent.loaded;
            const totalBytes = progressEvent.total;
            const remainingBytes = totalBytes - uploadedBytes;
            
            if (elapsedTime > 0) {
              const speed = uploadedBytes / elapsedTime; // bytes per second
              const remaining = remainingBytes / speed; // seconds
              
              setUploadSpeed(speed);
              setTimeRemaining(remaining);
            }
          }
        },
        timeout: 120000, // 2 minute timeout for large files
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        maxBodyLength: 10 * 1024 * 1024, // 10MB limit
      });

      // Handle successful upload
      if (response.data.success) {
        setUploadResult({
          success: true,
          message: response.data.message,
          shipmentId: response.data.shipment_id,
          poNumber: 'FTM-' + internalPoNumber,
          cartonCount: response.data.cartons_imported,
          style: style,
          color: color,
          quantity: quantity,
        });
        
        // Reset form
        setFile(null);
        setInternalPoNumber('');
        setStyle('');
        setColor('');
        setQuantity('');
        document.getElementById('fileUpload').value = '';
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
      
    } catch (err) {
      console.error('Upload error:', err);
      
      let errorMessage = 'An error occurred during upload. Please try again.';
      
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = 'Upload timeout. Please try again with a smaller file.';
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection and try again.';
      }
      
      setError(errorMessage);
      setUploadResult({ success: false });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(0);
      setUploadStartTime(null);
    }
  };

  return (
    <div className="py-2">
      <div className="mb-4">
        <h1 className="text-gradient mb-0">Import XML File</h1>
      </div>
      
      <div className="row g-3 g-md-4">
        <div className="col-12 col-lg-8">
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-upload me-2"></i>Upload Shipment XML</h5>
            </div>
            <div className="modern-card-body">
              <form onSubmit={handleUpload}>
                <div className="mb-4">
                  <label className="form-label-modern">Select XML File (.mrpg)</label>
                  <div className="custom-file-upload mb-3">
                    <div className={`upload-area-modern ${file ? 'has-file' : ''} ${validationErrors.length > 0 ? 'has-error' : ''} ${isDragOver ? 'drag-over' : ''}`} 
                      onClick={() => document.getElementById('fileUpload').click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {file ? (
                        <div>
                          <i className="bi bi-file-earmark-check fs-1 text-success mb-2"></i>
                          <p className="mb-0 fw-bold">{file.name}</p>
                          <p className="text-muted small">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                      ) : (
                        <div>
                          <i className="bi bi-cloud-arrow-up fs-1 text-primary mb-2"></i>
                          <p className="mb-0">Drag & drop your file here or click to browse</p>
                          <p className="text-muted small">Only .mrpg XML files are supported</p>
                        </div>
                      )}
                    </div>
                    <input
                      id="fileUpload"
                      type="file"
                      accept=".mrpg"
                      onChange={handleFileChange}
                      disabled={uploading}
                      className="d-none"
                    />
                    <div className="text-muted small mt-2">
                      Only .mrpg XML files are supported. Maximum file size: 10MB.
                    </div>
                    
                    {validationErrors.length > 0 && (
                      <div className="alert-modern alert-modern-danger mt-2">
                        <i className="bi bi-exclamation-triangle-fill"></i>
                        <div>
                          <strong>File Validation Errors:</strong>
                          <ul className="mb-0 mt-1">
                            {validationErrors.map((error, index) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mb-4">
                  <label className="form-label-modern">
                    <i className="bi bi-tag me-1"></i>PO Number <span className="text-danger">*</span>
                  </label>
                  <div className="input-group">
                    <span className="input-group-text bg-light">FTM-</span>
                    <input
                      type="text"
                      className="form-control-modern"
                      value={internalPoNumber}
                      onChange={(e) => setInternalPoNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      disabled={uploading}
                      placeholder="12554"
                      required
                    />
                  </div>
                  <div className="text-muted small mt-1">
                    Enter only numbers (e.g., 12554). "FTM-" will be added automatically.
                  </div>
                </div>
                
                <div className="row g-3 mb-4">
                  <div className="col-md-4">
                    <label className="form-label-modern">
                      <i className="bi bi-palette me-1"></i>Style <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control-modern w-100"
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      disabled={uploading}
                      placeholder="Enter style"
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-modern">
                      <i className="bi bi-droplet me-1"></i>Color <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control-modern w-100"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                      disabled={uploading}
                      placeholder="Enter color"
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label-modern">
                      <i className="bi bi-123 me-1"></i>Quantity <span className="text-danger">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control-modern w-100"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      disabled={uploading}
                      placeholder="Enter quantity"
                      required
                    />
                  </div>
                </div>
            
                {uploading && (
                  <div className="mb-4">
                    <div className="progress-modern mb-2">
                      <div 
                        className="progress-bar-modern" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                    <div className="text-center text-muted small">
                      <div className="loading-spinner-modern d-inline-block me-2"></div>
                      Processing XML data... {uploadProgress}%
                    </div>
                    {uploadSpeed > 0 && (
                      <div className="d-flex justify-content-between text-muted small mt-2">
                        <span>
                          Speed: {uploadSpeed > 1024 * 1024 
                            ? `${(uploadSpeed / (1024 * 1024)).toFixed(1)} MB/s` 
                            : `${(uploadSpeed / 1024).toFixed(1)} KB/s`}
                        </span>
                        {timeRemaining > 0 && timeRemaining < 300 && (
                          <span>
                            Time remaining: {timeRemaining > 60 
                              ? `${Math.floor(timeRemaining / 60)}m ${Math.floor(timeRemaining % 60)}s`
                              : `${Math.floor(timeRemaining)}s`}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="d-flex flex-column flex-md-row gap-2 justify-content-md-end">
                  <button 
                    type="button"
                    className="btn-modern btn-modern-secondary"
                    onClick={() => {
                      setFile(null);
                      setInternalPoNumber('');
                      setStyle('');
                      setColor('');
                      setQuantity('');
                      setValidationErrors([]);
                      setError(null);
                      setUploadResult(null);
                      setUploadSpeed(0);
                      setTimeRemaining(0);
                      setUploadStartTime(null);
                      document.getElementById('fileUpload').value = '';
                    }}
                    disabled={uploading}
                  >
                    <i className="bi bi-x-circle"></i> Clear
                  </button>
                  <button 
                    type="submit" 
                    className="btn-modern btn-modern-primary"
                    disabled={!file || !internalPoNumber.trim() || !style.trim() || !color.trim() || !quantity.trim() || uploading || validationErrors.length > 0}
                  >
                    {uploading ? (
                      <>
                        <div className="loading-spinner-modern me-2"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-upload"></i> Upload File
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
          
          {error && (
            <div className="alert-modern alert-modern-danger mt-3">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div>
                <strong>Upload Failed</strong>
                <div className="mt-1">{error}</div>
              </div>
            </div>
          )}
          
          {uploadResult?.success && (
            <div className="alert-modern alert-modern-success mt-3">
              <i className="bi bi-check-circle-fill"></i>
              <div className="flex-grow-1">
                <strong>Upload Successful!</strong>
                <div className="mt-2">{uploadResult.message}</div>
                <div className="row g-3 mt-3">
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-tag me-2 text-muted"></i>
                      <div>
                        <div className="small text-muted">PO Number</div>
                        <div className="fw-medium">{uploadResult.poNumber}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-boxes me-2 text-muted"></i>
                      <div>
                        <div className="small text-muted">Cartons Imported</div>
                        <div className="fw-medium">{uploadResult.cartonCount}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-palette me-2 text-muted"></i>
                      <div>
                        <div className="small text-muted">Style</div>
                        <div className="fw-medium">{uploadResult.style}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-droplet me-2 text-muted"></i>
                      <div>
                        <div className="small text-muted">Color</div>
                        <div className="fw-medium">{uploadResult.color}</div>
                      </div>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="d-flex align-items-center">
                      <i className="bi bi-123 me-2 text-muted"></i>
                      <div>
                        <div className="small text-muted">Quantity</div>
                        <div className="fw-medium">{uploadResult.quantity}</div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex justify-content-end mt-3">
                  <Link 
                    to={`/shipment/${uploadResult.shipmentId}`} 
                    className="btn-modern btn-modern-success"
                  >
                    <i className="bi bi-eye"></i> View Shipment Details
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="col-12 col-lg-4">
          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-info-circle me-2"></i>Import Instructions</h5>
            </div>
            <div className="modern-card-body">
              <h6 className="mb-3">How to Import XML Files</h6>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                    1
                  </div>
                </div>
                <div>
                  <p className="mb-0"><strong>Prepare Your File</strong></p>
                  <p className="text-muted small">Ensure your XML file is in the correct .mrpg format</p>
                </div>
              </div>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                    2
                  </div>
                </div>
                <div>
                  <p className="mb-0"><strong>Enter Details</strong></p>
                  <p className="text-muted small">Provide PO number, style, color, and quantity</p>
                </div>
              </div>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                    3
                  </div>
                </div>
                <div>
                  <p className="mb-0"><strong>Upload and Process</strong></p>
                  <p className="text-muted small">Wait for the system to process your file</p>
                </div>
              </div>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                    4
                  </div>
                </div>
                <div>
                  <p className="mb-0"><strong>Review Results</strong></p>
                  <p className="text-muted small">Check the import summary and view shipment details</p>
                </div>
              </div>
              <div className="alert-modern alert-modern-info mt-3">
                <i className="bi bi-lightbulb"></i>
                <div>
                  <strong>Note:</strong> The system will automatically extract shipment and carton 
                  information from the XML file. Duplicate imports will be prevented based on PO number.
                </div>
              </div>
            </div>
          </div>
          
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-file-earmark-code me-2"></i>XML Format</h5>
            </div>
            <div className="modern-card-body">
              <p className="small">Expected XML structure:</p>
              <div className="bg-light p-2 rounded" style={{fontSize: '0.8rem'}}>
                <pre className="mb-0" style={{whiteSpace: 'pre-wrap'}}>
{`<SupplerITPrintTags>
  <Panda>
    <PoNumber>...</PoNumber>
    <BarCode2D>...</BarCode2D>
    <Size>...</Size>
    <!-- Other fields -->
  </Panda>
  <!-- Multiple Panda elements -->
</SupplerITPrintTags>`}
                </pre>
              </div>
              <p className="mt-3 small text-muted">
                Each <code>&lt;Panda&gt;</code> element represents a carton that will be tracked in the system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;