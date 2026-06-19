import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const styleStorageKey = 'fileUpload:lastStyle';
const colorStorageKey = 'fileUpload:lastColor';
const styleHistoryKey = 'fileUpload:styleHistory';
const colorHistoryKey = 'fileUpload:colorHistory';

const loadHistory = (key) => {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const saveToHistory = (key, value, setter) => {
  const trimmed = String(value || '').trim();
  if (!trimmed) return;
  const prev = loadHistory(key);
  const next = [trimmed, ...prev.filter((v) => v.toLowerCase() !== trimmed.toLowerCase())].slice(0, 30);
  localStorage.setItem(key, JSON.stringify(next));
  if (setter) setter(next);
};

const indentDigitsFromPo = (internalPoNumber) => {
  const value = String(internalPoNumber || '').trim();
  return value.replace(/^FTM-/i, '');
};

const validateMrpgFile = (selectedFile) => {
  const errors = [];
  if (!selectedFile) {
    errors.push('Please select a file');
    return errors;
  }
  if (!selectedFile.name.toLowerCase().endsWith('.mrpg')) {
    errors.push('Only .mrpg files are allowed');
  }
  const maxSize = 10 * 1024 * 1024;
  if (selectedFile.size > maxSize) {
    errors.push('File size must be less than 10MB');
  }
  if (selectedFile.size < 100) {
    errors.push('File appears to be too small to contain valid XML data');
  }
  const allowedTypes = ['text/xml', 'application/xml', 'text/plain', 'application/octet-stream'];
  if (selectedFile.type && !allowedTypes.includes(selectedFile.type)) {
    errors.push('Invalid file type. Please select a valid XML file.');
  }
  return errors;
};

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [bulkItems, setBulkItems] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState(null);
  const [validationErrors, setValidationErrors] = useState([]);
  const [internalPoNumber, setInternalPoNumber] = useState('');
  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [quantity, setQuantity] = useState('');
  const [customerOrderNo, setCustomerOrderNo] = useState('');
  const [scheduleMatchInfo, setScheduleMatchInfo] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadSpeed, setUploadSpeed] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState(null);
  const [styleHistory, setStyleHistory] = useState([]);
  const [colorHistory, setColorHistory] = useState([]);

  const [activeSchedule, setActiveSchedule] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [scheduleFile, setScheduleFile] = useState(null);
  const [scheduleUploading, setScheduleUploading] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState(null);
  const [duplicateGroups, setDuplicateGroups] = useState([]);
  const [smartPickSummary, setSmartPickSummary] = useState(null);
  const [importBlocked, setImportBlocked] = useState(false);
  const [singleMatched, setSingleMatched] = useState(false);
  const [singleScheduleId, setSingleScheduleId] = useState(null);
  const [scheduleLibrary, setScheduleLibrary] = useState(null);
  const [backfillCandidates, setBackfillCandidates] = useState([]);
  const [backfillSelected, setBackfillSelected] = useState({});
  const [backfillApplying, setBackfillApplying] = useState(false);

  const isBulkMode = bulkItems.length > 1;

  const loadScheduleStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/schedule.php?action=list`);
      if (res.data?.success) {
        setSchedules(res.data.schedules || []);
        setActiveSchedule(res.data.active || null);
        setScheduleLibrary(res.data.library || null);
      }
    } catch (err) {
      console.error('Failed to load schedule status', err);
    }
  }, []);

  useEffect(() => {
    const savedStyle = localStorage.getItem(styleStorageKey);
    const savedColor = localStorage.getItem(colorStorageKey);
    if (savedStyle !== null) setStyle(savedStyle);
    if (savedColor !== null) setColor(savedColor);
    setStyleHistory(loadHistory(styleHistoryKey));
    setColorHistory(loadHistory(colorHistoryKey));
    loadScheduleStatus();
  }, [loadScheduleStatus]);

  useEffect(() => {
    if (style.trim()) localStorage.setItem(styleStorageKey, style);
  }, [style]);

  useEffect(() => {
    if (color.trim()) localStorage.setItem(colorStorageKey, color);
  }, [color]);

  useEffect(() => {
    if (uploadResult?.success) {
      const timer = setTimeout(() => setUploadResult(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [uploadResult]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const buildPreviewItem = (preview, sourceFile, index) => ({
    id: `${sourceFile.name}-${index}`,
    file: sourceFile,
    file_name: preview.file_name || sourceFile.name,
    success: preview.success !== false,
    message: preview.message || null,
    customer_order_no: String(preview.customer_order_no || ''),
    carton_count: preview.carton_count || 0,
    matched: !!preview.matched,
    internal_po_number: preview.internal_po_number || '',
    indent_digits: indentDigitsFromPo(preview.internal_po_number),
    style: preview.style || '',
    color: preview.color || '',
    quantity: preview.quantity || '',
    schedule_id: preview.schedule_id || null,
    week_label: preview.week_label || '',
    ambiguous_schedule: !!preview.ambiguous_schedule,
    alternate_weeks: preview.alternate_weeks || [],
    can_import_unlinked: preview.can_import_unlinked !== false && !preview.matched,
    selected: preview.pick_selected !== false && preview.success !== false,
    pick_recommended: !!preview.pick_recommended,
    pick_reason: preview.pick_reason || null,
    duplicate_group: preview.duplicate_group || null,
    duplicate_count: preview.duplicate_count || 1,
    already_imported: !!preview.already_imported,
    import_block_reason: preview.import_block_reason || null,
    status: 'pending',
    error: preview.success === false ? preview.message : null,
    shipmentId: null,
  });

  const applySinglePreview = (preview, library = scheduleLibrary) => {
    if (!preview?.success) return;
    setCustomerOrderNo(String(preview.customer_order_no || ''));
    if (preview.already_imported) {
      setImportBlocked(true);
      setScheduleMatchInfo({
        matched: false,
        message: preview.import_block_reason || 'This FTM PO is already imported.',
      });
      return;
    }
    setImportBlocked(false);
    setSingleMatched(!!preview.matched);
    setSingleScheduleId(preview.schedule_id || null);
    if (preview.matched) {
      setInternalPoNumber(indentDigitsFromPo(preview.internal_po_number));
      setStyle(preview.style || '');
      setColor(preview.color || '');
      setQuantity(preview.quantity || '');
      let message = `Matched in ${preview.week_label || 'schedule library'}`;
      if (preview.ambiguous_schedule && preview.alternate_weeks?.length) {
        message += ` (also in: ${preview.alternate_weeks.join(', ')})`;
      }
      setScheduleMatchInfo({ matched: true, week_label: preview.week_label, message });
    } else {
      setInternalPoNumber('');
      setStyle('');
      setColor('');
      setQuantity('');
      setScheduleMatchInfo({
        matched: false,
        message: library?.order_count
          ? `Order ${preview.customer_order_no} not in schedule library yet. You can import now and link when the schedule is loaded.`
          : 'No schedules loaded yet. Import without schedule or upload a weekly schedule first.',
      });
    }
  };

  const previewMrpgFiles = async (files) => {
    const validFiles = [];
    const errors = [];

    files.forEach((selectedFile) => {
      const fileErrors = validateMrpgFile(selectedFile);
      if (fileErrors.length > 0) {
        errors.push(`${selectedFile.name}: ${fileErrors.join(', ')}`);
      } else {
        validFiles.push(selectedFile);
      }
    });

    setValidationErrors(errors);
    if (validFiles.length === 0) {
      setFile(null);
      setBulkItems([]);
      setDuplicateGroups([]);
      setSmartPickSummary(null);
      return;
    }

    setPreviewing(true);
    setError(null);
    setUploadResult(null);
    setDuplicateGroups([]);
    setSmartPickSummary(null);

    try {
      const formData = new FormData();
      validFiles.forEach((f) => formData.append('mrpgFiles[]', f));

      const res = await axios.post(`${API_BASE_URL}/preview_mrpg.php`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Preview failed');
      }

      if (res.data.library) {
        setScheduleLibrary(res.data.library);
      }

      const items = (res.data.previews || []).map((preview, index) =>
        buildPreviewItem(preview, validFiles[index], index)
      );

      setDuplicateGroups(res.data.duplicate_groups || []);
      setSmartPickSummary({
        duplicate_group_count: res.data.duplicate_group_count || 0,
        auto_skipped_count: res.data.auto_skipped_count || 0,
        selected_count: res.data.selected_count || 0,
      });

      if (validFiles.length === 1) {
        setFile(validFiles[0]);
        setBulkItems([]);
        applySinglePreview(res.data.previews?.[0], res.data.library);
      } else {
        setFile(null);
        setBulkItems(items);
        const dupCount = res.data.duplicate_group_count || 0;
        const skipped = res.data.auto_skipped_count || 0;
        const selected = res.data.selected_count || 0;
        let message = `${res.data.matched_count} matched, ${res.data.unmatched_count} need manual review`;
        if (dupCount > 0) {
          message += `. ${dupCount} duplicate order group(s): ${selected} file(s) selected, ${skipped} auto-skipped`;
        }
        setScheduleMatchInfo({
          matched: res.data.matched_count > 0,
          message,
        });
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to preview files');
      setFile(null);
      setBulkItems([]);
      setDuplicateGroups([]);
      setSmartPickSummary(null);
    } finally {
      setPreviewing(false);
    }
  };

  const selectRecommendedBulk = () => {
    setBulkItems((items) =>
      items.map((item) => ({
        ...item,
        selected: item.success !== false && item.pick_recommended && !item.already_imported,
      }))
    );
  };

  const selectAllBulk = () => {
    setBulkItems((items) =>
      items.map((item) => ({
        ...item,
        selected: item.success !== false && item.status !== 'success' && !item.already_imported,
      }))
    );
  };

  const processSelectedFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) {
      setFile(null);
      setBulkItems([]);
      setValidationErrors([]);
      setScheduleMatchInfo(null);
      setCustomerOrderNo('');
      setDuplicateGroups([]);
      setSmartPickSummary(null);
      return;
    }
    previewMrpgFiles(files);
  };

  const handleFileChange = (e) => {
    processSelectedFiles(e.target.files);
    if (e.target) e.target.value = '';
  };

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
    processSelectedFiles(e.dataTransfer.files);
  };

  const uploadSingleFile = async (importMode = 'linked') => {
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    if (importMode === 'linked') {
      if (!internalPoNumber.trim()) {
        setError('Please enter a PO number');
        return;
      }
      if (!style.trim() || !color.trim() || !quantity.trim()) {
        setError('Please enter style, color, and quantity');
        return;
      }
    }

    const fileErrors = validateMrpgFile(file);
    if (fileErrors.length > 0) {
      setValidationErrors(fileErrors);
      setError('Please fix the file validation errors before uploading');
      return;
    }

    const formData = new FormData();
    formData.append('xmlFile', file);
    formData.append('importMode', importMode);
    formData.append('customerOrderNo', customerOrderNo);
    if (importMode === 'linked') {
      formData.append('internalPoNumber', 'FTM-' + internalPoNumber.trim());
      formData.append('style', style.trim());
      formData.append('color', color.trim());
      formData.append('quantity', quantity.trim());
      if (singleScheduleId) formData.append('scheduleId', singleScheduleId);
    }

    try {
      setUploading(true);
      setUploadProgress(0);
      setError(null);
      setValidationErrors([]);
      setUploadStartTime(Date.now());

      const response = await axios.post(`${API_BASE_URL}/upload.php`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
          if (uploadStartTime) {
            const elapsedTime = (Date.now() - uploadStartTime) / 1000;
            const uploadedBytes = progressEvent.loaded;
            const remainingBytes = progressEvent.total - uploadedBytes;
            if (elapsedTime > 0) {
              const speed = uploadedBytes / elapsedTime;
              setUploadSpeed(speed);
              setTimeRemaining(remainingBytes / speed);
            }
          }
        },
        timeout: 120000,
        maxContentLength: 10 * 1024 * 1024,
        maxBodyLength: 10 * 1024 * 1024,
      });

      if (response.data.success) {
        if (importMode === 'linked') {
          saveToHistory(styleHistoryKey, style, setStyleHistory);
          saveToHistory(colorHistoryKey, color, setColorHistory);
        }
        setUploadResult({
          success: true,
          message: response.data.message,
          shipmentId: response.data.shipment_id,
          poNumber: response.data.po_number,
          cartonCount: response.data.cartons_imported,
          style: importMode === 'linked' ? style : 'Pending schedule',
          color: importMode === 'linked' ? color : 'Pending schedule',
          quantity: importMode === 'linked' ? quantity : '',
          unlinked: importMode === 'unlinked',
        });
        clearForm();
      } else {
        throw new Error(response.data.message || 'Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'An error occurred during upload.');
      setUploadResult({ success: false });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      setUploadSpeed(0);
      setTimeRemaining(0);
      setUploadStartTime(null);
    }
  };

  const uploadBulkItem = async (item) => {
    if (!item.file) return { success: false, message: 'Missing file' };

    const formData = new FormData();
    formData.append('xmlFile', item.file);
    formData.append('customerOrderNo', item.customer_order_no || '');

    if (item.matched && item.indent_digits?.trim() && item.style?.trim() && item.color?.trim() && item.quantity?.trim()) {
      formData.append('importMode', 'linked');
      formData.append('internalPoNumber', 'FTM-' + item.indent_digits.trim());
      formData.append('style', item.style.trim());
      formData.append('color', item.color.trim());
      formData.append('quantity', item.quantity.trim());
      if (item.schedule_id) formData.append('scheduleId', item.schedule_id);
    } else if (item.customer_order_no) {
      formData.append('importMode', 'unlinked');
    } else {
      return { success: false, message: 'Missing order number for unlinked import' };
    }

    const response = await axios.post(`${API_BASE_URL}/upload.php`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Upload failed');
    }

    return {
      success: true,
      shipmentId: response.data.shipment_id,
      cartonCount: response.data.cartons_imported,
    };
  };

  const handleBulkImport = async () => {
    const selected = bulkItems.filter(bulkItemReady);
    if (selected.length === 0) {
      setError('Select at least one ready file to import');
      return;
    }

    setUploading(true);
    setError(null);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    const updated = [...bulkItems];
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (!item.selected || item.success === false || item.status === 'success') continue;

      if (item.already_imported) {
        updated[i] = {
          ...item,
          status: 'error',
          error: item.import_block_reason || 'Already imported',
        };
        skippedCount++;
        failCount++;
        setBulkItems([...updated]);
        continue;
      }

      updated[i] = { ...item, status: 'importing', error: null };
      setBulkItems([...updated]);

      try {
        const result = await uploadBulkItem(item);
        updated[i] = {
          ...updated[i],
          status: 'success',
          shipmentId: result.shipmentId,
          error: null,
        };
        successCount++;
      } catch (err) {
        updated[i] = {
          ...updated[i],
          status: 'error',
          error: err.response?.data?.message || err.message || 'Upload failed',
        };
        failCount++;
      }
      setBulkItems([...updated]);
    }

    setUploading(false);
    if (successCount > 0) {
      const failPart = failCount ? `, ${failCount} failed` : '';
      const skipPart = skippedCount ? ` (${skippedCount} already imported)` : '';
      setUploadResult({
        success: true,
        message: `Imported ${successCount} file(s)${failPart}${skipPart}`,
        bulk: true,
        successCount,
        failCount,
      });
    } else if (failCount > 0) {
      setError('All selected imports failed. Check the errors in the table.');
    }
  };

  const handleScheduleUpload = async () => {
    if (!scheduleFile) {
      setScheduleMessage({ type: 'danger', text: 'Select a weekly schedule Excel file first.' });
      return;
    }

    const formData = new FormData();
    formData.append('scheduleFile', scheduleFile);
    formData.append('set_active', '1');

    try {
      setScheduleUploading(true);
      setScheduleMessage(null);
      const res = await axios.post(`${API_BASE_URL}/schedule.php?action=upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });

      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Schedule upload failed');
      }

      setScheduleMessage({
        type: 'success',
        text: `Loaded ${res.data.schedule.week_label} with ${res.data.schedule.order_count} orders.`,
      });
      setScheduleFile(null);
      const input = document.getElementById('scheduleUpload');
      if (input) input.value = '';
      await loadScheduleStatus();

      if (res.data.backfill?.count > 0) {
        const candidates = res.data.backfill.candidates || [];
        setBackfillCandidates(candidates);
        const selected = {};
        candidates.forEach((c) => {
          if (c.safe_auto) selected[c.shipment_id] = true;
        });
        setBackfillSelected(selected);
      } else {
        setBackfillCandidates([]);
        setBackfillSelected({});
      }

      if (file) {
        previewMrpgFiles([file]);
      } else if (bulkItems.length > 0) {
        previewMrpgFiles(bulkItems.map((item) => item.file));
      }
    } catch (err) {
      setScheduleMessage({
        type: 'danger',
        text: err.response?.data?.message || err.message || 'Schedule upload failed',
      });
    } finally {
      setScheduleUploading(false);
    }
  };

  const applyBackfill = async (onlySafe = false) => {
    const items = backfillCandidates
      .filter((c) => {
        if (!backfillSelected[c.shipment_id]) return false;
        if (onlySafe && !c.safe_auto) return false;
        return true;
      })
      .map((c) => ({
        shipment_id: c.shipment_id,
        schedule_id: c.schedule_id,
        apply_indent: true,
        confirmed: c.backfill_level === 'review',
        force: c.backfill_level === 'conflict',
      }));

    if (items.length === 0) {
      setScheduleMessage({ type: 'warning', text: 'Select at least one shipment to link.' });
      return;
    }

    try {
      setBackfillApplying(true);
      const res = await axios.post(`${API_BASE_URL}/schedule.php?action=backfill_apply`, { items });
      if (!res.data?.success) throw new Error(res.data?.message || 'Backfill failed');
      setScheduleMessage({
        type: 'success',
        text: res.data.message || `Linked ${res.data.result?.applied || 0} shipment(s).`,
      });
      setBackfillCandidates([]);
      setBackfillSelected({});
      if (file) previewMrpgFiles([file]);
      else if (bulkItems.length > 0) previewMrpgFiles(bulkItems.map((item) => item.file));
    } catch (err) {
      setScheduleMessage({
        type: 'danger',
        text: err.response?.data?.message || err.message || 'Backfill failed',
      });
    } finally {
      setBackfillApplying(false);
    }
  };

  const handleActivateSchedule = async (scheduleId) => {
    try {
      await axios.post(`${API_BASE_URL}/schedule.php?action=activate`, { schedule_id: scheduleId });
      await loadScheduleStatus();
      if (file) previewMrpgFiles([file]);
      else if (bulkItems.length > 0) previewMrpgFiles(bulkItems.map((item) => item.file));
    } catch (err) {
      setScheduleMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to activate schedule',
      });
    }
  };

  const updateBulkItem = (id, field, value) => {
    setBulkItems((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, [field]: value };
        if (field === 'indent_digits') {
          next.internal_po_number = value.trim() ? `FTM-${value.trim()}` : '';
        }
        return next;
      })
    );
  };

  const clearForm = () => {
    setFile(null);
    setBulkItems([]);
    setInternalPoNumber('');
    setStyle('');
    setColor('');
    setQuantity('');
    setCustomerOrderNo('');
    setScheduleMatchInfo(null);
    setValidationErrors([]);
    setError(null);
    setUploadResult(null);
    setUploadSpeed(0);
    setTimeRemaining(0);
    setUploadStartTime(null);
    setDuplicateGroups([]);
    setSmartPickSummary(null);
    setImportBlocked(false);
    setSingleMatched(false);
    setSingleScheduleId(null);
    setBackfillCandidates([]);
    setBackfillSelected({});
    const input = document.getElementById('fileUpload');
    if (input) input.value = '';
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (isBulkMode) {
      await handleBulkImport();
    } else if (singleMatched) {
      await uploadSingleFile('linked');
    } else {
      await uploadSingleFile('unlinked');
    }
  };

  const bulkItemReady = (item) => {
    if (!item.selected || item.success === false || item.already_imported || item.status === 'success') {
      return false;
    }
    if (item.matched) {
      return !!(item.indent_digits?.trim() && item.style?.trim() && item.color?.trim() && item.quantity?.trim());
    }
    return !!item.customer_order_no;
  };

  const canSubmitSingle = file && singleMatched && internalPoNumber.trim() && style.trim() && color.trim() && quantity.trim() && !uploading && !previewing && !importBlocked && validationErrors.length === 0;
  const canSubmitUnlinked = file && !singleMatched && customerOrderNo && !uploading && !previewing && !importBlocked && validationErrors.length === 0;
  const canSubmitBulk = bulkItems.some(bulkItemReady) && !uploading && !previewing;

  const bulkRowClass = (item) => {
    if (item.status === 'error') return 'table-danger';
    if (item.status === 'success') return 'table-success';
    if (item.already_imported) return 'table-secondary';
    if (item.pick_recommended && item.selected) return 'table-info';
    if (item.duplicate_group && !item.pick_recommended) return 'table-warning';
    return '';
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
              <h5 className="mb-0"><i className="bi bi-calendar-week me-2"></i>Weekly Delivery Schedule</h5>
            </div>
            <div className="modern-card-body">
              {activeSchedule ? (
                <div className="alert-modern alert-modern-info mb-3">
                  <i className="bi bi-check-circle"></i>
                  <div>
                    <strong>Active schedule:</strong> {activeSchedule.week_label}
                    <span className="text-muted ms-2">({activeSchedule.order_count} orders)</span>
                    {scheduleLibrary && (
                      <div className="small text-muted mt-1">
                        Schedule library: {scheduleLibrary.schedule_count} week(s), {scheduleLibrary.order_count} orders indexed — matching uses all stored schedules.
                      </div>
                    )}
                  </div>
                </div>
              ) : scheduleLibrary?.schedule_count > 0 ? (
                <div className="alert-modern alert-modern-info mb-3">
                  <i className="bi bi-collection"></i>
                  <div>
                    <strong>Schedule library:</strong> {scheduleLibrary.schedule_count} week(s), {scheduleLibrary.order_count} orders — uploads match against all stored schedules.
                  </div>
                </div>
              ) : (
                <div className="alert-modern alert-modern-warning mb-3">
                  <i className="bi bi-exclamation-triangle"></i>
                  <div>No active schedule. Upload your weekly Excel schedule to auto-fill indent, style, and color.</div>
                </div>
              )}

              <div className="row g-3 align-items-end">
                <div className="col-md-8">
                  <label className="form-label-modern">Schedule file (.xlsx)</label>
                  <input
                    id="scheduleUpload"
                    type="file"
                    className="form-control-modern"
                    accept=".xlsx"
                    disabled={scheduleUploading}
                    onChange={(e) => setScheduleFile(e.target.files?.[0] || null)}
                  />
                  <div className="text-muted small mt-1">Example: WEEK 024.xlsx</div>
                </div>
                <div className="col-md-4">
                  <button
                    type="button"
                    className="btn-modern btn-modern-primary w-100"
                    onClick={handleScheduleUpload}
                    disabled={!scheduleFile || scheduleUploading}
                  >
                    {scheduleUploading ? 'Uploading...' : 'Load Schedule'}
                  </button>
                </div>
              </div>

              {scheduleMessage && (
                <div className={`alert-modern alert-modern-${scheduleMessage.type} mt-3 mb-0`}>
                  {scheduleMessage.text}
                </div>
              )}

              {backfillCandidates.length > 0 && (
                <div className="mt-3 border rounded p-3 bg-light">
                  <h6 className="mb-2">
                    <i className="bi bi-link-45deg me-1"></i>
                    Link existing imports ({backfillCandidates.length})
                  </h6>
                  <p className="small text-muted">
                    These shipments were imported before the schedule was available. Select which ones to update with FTM indent, style, and color.
                  </p>
                  <div className="table-responsive mb-3">
                    <table className="table table-sm mb-0">
                      <thead>
                        <tr>
                          <th></th>
                          <th>Order</th>
                          <th>Current PO</th>
                          <th>→ New PO</th>
                          <th>Week</th>
                          <th>Level</th>
                        </tr>
                      </thead>
                      <tbody>
                        {backfillCandidates.map((c) => (
                          <tr key={c.shipment_id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={!!backfillSelected[c.shipment_id]}
                                onChange={(e) =>
                                  setBackfillSelected((prev) => ({
                                    ...prev,
                                    [c.shipment_id]: e.target.checked,
                                  }))
                                }
                              />
                            </td>
                            <td>{c.customer_order_no}</td>
                            <td className="small">{c.current_internal_po_number}</td>
                            <td className="small fw-medium">{c.proposed_internal_po_number}</td>
                            <td>{c.schedule_week_label}</td>
                            <td>
                              <span className={`badge ${c.backfill_level === 'safe' ? 'bg-success' : c.backfill_level === 'conflict' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                {c.backfill_level}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm btn-primary"
                      disabled={backfillApplying}
                      onClick={() => applyBackfill(false)}
                    >
                      {backfillApplying ? 'Linking...' : 'Link selected'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      disabled={backfillApplying}
                      onClick={() => applyBackfill(true)}
                    >
                      Link safe only
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      disabled={backfillApplying}
                      onClick={() => {
                        setBackfillCandidates([]);
                        setBackfillSelected({});
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {schedules.length > 1 && (
                <div className="mt-3">
                  <label className="form-label-modern small">Switch active schedule</label>
                  <div className="d-flex flex-wrap gap-2">
                    {schedules.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className={`btn btn-sm ${s.is_active === '1' || s.is_active === 1 ? 'btn-primary' : 'btn-outline-secondary'}`}
                        onClick={() => handleActivateSchedule(s.id)}
                      >
                        {s.week_label} ({s.order_count})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-3">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={async () => {
                    try {
                      const res = await axios.get(`${API_BASE_URL}/schedule.php?action=backfill_preview`);
                      const candidates = res.data?.candidates || [];
                      setBackfillCandidates(candidates);
                      const selected = {};
                      candidates.forEach((c) => {
                        if (c.safe_auto) selected[c.shipment_id] = true;
                      });
                      setBackfillSelected(selected);
                      if (candidates.length === 0) {
                        setScheduleMessage({ type: 'info', text: 'No unlinked imports match the schedule library.' });
                      }
                    } catch (err) {
                      setScheduleMessage({ type: 'danger', text: err.response?.data?.message || 'Could not load linkable orders' });
                    }
                  }}
                >
                  <i className="bi bi-search me-1"></i> Find orders to link
                </button>
              </div>
            </div>
          </div>

          <div className="modern-card mb-4">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-upload me-2"></i>Upload Shipment XML</h5>
            </div>
            <div className="modern-card-body">
              <form onSubmit={handleUpload}>
                <div className="mb-4">
                  <label className="form-label-modern">Select XML File(s) (.mrpg)</label>
                  <div className="custom-file-upload mb-3">
                    <div
                      className={`upload-area-modern ${file || bulkItems.length ? 'has-file' : ''} ${validationErrors.length > 0 ? 'has-error' : ''} ${isDragOver ? 'drag-over' : ''}`}
                      onClick={() => document.getElementById('fileUpload').click()}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      {previewing ? (
                        <div>
                          <div className="loading-spinner-modern d-inline-block mb-2"></div>
                          <p className="mb-0">Reading file and matching schedule...</p>
                        </div>
                      ) : file ? (
                        <div>
                          <i className="bi bi-file-earmark-check fs-1 text-success mb-2"></i>
                          <p className="mb-0 fw-bold">{file.name}</p>
                          <p className="text-muted small">{(file.size / 1024).toFixed(2)} KB</p>
                          {customerOrderNo && (
                            <p className="small mb-0">Customer order: <strong>{customerOrderNo}</strong></p>
                          )}
                        </div>
                      ) : bulkItems.length > 0 ? (
                        <div>
                          <i className="bi bi-files fs-1 text-primary mb-2"></i>
                          <p className="mb-0 fw-bold">{bulkItems.length} files selected</p>
                          <p className="text-muted small">Review matches below before importing</p>
                        </div>
                      ) : (
                        <div>
                          <i className="bi bi-cloud-arrow-up fs-1 text-primary mb-2"></i>
                          <p className="mb-0">Drag & drop file(s) here or click to browse</p>
                          <p className="text-muted small">Single or multiple .mrpg files supported</p>
                        </div>
                      )}
                    </div>
                    <input
                      id="fileUpload"
                      type="file"
                      accept=".mrpg"
                      multiple
                      onChange={handleFileChange}
                      disabled={uploading || previewing}
                      className="d-none"
                    />
                  </div>

                  {scheduleMatchInfo && (
                    <div className={`alert-modern ${scheduleMatchInfo.matched ? 'alert-modern-success' : 'alert-modern-warning'} mt-2`}>
                      <i className={`bi ${scheduleMatchInfo.matched ? 'bi-magic' : 'bi-info-circle'}`}></i>
                      <div>{scheduleMatchInfo.message}</div>
                    </div>
                  )}

                  {validationErrors.length > 0 && (
                    <div className="alert-modern alert-modern-danger mt-2">
                      <i className="bi bi-exclamation-triangle-fill"></i>
                      <div>
                        <strong>File Validation Errors:</strong>
                        <ul className="mb-0 mt-1">
                          {validationErrors.map((msg, index) => (
                            <li key={index}>{msg}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>

                {isBulkMode ? (
                  <div className="mb-4">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-2">
                      <h6 className="mb-0">Bulk Import Review</h6>
                      <span className="text-muted small">
                        {bulkItems.filter((i) => i.selected).length} selected ·{' '}
                        {bulkItems.filter((i) => i.matched).length} matched · {bulkItems.length} total
                      </span>
                    </div>

                    {duplicateGroups.length > 0 && (
                      <div className="alert-modern alert-modern-warning mb-3">
                        <i className="bi bi-layers"></i>
                        <div>
                          <strong>Duplicate orders detected</strong>
                          <p className="mb-2 small">
                            The same customer order appears in multiple files. We auto-selected the most complete file
                            (highest carton count). Partial downloads are unchecked — you can override below.
                          </p>
                          <ul className="mb-0 small">
                            {duplicateGroups.map((group) => (
                              <li key={group.order_no}>
                                Order <strong>{group.order_no}</strong>: {group.file_count} files → using{' '}
                                <strong>{group.recommended_file}</strong> ({group.recommended_cartons} cartons)
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="d-flex flex-wrap gap-2 mb-3">
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={selectRecommendedBulk} disabled={uploading}>
                        Select recommended only
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={selectAllBulk} disabled={uploading}>
                        Select all valid
                      </button>
                      {smartPickSummary?.auto_skipped_count > 0 && (
                        <span className="text-muted small align-self-center">
                          {smartPickSummary.auto_skipped_count} duplicate file(s) auto-skipped
                        </span>
                      )}
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm align-middle">
                        <thead>
                          <tr>
                            <th>
                              <input
                                type="checkbox"
                                checked={bulkItems.filter((i) => i.success !== false && !i.already_imported).every((i) => i.selected)}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setBulkItems((items) =>
                                    items.map((item) => ({
                                      ...item,
                                      selected: item.success !== false && !item.already_imported ? checked : false,
                                    }))
                                  );
                                }}
                              />
                            </th>
                            <th>File</th>
                            <th>Order No</th>
                            <th>Pick</th>
                            <th>Match</th>
                            <th>FTM Indent</th>
                            <th>Style</th>
                            <th>Color</th>
                            <th>Qty</th>
                            <th>Cartons</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bulkItems.map((item) => (
                            <tr key={item.id} className={bulkRowClass(item)}>
                              <td>
                                <input
                                  type="checkbox"
                                  checked={item.selected}
                                  disabled={item.success === false || item.status === 'success' || item.already_imported}
                                  onChange={(e) => updateBulkItem(item.id, 'selected', e.target.checked)}
                                />
                              </td>
                              <td className="small">
                                {item.file_name}
                                {item.pick_reason && (
                                  <div className="text-muted" style={{ fontSize: '0.75rem' }} title={item.pick_reason}>
                                    {item.pick_recommended ? item.pick_reason : item.pick_reason}
                                  </div>
                                )}
                              </td>
                              <td>{item.customer_order_no || '—'}</td>
                              <td>
                                {item.already_imported ? (
                                  <span className="badge bg-secondary">Imported</span>
                                ) : item.pick_recommended ? (
                                  <span className="badge bg-primary">Recommended</span>
                                ) : item.duplicate_group ? (
                                  <span className="badge bg-warning text-dark">Duplicate</span>
                                ) : (
                                  <span className="badge bg-light text-dark">OK</span>
                                )}
                              </td>
                              <td>
                                {item.success === false ? (
                                  <span className="badge bg-danger">Invalid</span>
                                ) : item.matched ? (
                                  <span className="badge bg-success">Matched</span>
                                ) : (
                                  <span className="badge bg-secondary">Unlinked OK</span>
                                )}
                              </td>
                              <td>
                                <div className="input-group input-group-sm">
                                  <span className="input-group-text">FTM-</span>
                                  <input
                                    className="form-control"
                                    value={item.indent_digits}
                                    disabled={item.status === 'success'}
                                    onChange={(e) => updateBulkItem(item.id, 'indent_digits', e.target.value.replace(/[^0-9]/g, ''))}
                                  />
                                </div>
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={item.style}
                                  disabled={item.status === 'success'}
                                  onChange={(e) => updateBulkItem(item.id, 'style', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={item.color}
                                  disabled={item.status === 'success'}
                                  onChange={(e) => updateBulkItem(item.id, 'color', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  className="form-control form-control-sm"
                                  value={item.quantity}
                                  disabled={item.status === 'success'}
                                  onChange={(e) => updateBulkItem(item.id, 'quantity', e.target.value)}
                                />
                              </td>
                              <td>{item.carton_count || '—'}</td>
                              <td className="small">
                                {item.status === 'importing' && 'Importing...'}
                                {item.status === 'success' && (
                                  <Link to={`/shipment/${item.shipmentId}`}>View</Link>
                                )}
                                {item.status === 'error' && <span className="text-danger">{item.error}</span>}
                                {item.status === 'pending' && item.message && <span className="text-danger">{item.message}</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <>
                    {singleMatched ? (
                      <>
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
                          {customerOrderNo && (
                            <div className="text-muted small mt-1">Customer order number in file: {customerOrderNo}</div>
                          )}
                        </div>

                        <div className="row g-3 mb-4">
                          <div className="col-md-4">
                            <label className="form-label-modern">
                              <i className="bi bi-palette me-1"></i>Style <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control-modern w-100"
                              list="import-style-suggestions"
                              value={style}
                              onChange={(e) => setStyle(e.target.value)}
                              onBlur={() => saveToHistory(styleHistoryKey, style, setStyleHistory)}
                              disabled={uploading}
                              placeholder="Enter style"
                              required
                            />
                            <datalist id="import-style-suggestions">
                              {styleHistory.map((s) => (
                                <option key={s} value={s} />
                              ))}
                            </datalist>
                          </div>
                          <div className="col-md-4">
                            <label className="form-label-modern">
                              <i className="bi bi-droplet me-1"></i>Color <span className="text-danger">*</span>
                            </label>
                            <input
                              type="text"
                              className="form-control-modern w-100"
                              list="import-color-suggestions"
                              value={color}
                              onChange={(e) => setColor(e.target.value)}
                              onBlur={() => saveToHistory(colorHistoryKey, color, setColorHistory)}
                              disabled={uploading}
                              placeholder="Enter color"
                              required
                            />
                            <datalist id="import-color-suggestions">
                              {colorHistory.map((c) => (
                                <option key={c} value={c} />
                              ))}
                            </datalist>
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
                      </>
                    ) : (
                      <div className="alert-modern alert-modern-info mb-4">
                        <i className="bi bi-clock-history"></i>
                        <div>
                          <strong>Import without schedule</strong>
                          <p className="mb-0 small mt-1">
                            Order <strong>{customerOrderNo || '—'}</strong> will be saved as{' '}
                            <code>PENDING-{customerOrderNo || '…'}</code>. Cartons import now; FTM indent, style, and color
                            link automatically when you upload the matching schedule.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {uploading && !isBulkMode && (
                  <div className="mb-4">
                    <div className="progress-modern mb-2">
                      <div className="progress-bar-modern" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                    <div className="text-center text-muted small">
                      <div className="loading-spinner-modern d-inline-block me-2"></div>
                      Processing XML data... {uploadProgress}%
                    </div>
                  </div>
                )}

                <div className="d-flex flex-column flex-md-row gap-2 justify-content-md-end">
                  <button type="button" className="btn-modern btn-modern-secondary" onClick={clearForm} disabled={uploading || previewing}>
                    <i className="bi bi-x-circle"></i> Clear
                  </button>
                  {!isBulkMode && singleMatched && (
                    <button
                      type="submit"
                      className="btn-modern btn-modern-primary"
                      disabled={!canSubmitSingle}
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
                  )}
                  {!isBulkMode && !singleMatched && (
                    <button
                      type="submit"
                      className="btn-modern btn-modern-primary"
                      disabled={!canSubmitUnlinked}
                    >
                      {uploading ? (
                        <>
                          <div className="loading-spinner-modern me-2"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-clock-history"></i> Import without schedule
                        </>
                      )}
                    </button>
                  )}
                  {isBulkMode && (
                    <button
                      type="submit"
                      className="btn-modern btn-modern-primary"
                      disabled={!canSubmitBulk}
                    >
                      {uploading ? (
                        <>
                          <div className="loading-spinner-modern me-2"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-upload"></i> Import Selected
                        </>
                      )}
                    </button>
                  )}
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
                {!uploadResult.bulk && (
                  <>
                    <div className="row g-3 mt-3">
                      <div className="col-md-6">
                        <div className="small text-muted">PO Number</div>
                        <div className="fw-medium">{uploadResult.poNumber}</div>
                      </div>
                      <div className="col-md-6">
                        <div className="small text-muted">Cartons Imported</div>
                        <div className="fw-medium">{uploadResult.cartonCount}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Style</div>
                        <div className="fw-medium">{uploadResult.style}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Color</div>
                        <div className="fw-medium">{uploadResult.color}</div>
                      </div>
                      <div className="col-md-4">
                        <div className="small text-muted">Quantity</div>
                        <div className="fw-medium">{uploadResult.quantity}</div>
                      </div>
                    </div>
                    <div className="d-flex justify-content-end mt-3">
                      <Link to={`/shipment/${uploadResult.shipmentId}`} className="btn-modern btn-modern-success">
                        <i className="bi bi-eye"></i> View Shipment Details
                      </Link>
                    </div>
                  </>
                )}
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
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>1</div>
                </div>
                <div>
                  <p className="mb-0"><strong>Load Weekly Schedule</strong></p>
                  <p className="text-muted small">Schedules stay in the library — uploads match against all stored weeks</p>
                </div>
              </div>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>2</div>
                </div>
                <div>
                  <p className="mb-0"><strong>Select .mrpg File(s)</strong></p>
                  <p className="text-muted small">Matched orders auto-fill; unmatched orders can import now and link when schedule arrives</p>
                </div>
              </div>
              <div className="d-flex mb-3">
                <div className="me-3">
                  <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: '30px', height: '30px' }}>3</div>
                </div>
                <div>
                  <p className="mb-0"><strong>Review & Import</strong></p>
                  <p className="text-muted small">Duplicate orders are auto-resolved — the file with the most cartons is selected</p>
                </div>
              </div>
              <div className="alert-modern alert-modern-info mt-3">
                <i className="bi bi-lightbulb"></i>
                <div>
                  <strong>Smart pick:</strong> If the same order appears in multiple files (e.g. 20 + 10 + 100 cartons),
                  only the most complete file is selected. Failed imports in a batch are skipped — good files still upload.
                </div>
              </div>
              <div className="alert-modern alert-modern-info mt-3">
                <i className="bi bi-link-45deg"></i>
                <div>
                  <strong>Match key:</strong> <em>ORDER NO</em> (schedule) = <em>PoNumber</em> (in the .mrpg file).
                  FTM indent is built as FTM-{'{indent number}'} from the schedule.
                </div>
              </div>
            </div>
          </div>

          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-file-earmark-code me-2"></i>XML Format</h5>
            </div>
            <div className="modern-card-body">
              <p className="small">Each carton includes the customer order number:</p>
              <div className="bg-light p-2 rounded" style={{ fontSize: '0.8rem' }}>
                <pre className="mb-0" style={{ whiteSpace: 'pre-wrap' }}>{`<Panda>
  <PoNumber>1240909</PoNumber>
  <BarCode2D>...</BarCode2D>
  <Size>...</Size>
</Panda>`}</pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
