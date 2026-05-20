import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge, InputGroup, Modal, Table, Spinner } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import axios from 'axios';
import JsBarcode from 'jsbarcode';
import QRCode from 'react-qr-code';
import { API_BASE_URL } from '../config';

// Configure axios with timeout
axios.defaults.timeout = 10000;

const StickerGenerator = () => {
  const [stickers, setStickers] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    ftm_po: '',
    po_number: ''
  });
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 50,
    offset: 0,
    has_more: false
  });
  const [selectedStickers, setSelectedStickers] = useState([]);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewStickers, setPreviewStickers] = useState([]);
  const barcodeRefs = useRef({});

  // Load stickers data
  const loadStickers = async (append = false) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: pagination.limit,
        offset: append ? pagination.offset : 0
      });

      if (filters.ftm_po.trim()) {
        params.append('ftm_po', filters.ftm_po.trim());
      }

      if (filters.po_number.trim()) {
        params.append('po_number', filters.po_number.trim());
      }

      const response = await axios.get(`${API_BASE_URL}/stickers.php?${params}`);

      if (response.data.success) {
        const newStickers = append ? [...stickers, ...response.data.data.stickers] : response.data.data.stickers;
        setStickers(newStickers);
        setSummary(response.data.data.summary);
        setPagination(response.data.data.pagination);

        if (!append) {
          setSelectedStickers([]);
        }
      } else {
        setError(response.data.message || 'Failed to load stickers');
      }
    } catch (err) {
      console.error('Error loading stickers:', err);
      setError('Failed to load stickers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Apply filters
  const applyFilters = () => {
    loadStickers(false);
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      ftm_po: '',
      po_number: ''
    });
    loadStickers(false);
  };

  // Load more stickers
  const loadMore = () => {
    if (pagination.has_more && !loading) {
      setPagination(prev => ({
        ...prev,
        offset: prev.offset + prev.limit
      }));
      loadStickers(true);
    }
  };

  // Toggle sticker selection
  const toggleStickerSelection = (sticker) => {
    setSelectedStickers(prev => {
      const isSelected = prev.some(s => s.carton_id === sticker.carton_id);
      if (isSelected) {
        return prev.filter(s => s.carton_id !== sticker.carton_id);
      } else {
        return [...prev, sticker];
      }
    });
  };

  // Select all stickers
  const selectAllStickers = () => {
    setSelectedStickers(stickers);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedStickers([]);
  };

  // Preview selected stickers
  const previewSelectedStickers = () => {
    if (selectedStickers.length === 0) {
      setError('Please select at least one sticker to preview');
      return;
    }
    setPreviewStickers(selectedStickers);
    setShowPreviewModal(true);
  };

  // Print selected stickers
  const printSelectedStickers = () => {
    if (selectedStickers.length === 0) {
      setError('Please select at least one sticker to print');
      return;
    }
    setShowPrintModal(true);
  };

  // Generate sticker HTML for printing
  const generateStickerHTML = (sticker) => {
    const barcodes = sticker.barcodes.split(',');
    return barcodes.map((barcode, index) => `
      <div class="sticker-item" style="
        width: 300px;
        height: 200px;
        border: 2px solid #000;
        margin: 10px;
        padding: 15px;
        display: inline-block;
        background: white;
        page-break-inside: avoid;
        font-family: Arial, sans-serif;
      ">
        <div style="text-align: center; margin-bottom: 10px;">
          <div style="font-size: 14px; font-weight: bold; margin-bottom: 5px;">${sticker.ftm_po}</div>
          <div style="font-size: 12px;">PO: ${sticker.po_number}</div>
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
          <div style="font-size: 11px;">
            <div><strong>Size:</strong> ${sticker.size || 'N/A'}</div>
            <div><strong>Units:</strong> ${sticker.units || 'N/A'}</div>
          </div>
          <div style="font-size: 11px;">
            <div><strong>Item:</strong> ${sticker.item || 'N/A'}</div>
            <div><strong>Count:</strong> ${sticker.carton_count}</div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 10px;">
          <div style="font-size: 10px; margin-bottom: 5px;">Barcode ${index + 1} of ${barcodes.length}</div>
          <div style="
            font-family: 'Courier New', monospace;
            font-size: 12px;
            font-weight: bold;
            letter-spacing: 1px;
            border: 1px solid #000;
            padding: 5px;
            display: inline-block;
          ">${barcode}</div>
        </div>
      </div>
    `).join('');
  };

  // Print stickers
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    
    if (!printWindow) {
      setError('Pop-up blocked! Please allow pop-ups for this site to print stickers.');
      return;
    }

    // Generate HTML with proper styling for print - 3 per row
    let printContent = '<div class="sticker-grid">';

    selectedStickers.forEach((sticker, index) => {
      printContent += `
        <div class="sticker-item" data-index="${index}">
          <div class="sticker-top-row">
            <div class="sticker-header">
              <div class="sticker-title">${sticker.ftm_po}</div>
              <div class="sticker-subtitle">Customer PO: ${sticker.po_number}</div>
            </div>
            
            <div class="qr-section-side">
              <div class="qr-label">QR</div>
              <div id="qr-${index}" class="qr-container"></div>
            </div>
          </div>

          <div class="sticker-details">
            <div class="detail-row">
              <span class="detail-label">Size:</span>
              <span class="detail-value">${sticker.size || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Units:</span>
              <span class="detail-value">${sticker.units || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Item:</span>
              <span class="detail-value">${sticker.item || 'N/A'}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Cartons:</span>
              <span class="detail-value">${sticker.carton_count}</span>
            </div>
          </div>

          <div class="barcode-section">
            <div class="barcode-label">Barcode</div>
            <svg id="barcode-${index}" class="barcode-svg"></svg>
          </div>
        </div>
      `;
    });

    printContent += '</div>';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Stickers - ${selectedStickers.length} Items</title>
          <meta charset="UTF-8">
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
          <script src="https://cdn.jsdelivr.net/npm/qrcodejs2@0.0.2/qrcode.min.js"></script>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              font-family: 'Arial', 'Helvetica', sans-serif;
              background: white;
              padding: 10mm;
            }

            .sticker-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 5mm;
              width: 100%;
            }

            .sticker-item {
              border: 2px solid #000;
              border-radius: 4px;
              background: white;
              padding: 8px;
              display: flex;
              flex-direction: column;
              page-break-inside: avoid;
              break-inside: avoid;
              min-height: 180px;
            }

            .sticker-top-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 8px;
              gap: 8px;
            }

            .sticker-header {
              flex: 1;
              text-align: center;
            }

            .sticker-title {
              font-size: 18px;
              font-weight: bold;
              margin-bottom: 2px;
              color: #000;
            }

            .sticker-subtitle {
              font-size: 11px;
              color: #6c757d;
            }

            .qr-section-side {
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
            }

            .qr-label {
              font-size: 8px;
              color: #6c757d;
              margin-bottom: 2px;
              font-weight: 500;
            }

            .qr-container {
              border: 1px solid #dee2e6;
              border-radius: 2px;
              padding: 2px;
              background: white;
              width: 70px;
              height: 70px;
              display: flex;
              align-items: center;
              justify-content: center;
            }

            .qr-container img {
              display: block;
              max-width: 100%;
              max-height: 100%;
            }

            .sticker-details {
              margin-bottom: 8px;
              border-top: 1px solid #dee2e6;
              padding-top: 6px;
            }

            .detail-row {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              margin-bottom: 3px;
              padding: 0 4px;
            }

            .detail-label {
              font-weight: 600;
              color: #000;
            }

            .detail-value {
              color: #495057;
            }

            .barcode-section {
              margin-top: auto;
              text-align: center;
            }

            .barcode-label {
              font-size: 9px;
              color: #6c757d;
              margin-bottom: 2px;
              font-weight: 500;
            }

            .barcode-svg {
              width: 100%;
              height: 45px;
              display: block;
              margin: 0 auto;
            }

            @media print {
              body {
                padding: 5mm;
              }

              .sticker-grid {
                display: grid !important;
                grid-template-columns: repeat(3, 1fr) !important;
                gap: 5mm !important;
              }

              .sticker-item {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }

              @page {
                size: A4 landscape;
                margin: 10mm;
              }
            }
          </style>
        </head>
        <body>
          ${printContent}
          <script>
            const stickers = ${JSON.stringify(selectedStickers)};
            
            window.onload = function() {
              console.log('Generating barcodes and QR codes for', stickers.length, 'stickers');
              
              // Generate barcodes
              stickers.forEach((sticker, index) => {
                const svgElement = document.getElementById('barcode-' + index);
                if (svgElement && window.JsBarcode) {
                  try {
                    JsBarcode(svgElement, sticker.barcode_2d, {
                      format: "CODE128",
                      width: 2,
                      height: 45,
                      displayValue: true,
                      fontSize: 11,
                      margin: 2,
                      background: "#ffffff",
                      lineColor: "#000000"
                    });
                    console.log('Barcode generated for index', index);
                  } catch (error) {
                    console.error('Barcode generation error for index', index, error);
                  }
                }

                // Generate QR codes
                const qrContainer = document.getElementById('qr-' + index);
                if (qrContainer && window.QRCode) {
                  try {
                    new QRCode(qrContainer, {
                      text: sticker.barcode_2d,
                      width: 66,
                      height: 66,
                      colorDark: "#000000",
                      colorLight: "#ffffff",
                      correctLevel: QRCode.CorrectLevel.M
                    });
                    console.log('QR code generated for index', index);
                  } catch (error) {
                    console.error('QR code generation error for index', index, error);
                  }
                }
              });

              // Auto-print after a short delay to ensure all codes are generated
              setTimeout(function() {
                console.log('Initiating print...');
                window.print();
              }, 1000);
            };

            // Close window after printing or canceling
            window.onafterprint = function() {
              console.log('Print dialog closed');
              setTimeout(function() {
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
    setShowPrintModal(false);
  };

  // Load initial data
  useEffect(() => {
    loadStickers();
  }, []);

  return (
    <div className="py-2">
      <style>{`
        .sticker-preview-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .sticker-preview-item {
          display: flex;
          justify-content: center;
        }

        .sticker-card {
          width: 100%;
          max-width: 350px;
          min-height: 200px;
          border: 2px solid #000;
          border-radius: 4px;
          background: white;
          padding: 12px;
          display: flex;
          flex-direction: column;
        }

        .sticker-top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 12px;
          gap: 12px;
        }

        .sticker-header {
          flex: 1;
          text-align: center;
        }

        .sticker-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 4px;
          color: #000;
        }

        .sticker-subtitle {
          font-size: 12px;
          color: #6c757d;
        }

        .qr-section-side {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .qr-label {
          font-size: 9px;
          color: #6c757d;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .qr-code {
          border: 1px solid #dee2e6;
          border-radius: 2px;
          padding: 4px;
          background: white;
        }

        .sticker-details {
          margin-bottom: 12px;
          border-top: 1px solid #dee2e6;
          padding-top: 8px;
        }

        .detail-row {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          margin-bottom: 4px;
          padding: 0 4px;
        }

        .detail-label {
          font-weight: 600;
          color: #000;
        }

        .detail-value {
          color: #495057;
        }

        .barcode-section {
          margin-top: auto;
          text-align: center;
        }

        .barcode-label {
          font-size: 10px;
          color: #6c757d;
          margin-bottom: 4px;
          font-weight: 500;
        }

        .barcode-svg {
          width: 100%;
          height: 50px;
          display: block;
          margin: 0 auto;
        }

        @media print {
          body {
            margin: 0;
            padding: 0;
          }

          .sticker-preview-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 5mm !important;
            padding: 5mm !important;
            page-break-inside: avoid;
          }

          .sticker-preview-item {
            page-break-inside: avoid;
          }

          .sticker-card {
            border: 2px solid #000 !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          @page {
            size: A4 landscape;
            margin: 10mm;
          }
        }

        @media screen and (max-width: 1200px) {
          .sticker-preview-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media screen and (max-width: 768px) {
          .sticker-preview-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="mb-4">
        <h1 className="text-gradient mb-0">Sticker Generator</h1>
        <p className="text-muted mt-2">Generate and print individual stickers for cartons with filtering by FTM PO and PO number</p>
      </div>

      {/* Filters */}
      <div className="modern-card mb-4">
        <div className="modern-card-header">
          <h5 className="mb-0"><i className="bi bi-funnel me-2"></i>Filters</h5>
        </div>
        <div className="modern-card-body">
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label className="form-label-modern">FTM PO Number</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter FTM PO (e.g., FTM-12554)"
                  value={filters.ftm_po}
                  onChange={(e) => handleFilterChange('ftm_po', e.target.value)}
                  className="form-control-modern"
                />
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label className="form-label-modern">PO Number</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter PO number"
                  value={filters.po_number}
                  onChange={(e) => handleFilterChange('po_number', e.target.value)}
                  className="form-control-modern"
                />
              </Form.Group>
            </Col>
            <Col md={4} className="d-flex align-items-end">
              <div className="d-flex gap-2 w-100">
                <Button
                  variant="primary"
                  onClick={applyFilters}
                  disabled={loading}
                  className="btn-modern btn-modern-primary flex-grow-1"
                >
                  {loading ? <Spinner size="sm" /> : <i className="bi bi-search me-1"></i>}
                  Apply Filters
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={clearFilters}
                  disabled={loading}
                  className="btn-modern btn-modern-outline-secondary"
                >
                  <i className="bi bi-x-circle"></i>
                </Button>
              </div>
            </Col>
          </Row>
        </div>
      </div>

      {/* Summary Stats */}
      {summary && (
        <Row className="g-3 mb-4">
          <Col md={3}>
            <div className="modern-card text-center">
              <div className="modern-card-body">
                <div className="fs-2 fw-bold text-primary">{summary.total_ftm_pos}</div>
                <div className="text-muted">FTM POs</div>
              </div>
            </div>
          </Col>
          <Col md={3}>
            <div className="modern-card text-center">
              <div className="modern-card-body">
                <div className="fs-2 fw-bold text-success">{summary.total_po_numbers}</div>
                <div className="text-muted">PO Numbers</div>
              </div>
            </div>
          </Col>
          <Col md={3}>
            <div className="modern-card text-center">
              <div className="modern-card-body">
                <div className="fs-2 fw-bold text-info">{pagination.total}</div>
                <div className="text-muted">Total Cartons</div>
              </div>
            </div>
          </Col>
          <Col md={3}>
            <div className="modern-card text-center">
              <div className="modern-card-body">
                <div className="fs-2 fw-bold text-warning">{summary.pending_count}</div>
                <div className="text-muted">Pending</div>
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* Selection Controls */}
      {stickers.length > 0 && (
        <div className="modern-card mb-4">
          <div className="modern-card-body">
            <div className="d-flex justify-content-between align-items-center">
              <div>
                <span className="fw-medium">{selectedStickers.length} of {stickers.length} cartons selected</span>
              </div>
              <div className="d-flex gap-2">
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={selectAllStickers}
                  className="btn-modern btn-modern-outline-primary"
                >
                  Select All
                </Button>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={clearSelection}
                  className="btn-modern btn-modern-outline-secondary"
                >
                  Clear
                </Button>
                <Button
                  variant="outline-info"
                  size="sm"
                  onClick={previewSelectedStickers}
                  disabled={selectedStickers.length === 0}
                  className="btn-modern btn-modern-outline-info me-2"
                >
                  <i className="bi bi-eye me-1"></i>
                  Preview ({selectedStickers.length})
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={printSelectedStickers}
                  disabled={selectedStickers.length === 0}
                  className="btn-modern btn-modern-primary"
                >
                  <i className="bi bi-printer me-1"></i>
                  Print Selected ({selectedStickers.length})
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stickers List */}
      <div className="modern-card">
        <div className="modern-card-header">
          <h5 className="mb-0">
            <i className="bi bi-tags me-2"></i>
            Cartons {pagination.total > 0 && `(${pagination.total})`}
          </h5>
        </div>
        <div className="modern-card-body p-0">
          {loading && stickers.length === 0 ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
              <p className="mt-2 text-muted">Loading stickers...</p>
            </div>
          ) : stickers.length === 0 ? (
            <div className="text-center py-5">
              <i className="bi bi-tags fs-1 text-muted"></i>
              <p className="text-muted mt-2">No stickers found</p>
              <p className="text-muted small">Try adjusting your filters or check if data has been imported</p>
            </div>
          ) : (
            <div className="table-responsive">
              <Table className="table-modern mb-0">
                <thead>
                  <tr>
                    <th style={{width: '50px'}}>
                      <Form.Check
                        type="checkbox"
                        checked={selectedStickers.length === stickers.length && stickers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            selectAllStickers();
                          } else {
                            clearSelection();
                          }
                        }}
                      />
                    </th>
                    <th>FTM PO</th>
                    <th>PO Number</th>
                    <th>Size</th>
                    <th>Units</th>
                    <th>Item</th>
                    <th>Count</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stickers.map((sticker, index) => {
                    const isSelected = selectedStickers.some(s => s.carton_id === sticker.carton_id);

                    return (
                      <tr key={sticker.carton_id || index} className={isSelected ? 'table-active' : ''}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleStickerSelection(sticker)}
                          />
                        </td>
                        <td>
                          <span className="fw-medium">{sticker.ftm_po}</span>
                        </td>
                        <td>{sticker.po_number}</td>
                        <td>{sticker.size || 'N/A'}</td>
                        <td>{sticker.units || 'N/A'}</td>
                        <td>{sticker.item || 'N/A'}</td>
                        <td>
                          <Badge bg="primary" className="badge-modern badge-modern-primary">
                            {sticker.carton_count}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            bg={
                              sticker.status === 'entered' ? 'success' :
                              sticker.status === 'exited' ? 'secondary' : 'warning'
                            }
                            className={`badge-modern badge-modern-${
                              sticker.status === 'entered' ? 'success' :
                              sticker.status === 'exited' ? 'secondary' : 'warning'
                            }`}
                          >
                            {sticker.status === 'entered' ? 'Entered' :
                             sticker.status === 'exited' ? 'Shipped' : 'Pending'}
                          </Badge>
                        </td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => toggleStickerSelection(sticker)}
                            className="btn-modern btn-modern-outline-primary me-1"
                          >
                            {isSelected ? 'Deselect' : 'Select'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}

          {/* Load More */}
          {pagination.has_more && (
            <div className="text-center p-3 border-top">
              <Button
                variant="outline-primary"
                onClick={loadMore}
                disabled={loading}
                className="btn-modern btn-modern-outline-primary"
              >
                {loading ? <Spinner size="sm" /> : <i className="bi bi-arrow-down-circle me-1"></i>}
                Load More
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="danger" className="mt-3 alert-modern alert-modern-danger">
          <i className="bi bi-exclamation-triangle-fill"></i>
          <div>
            <strong>Error:</strong> {error}
          </div>
        </Alert>
      )}

      {/* Preview Modal */}
      <Modal
        show={showPreviewModal}
        onHide={() => setShowPreviewModal(false)}
        centered
        size="xl"
        className="preview-modal"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-eye me-2"></i>
            Sticker Preview ({previewStickers.length} cartons)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <div className="sticker-preview-grid">
            {previewStickers.map((sticker, index) => (
              <div key={`${sticker.carton_id || index}`} className="sticker-preview-item">
                <div className="sticker-card">
                  <div className="sticker-top-row">
                    <div className="sticker-header">
                      <div className="sticker-title">{sticker.ftm_po}</div>
                      <div className="sticker-subtitle">Customer PO: {sticker.po_number}</div>
                    </div>
                    
                    <div className="qr-section-side">
                      <div className="qr-label">QR</div>
                      <QRCode
                        value={sticker.barcode_2d}
                        size={70}
                        level="M"
                        className="qr-code"
                      />
                    </div>
                  </div>

                  <div className="sticker-details">
                    <div className="detail-row">
                      <span className="detail-label">Size:</span>
                      <span className="detail-value">{sticker.size || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Units:</span>
                      <span className="detail-value">{sticker.units || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Item:</span>
                      <span className="detail-value">{sticker.item || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">Cartons:</span>
                      <span className="detail-value">{sticker.carton_count}</span>
                    </div>
                  </div>

                  <div className="barcode-section">
                    <div className="barcode-label">Barcode</div>
                    <svg
                      ref={(el) => {
                        if (el && !barcodeRefs.current[`${sticker.carton_id || index}`]) {
                          barcodeRefs.current[`${sticker.carton_id || index}`] = el;
                          try {
                            JsBarcode(el, sticker.barcode_2d, {
                              format: "CODE128",
                              width: 2,
                              height: 50,
                              displayValue: true,
                              fontSize: 12,
                              margin: 2,
                              background: "#ffffff",
                              lineColor: "#000000"
                            });
                          } catch (error) {
                            console.error('Barcode generation error:', error);
                          }
                        }
                      }}
                      className="barcode-svg"
                    ></svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPreviewModal(false)}
            className="btn-modern btn-modern-secondary"
          >
            Close Preview
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              setShowPreviewModal(false);
              setShowPrintModal(true);
            }}
            className="btn-modern btn-modern-primary"
          >
            <i className="bi bi-printer me-1"></i>
            Proceed to Print
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Print Modal */}
      <Modal
        show={showPrintModal}
        onHide={() => setShowPrintModal(false)}
        centered
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-printer me-2"></i>
            Print Stickers
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="mb-3">
            You are about to print <strong>{selectedStickers.length}</strong> individual sticker(s).
            Each selected carton will get its own sticker with barcode and QR code.
          </p>

          <div className="alert alert-info">
            <i className="bi bi-info-circle me-2"></i>
            <strong>Print Settings:</strong> Make sure to set your printer to print stickers
            and adjust margins to 0.5cm for best results.
          </div>

          <div className="mt-3">
            <h6>Selected Cartons:</h6>
            <div className="bg-light p-3 rounded">
              {selectedStickers.map((sticker, index) => (
                <div key={sticker.carton_id || index} className="mb-2">
                  <strong>{sticker.ftm_po}</strong> - {sticker.po_number}
                  <span className="text-muted ms-2">(Size: {sticker.size}, Units: {sticker.units})</span>
                </div>
              ))}
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowPrintModal(false)}
            className="btn-modern btn-modern-secondary"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handlePrint}
            className="btn-modern btn-modern-primary"
          >
            <i className="bi bi-printer me-1"></i>
            Print Stickers
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default StickerGenerator;