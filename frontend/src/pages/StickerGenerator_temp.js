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
