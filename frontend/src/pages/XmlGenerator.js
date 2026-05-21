import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, Alert, Table, Badge, Card } from 'react-bootstrap';

const XmlGenerator = () => {
  const [formData, setFormData] = useState({
    ftmPo: '',
    customerPo: '',
    division: '',
    heading: 'Conveyable',
    reserveOrXdock: 'Reserve',
    waveCategory: 'Mens',
    depotStoreCode: '799',
    item: ''
  });

  const [cartonLines, setCartonLines] = useState([
    { size: '', units: '', quantity: 1 }
  ]);

  const [generatedXml, setGeneratedXml] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCartonLineChange = (index, field, value) => {
    const newLines = [...cartonLines];
    newLines[index][field] = value;
    setCartonLines(newLines);
  };

  const addCartonLine = () => {
    setCartonLines([...cartonLines, { size: '', units: '', quantity: 1 }]);
  };

  const removeCartonLine = (index) => {
    if (cartonLines.length > 1) {
      const newLines = cartonLines.filter((_, i) => i !== index);
      setCartonLines(newLines);
    }
  };

  const generateXml = () => {
    setError(null);
    setSuccess(false);

    // Validation
    if (!formData.ftmPo || !formData.customerPo || !formData.item) {
      setError('Please fill in FTM PO, Customer PO, and Item fields');
      return;
    }

    for (let line of cartonLines) {
      if (!line.size || !line.units || line.quantity < 1) {
        setError('Please fill in all carton details (Size, Units, Quantity)');
        return;
      }
    }

    let xml = '<?xml version="1.0" encoding="utf-8"?>\n<SupplerITPrintTags>';
    
    let sequenceNumber = 1;
    let prePackId = 1;
    const printDate = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    
    // Calculate total cartons
    const totalCartons = cartonLines.reduce((sum, line) => sum + parseInt(line.quantity), 0);

    cartonLines.forEach((line) => {
      for (let i = 0; i < parseInt(line.quantity); i++) {
        const barcode = `1-${formData.depotStoreCode}-${Date.now()}-${sequenceNumber}`;
        const transferNumber = barcode;
        const transferNumberEndFour = `${sequenceNumber.toString().padStart(2, '0')}-${sequenceNumber}`;

        xml += `<Panda>`;
        xml += `<Heading>${formData.heading}</Heading>`;
        xml += `<Division>${formData.division}</Division>`;
        xml += `<PoNumber>${formData.customerPo}</PoNumber>`;
        xml += `<PrePackId>1-${prePackId}</PrePackId>`;
        xml += `<BarCode2D>${barcode}</BarCode2D>`;
        xml += `<ReserveOrXdock>${formData.reserveOrXdock}</ReserveOrXdock>`;
        xml += `<Size>${line.size}</Size>`;
        xml += `<Units>${line.units}</Units>`;
        xml += `<Item>${formData.item}</Item>`;
        xml += `<TransferNumber>${transferNumber}</TransferNumber>`;
        xml += `<TransferNumberEndFour>${transferNumberEndFour}</TransferNumberEndFour>`;
        xml += `<SequenceNumber>${sequenceNumber}</SequenceNumber>`;
        xml += `<TextOnLabel></TextOnLabel>`;
        xml += `<IsOnline>False</IsOnline>`;
        xml += `<LabelText></LabelText>`;
        xml += `<ToatlSequenceNumber>${totalCartons}</ToatlSequenceNumber>`;
        xml += `<PrintCount>1</PrintCount>`;
        xml += `<WaveCategory>${formData.waveCategory}</WaveCategory>`;
        xml += `<PrintDate>${printDate}</PrintDate>`;
        xml += `<PrintPandaLabel>True</PrintPandaLabel>`;
        xml += `<DepotStoreCode>${formData.depotStoreCode}</DepotStoreCode>`;
        xml += `<LpnPrintR></LpnPrintR>`;
        xml += `</Panda>`;

        sequenceNumber++;
        if (i === parseInt(line.quantity) - 1) {
          prePackId++;
        }
      }
    });

    xml += '</SupplerITPrintTags>';

    setGeneratedXml(xml);
    setSuccess(true);
  };

  const downloadXml = () => {
    const blob = new Blob([generatedXml], { type: 'application/xml' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${formData.ftmPo}_${new Date().getTime()}.mrpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const resetForm = () => {
    setFormData({
      ftmPo: '',
      customerPo: '',
      division: '',
      heading: 'Conveyable',
      reserveOrXdock: 'Reserve',
      waveCategory: 'Mens',
      depotStoreCode: '799',
      item: ''
    });
    setCartonLines([{ size: '', units: '', quantity: 1 }]);
    setGeneratedXml('');
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="py-2">
      <div className="mb-4">
        <h1 className="text-gradient mb-0">XML File Generator</h1>
        <p className="text-muted mt-2">Create XML files for label printing</p>
        <p className="text-muted small mb-0">
          <i className="bi bi-info-circle me-1"></i>
          Only applicable to other customers e.g. OTB, OBSW — not MRP.
        </p>
      </div>

      {error && (
        <Alert variant="danger" className="alert-modern alert-modern-danger">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" className="alert-modern alert-modern-success">
          <i className="bi bi-check-circle-fill me-2"></i>
          XML file generated successfully! Click "Download XML" to save it.
        </Alert>
      )}

      <Row className="g-4">
        <Col lg={6}>
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-info-circle me-2"></i>General Information</h5>
            </div>
            <div className="modern-card-body">
              <Form>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="form-label-modern">FTM PO Number *</Form.Label>
                      <Form.Control
                        type="text"
                        name="ftmPo"
                        value={formData.ftmPo}
                        onChange={handleInputChange}
                        placeholder="e.g., FTM-10001"
                        className="form-control-modern"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="form-label-modern">Customer PO Number *</Form.Label>
                      <Form.Control
                        type="text"
                        name="customerPo"
                        value={formData.customerPo}
                        onChange={handleInputChange}
                        placeholder="e.g., 1055139"
                        className="form-control-modern"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="form-label-modern">Item Code *</Form.Label>
                      <Form.Control
                        type="text"
                        name="item"
                        value={formData.item}
                        onChange={handleInputChange}
                        placeholder="e.g., 104702008"
                        className="form-control-modern"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="form-label-modern">Division</Form.Label>
                      <Form.Control
                        type="text"
                        name="division"
                        value={formData.division}
                        onChange={handleInputChange}
                        placeholder="e.g., Mr Price"
                        className="form-control-modern"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="form-label-modern">Wave Category</Form.Label>
                      <Form.Select
                        name="waveCategory"
                        value={formData.waveCategory}
                        onChange={handleInputChange}
                        className="form-control-modern"
                      >
                        <option value="Mens">Mens</option>
                        <option value="Ladies">Ladies</option>
                        <option value="Kids">Kids</option>
                        <option value="Home">Home</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="form-label-modern">Depot Store Code</Form.Label>
                      <Form.Control
                        type="text"
                        name="depotStoreCode"
                        value={formData.depotStoreCode}
                        onChange={handleInputChange}
                        className="form-control-modern"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Form>
            </div>
          </div>

          <div className="modern-card mt-4">
            <div className="modern-card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="bi bi-box-seam me-2"></i>Carton Details</h5>
              <Button
                variant="primary"
                size="sm"
                onClick={addCartonLine}
                className="btn-modern btn-modern-primary"
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add Line
              </Button>
            </div>
            <div className="modern-card-body">
              <Table className="table-modern">
                <thead>
                  <tr>
                    <th>Size *</th>
                    <th>Units *</th>
                    <th>Quantity *</th>
                    <th style={{ width: '50px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {cartonLines.map((line, index) => (
                    <tr key={index}>
                      <td>
                        <Form.Control
                          type="text"
                          value={line.size}
                          onChange={(e) => handleCartonLineChange(index, 'size', e.target.value)}
                          placeholder="e.g., 32R"
                          className="form-control-modern"
                          size="sm"
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          value={line.units}
                          onChange={(e) => handleCartonLineChange(index, 'units', e.target.value)}
                          placeholder="Units"
                          className="form-control-modern"
                          size="sm"
                          min="1"
                        />
                      </td>
                      <td>
                        <Form.Control
                          type="number"
                          value={line.quantity}
                          onChange={(e) => handleCartonLineChange(index, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="form-control-modern"
                          size="sm"
                          min="1"
                        />
                      </td>
                      <td>
                        {cartonLines.length > 1 && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => removeCartonLine(index)}
                            className="btn-modern btn-modern-danger"
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="text-muted small mt-2">
                <i className="bi bi-info-circle me-1"></i>
                Total Cartons: <Badge bg="primary">{cartonLines.reduce((sum, line) => sum + parseInt(line.quantity || 0), 0)}</Badge>
              </div>
            </div>
          </div>

          <div className="d-flex gap-2 mt-4">
            <Button
              variant="success"
              onClick={generateXml}
              className="btn-modern btn-modern-success"
            >
              <i className="bi bi-file-earmark-code me-2"></i>
              Generate XML
            </Button>
            {generatedXml && (
              <Button
                variant="primary"
                onClick={downloadXml}
                className="btn-modern btn-modern-primary"
              >
                <i className="bi bi-download me-2"></i>
                Download XML
              </Button>
            )}
            <Button
              variant="outline-secondary"
              onClick={resetForm}
              className="btn-modern btn-modern-outline-secondary"
            >
              <i className="bi bi-arrow-clockwise me-2"></i>
              Reset
            </Button>
          </div>
        </Col>

        <Col lg={6}>
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-code-square me-2"></i>Generated XML Preview</h5>
            </div>
            <div className="modern-card-body">
              {generatedXml ? (
                <pre style={{
                  maxHeight: '600px',
                  overflow: 'auto',
                  backgroundColor: '#f8f9fa',
                  padding: '15px',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}>
                  {generatedXml}
                </pre>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-file-earmark-code fs-1"></i>
                  <p className="mt-2">Fill in the form and click "Generate XML" to see the preview</p>
                </div>
              )}
            </div>
          </div>
        </Col>
      </Row>
    </div>
  );
};

export default XmlGenerator;
