import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Container, Row, Col, Card, Badge, Button, Alert, Spinner, 
  ProgressBar, Dropdown, Modal, Form, Table, Tab, Tabs,
  OverlayTrigger, Tooltip 
} from 'react-bootstrap';
import { Line, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend
} from 'chart.js';
import { useApi } from '../hooks/useApi';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { isOtbCustomer, formatInternalPoDisplay, formatCustomerPoForDisplay, formatCartonDateTime, getCartonEntryTime, getCartonExitTime, canDirectShipOrder } from '../utils/poDisplay';
import { formatCartonStatus } from '../utils/formatters';
import {
  WAREHOUSE_ORDER_STATUS_OPTIONS,
  getWarehouseOrderStatusBadge,
  getWarehouseOrderStatusLabel
} from '../utils/warehouseOrderStatuses';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

/**
 * Enhanced PO Details Page Component
 * 
 * Comprehensive analytics and management for individual Purchase Orders
 */
const PODetails = React.memo(() => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { withAdminAuth } = useAdminAuth();
  
  // State management
  const [activeTab, setActiveTab] = useState('overview');
  const [timeRange, setTimeRange] = useState('7days');
  const [showExportModal, setShowExportModal] = useState(false);
  const [showCartonModal, setShowCartonModal] = useState(false);
  const [selectedCarton, setSelectedCarton] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [filters, setFilters] = useState({
    status: '',
    size: '',
    qcStatus: '',
    finishingStatus: ''
  });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCartonIds, setSelectedCartonIds] = useState([]);
  
  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analyticsRefreshKey, setAnalyticsRefreshKey] = useState(0);
  const [cartonRefreshKey, setCartonRefreshKey] = useState(0);
  
  // Bulk operation state
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, action: '' });
  const [warehouseOrderStatus, setWarehouseOrderStatus] = useState('active');
  const [savingWhStatus, setSavingWhStatus] = useState(false);

  // Memoize API URLs to prevent unnecessary re-renders
  const analyticsUrl = useMemo(() => 
    `po_analytics.php?id=${id}&timeRange=${timeRange}&_key=${analyticsRefreshKey}`, 
    [id, timeRange, analyticsRefreshKey]
  );
  
  const cartonUrl = useMemo(() => 
    `shipments.php?id=${id}&cartons=true&${new URLSearchParams(filters)}&_key=${cartonRefreshKey}`, 
    [id, filters, cartonRefreshKey]
  );
  
  const timelineUrl = useMemo(() => 
    `po_timeline.php?id=${id}`, 
    [id]
  );

  // Auto-remove notifications after 5 seconds
  useEffect(() => {
    if (notifications.length > 0) {
      const timers = notifications.map(notification => {
        // Only auto-remove success and info notifications, keep errors and warnings visible
        if (notification.type === 'success' || notification.type === 'info') {
          return setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== notification.id));
          }, 5000); // 5 seconds
        }
        return null;
      }).filter(timer => timer !== null);

      return () => {
        timers.forEach(timer => clearTimeout(timer));
      };
    }
  }, [notifications]);

  // API calls with optimized dependencies
  const { data: poData, loading, error, refetch: refetchAnalytics } = useApi(analyticsUrl, { 
    debounceMs: 200 // Debounce rapid changes
  });
  const shipment = poData?.shipment;
  const canDirectShip = canDirectShipOrder(shipment);

  useEffect(() => {
    const s = poData?.shipment;
    if (s) {
      setWarehouseOrderStatus(s.warehouse_order_status || 'active');
    }
  }, [poData?.shipment]);

  const handleWarehouseOrderStatusChange = async (e) => {
    const next = e.target.value;
    setSavingWhStatus(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/update_shipment_warehouse_status.php`, {
        shipment_id: id,
        warehouse_order_status: next
      });
      if (res.data?.success) {
        setWarehouseOrderStatus(next);
        await refetchAnalytics();
        setNotifications((prev) => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `Order status set to ${getWarehouseOrderStatusLabel(next)}`,
          timestamp: new Date()
        }]);
      }
    } catch (err) {
      setNotifications((prev) => [...prev, {
        id: Date.now(),
        type: 'error',
        message: err.response?.data?.message || 'Failed to update order status',
        timestamp: new Date()
      }]);
    } finally {
      setSavingWhStatus(false);
    }
  };

  const { data: cartonData, loading: cartonLoading, refetch: refetchCartons } = useApi(cartonUrl, { 
    debounceMs: 300 // Longer debounce for filter changes
  });
  const { data: timelineData, refetch: refetchTimeline } = useApi(timelineUrl);

  // Selective refresh functions
  const refreshCartonData = useCallback(async () => {
    try {
      console.log('🔄 Refreshing carton data only...');
      
      // Import apiService to clear cache
      const { default: apiService } = await import('../services/apiService');
      
      // Clear cache for carton-related endpoints
      apiService.clearCache();
      
      // Force refresh by incrementing the carton refresh key
      setCartonRefreshKey(prev => prev + 1);
      
      // Small delay to allow the new request to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ Carton data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing carton data:', error);
    }
  }, []);

  const refreshAnalyticsData = useCallback(async () => {
    try {
      console.log('🔄 Refreshing analytics data...');
      
      // Import apiService to clear cache
      const { default: apiService } = await import('../services/apiService');
      
      // Clear cache
      apiService.clearCache();
      
      // Force refresh by incrementing the analytics refresh key
      setAnalyticsRefreshKey(prev => prev + 1);
      
      // Small delay to allow the new request to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('✅ Analytics data refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing analytics data:', error);
    }
  }, []);

  // Combined function for bulk operations (only refresh cartons and analytics)
  const refreshTableAndStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      console.log('🔄 Refreshing table and stats only...');
      
      // Refresh both cartons and analytics data simultaneously
      await Promise.all([
        refreshCartonData(),
        refreshAnalyticsData()
      ]);
      
      console.log('✅ Table and stats refreshed successfully');
    } catch (error) {
      console.error('❌ Error refreshing table and stats:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshCartonData, refreshAnalyticsData]);

  // Memoized calculations
  const stats = useMemo(() => {
    if (!poData?.analytics) return null;
    
    const analytics = poData.analytics;
    const completionRate = analytics.total_cartons > 0 
      ? ((analytics.shipped_cartons / analytics.total_cartons) * 100).toFixed(1)
      : 0;
      
    const processingEfficiency = analytics.avg_processing_time > 0
      ? Math.max(0, 100 - (analytics.avg_processing_time / 24) * 10).toFixed(1)
      : 100;
      
    const dataCompleteness = analytics.total_cartons > 0
      ? (((analytics.total_cartons - analytics.missing_qc - analytics.missing_finishing) / analytics.total_cartons) * 100).toFixed(1)
      : 100;

    return {
      completionRate: parseFloat(completionRate),
      processingEfficiency: parseFloat(processingEfficiency),
      qualityScore: parseFloat(dataCompleteness), // Keeping qualityScore as property name for backward compatibility
      ...analytics
    };
  }, [poData]);

  // Chart data configurations
  const statusChartData = useMemo(() => {
    if (!stats) return null;
    
    return {
      labels: ['Pending', 'In Warehouse', 'Shipped'],
      datasets: [{
        label: 'Cartons',
        data: [stats.pending_cartons, stats.warehouse_cartons, stats.shipped_cartons],
        backgroundColor: ['#ffc107', '#17a2b8', '#28a745'],
        borderColor: ['#e0a800', '#138496', '#1e7e34'],
        borderWidth: 2
      }]
    };
  }, [stats]);

  const timelineChartData = useMemo(() => {
    if (!timelineData?.timeline || timelineData.timeline.length === 0) {
      // Return sample data if no timeline data is available
      const today = new Date();
      const sampleDates = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        sampleDates.push({
          date: date.toLocaleDateString(),
          entered: 0,
          shipped: 0
        });
      }
      
      return {
        labels: sampleDates.map(item => item.date),
        datasets: [
          {
            label: 'Cartons Entered',
            data: sampleDates.map(item => item.entered),
            borderColor: '#17a2b8',
            backgroundColor: 'rgba(23, 162, 184, 0.1)',
            tension: 0.4
          },
          {
            label: 'Cartons Shipped',
            data: sampleDates.map(item => item.shipped),
            borderColor: '#28a745',
            backgroundColor: 'rgba(40, 167, 69, 0.1)',
            tension: 0.4
          }
        ]
      };
    }
    
    const timeline = timelineData.timeline;
    return {
      labels: timeline.map(item => new Date(item.date).toLocaleDateString()),
      datasets: [
        {
          label: 'Cartons Entered',
          data: timeline.map(item => item.entered || 0),
          borderColor: '#17a2b8',
          backgroundColor: 'rgba(23, 162, 184, 0.1)',
          tension: 0.4
        },
        {
          label: 'Cartons Shipped',
          data: timeline.map(item => item.shipped || 0),
          borderColor: '#28a745',
          backgroundColor: 'rgba(40, 167, 69, 0.1)',
          tension: 0.4
        }
      ]
    };
  }, [timelineData]);

  // Event handlers
  const handleExport = useCallback((format) => {
    const exportUrl = `${API_BASE_URL}/shipments.php?id=${id}&export=${format}`;
    if (format === 'pdf') {
      window.open(exportUrl, '_blank', 'noopener,noreferrer');
    } else {
      window.location.href = exportUrl;
    }
    setShowExportModal(false);
  }, [id]);



  const refreshData = useCallback(async () => {
    await refreshTableAndStats();
    setNotifications(prev => [...prev, {
      id: Date.now(),
      type: 'info',
      message: '🔄 Data refreshed successfully',
      timestamp: new Date()
    }]);
  }, [refreshTableAndStats]);

  // Carton action handlers
  const handleViewCarton = useCallback((carton) => {
    // Pre-process carton data for faster modal rendering
    const processedCarton = {
      ...carton,
      formattedEntryTime: formatCartonDateTime(getCartonEntryTime(carton)),
      formattedExitTime: formatCartonDateTime(getCartonExitTime(carton)),
      formattedCreatedAt: carton.created_at ? new Date(carton.created_at).toLocaleString() : '—',
      formattedUpdatedAt: carton.updated_at ? new Date(carton.updated_at).toLocaleString() : '—'
    };
    setSelectedCarton(processedCarton);
    setShowCartonModal(true);
  }, []);

  const handleEditCarton = useCallback(async (carton) => {
    try {
      await withAdminAuth('edit carton', async () => {
        navigate(`/scanner?barcode=${encodeURIComponent(carton.barcode_2d)}&action=edit`);
      });
    } catch (_) {
      /* cancelled */
    }
  }, [navigate, withAdminAuth]);

  const openExitScannerForPo = useCallback(() => {
    const po = shipment?.internal_po_number;
    if (!po) {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Cannot open exit scanner because this PO number is missing.',
        timestamp: new Date()
      }]);
      return;
    }

    navigate(`/scanner?po=${encodeURIComponent(po)}&action=exit`);
  }, [navigate, shipment?.internal_po_number]);

  const [showShipModal, setShowShipModal] = useState(false);
  const [cartonToShip, setCartonToShip] = useState(null);
  const [cartonsToShipBulk, setCartonsToShipBulk] = useState(null);
  const [shipFormData, setShipFormData] = useState({
    truck_reg: '',
    driver_name: ''
  });
  const [shippingSubmitting, setShippingSubmitting] = useState(false);

  const closeShipModal = useCallback(() => {
    setShowShipModal(false);
    setCartonToShip(null);
    setCartonsToShipBulk(null);
    setShipFormData({ truck_reg: '', driver_name: '' });
    setShippingSubmitting(false);
  }, []);

  const shipModalCartonCount = cartonsToShipBulk?.length || (cartonToShip ? 1 : 0);

  const openManualShipModal = useCallback((cartons) => {
    const cartonList = Array.isArray(cartons) ? cartons : [cartons];
    const validCartons = cartonList.filter((carton) => carton?.status === 'entered');

    if (validCartons.length === 0) {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'warning',
        message: 'No selected cartons are in warehouse (entered) status.',
        timestamp: new Date()
      }]);
      return;
    }

    setCartonToShip(validCartons.length === 1 ? validCartons[0] : null);
    setCartonsToShipBulk(validCartons.length > 1 ? validCartons : null);
    setShipFormData({ truck_reg: '', driver_name: '' });
    setShowShipModal(true);
  }, []);

  const handleMarkAsShipped = useCallback((carton) => {
    // Check if carton is in warehouse before allowing shipping
    if (carton.status !== 'entered') {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: '❌ Only cartons in warehouse (entered status) can be shipped. This carton is currently: ' + carton.status,
        timestamp: new Date()
      }]);
      return;
    }
    
    if (canDirectShip) {
      openManualShipModal(carton);
    } else {
      openExitScannerForPo();
    }
  }, [canDirectShip, openExitScannerForPo, openManualShipModal]);

  const handleShipModalSubmit = useCallback(async () => {
    const truckReg = shipFormData.truck_reg.trim();
    const driverName = shipFormData.driver_name.trim();

    if (!truckReg || !driverName) {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Please enter both truck registration and driver name.',
        timestamp: new Date()
      }]);
      return;
    }

    setShippingSubmitting(true);
    try {
      if (cartonToShip) {
        await axios.post(`${API_BASE_URL}/update_carton_status.php`, {
          carton_id: cartonToShip.id,
          status: 'exited',
          truck_reg: truckReg,
          driver_name: driverName
        }, {
          timeout: 5000
        });
      }

      if (cartonsToShipBulk?.length > 0) {
        const updates = cartonsToShipBulk.map(carton => ({
          carton_id: carton.id,
          status: 'exited',
          truck_reg: truckReg,
          driver_name: driverName
        }));

        await axios.post(`${API_BASE_URL}/bulk_update_carton_status.php`, {
          updates
        }, {
          timeout: 30000
        });

        setSelectedCartonIds([]);
      }

      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: cartonsToShipBulk?.length > 0
          ? `Successfully marked ${cartonsToShipBulk.length} cartons as shipped.`
          : `Carton ${cartonToShip?.barcode_2d || ''} marked as shipped.`,
        timestamp: new Date()
      }]);

      setShowShipModal(false);
      setCartonToShip(null);
      setCartonsToShipBulk(null);
      setShipFormData({ truck_reg: '', driver_name: '' });
      await refreshTableAndStats();
    } catch (error) {
      console.error('Error updating carton status:', error);
      const errorMessage = error.code === 'ECONNABORTED'
        ? 'Request timed out. Please try again.'
        : (error.response?.data?.error || error.response?.data?.message || 'Failed to update carton status');

      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      setShippingSubmitting(false);
    }
  }, [cartonToShip, cartonsToShipBulk, shipFormData, refreshTableAndStats]);

  const printCartonLabel = useCallback((carton) => {
    // Create a print window with enhanced carton label including barcode and QR code
    const printWindow = window.open('', '_blank');
    const labelContent = `
      <html>
        <head>
          <title>Carton Label - ${carton.barcode_2d}</title>
          <style>
            body { 
              font-family: Arial, sans-serif; 
              padding: 20px; 
              margin: 0;
              background: white;
            }
            .label { 
              border: 3px solid #000; 
              padding: 25px; 
              width: 500px; 
              margin: 0 auto;
              background: white;
              page-break-inside: avoid;
            }
            .header { 
              text-align: center; 
              margin: 0 0 25px 0; 
              font-size: 20px;
              font-weight: bold;
              text-transform: uppercase;
            }
            .barcode-section {
              text-align: center;
              margin: 20px 0;
              padding: 15px;
              border: 1px solid #ccc;
              background: #f9f9f9;
            }
            .barcode-text { 
              font-size: 28px; 
              font-weight: bold; 
              font-family: 'Courier New', monospace;
              margin: 10px 0;
              letter-spacing: 2px;
            }
            .qr-code {
              margin: 15px 0;
            }
            .details { 
              margin: 12px 0; 
              font-size: 14px;
              display: flex;
              justify-content: space-between;
            }
            .details strong { 
              font-weight: bold;
              min-width: 120px;
            }
            .details span {
              flex: 1;
              text-align: right;
            }
            .divider {
              border-top: 1px solid #ddd;
              margin: 15px 0;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              .label { width: 100%; max-width: 500px; }
            }
          </style>
          <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
        </head>
        <body>
          <div class="label">
            <div class="header">Carton Label</div>
            
            <div class="barcode-section">
              <div class="barcode-text">${carton.barcode_2d}</div>
              <div class="qr-code">
                <canvas id="qrcode" width="120" height="120" style="margin: 0 auto; display: block;"></canvas>
              </div>
            </div>
            
            <div class="divider"></div>
            
            <div class="details">
              <strong>PO Number:</strong>
              <span>${carton.po_number}</span>
            </div>
            <div class="details">
              <strong>Size:</strong>
              <span>${carton.size}</span>
            </div>
            <div class="details">
              <strong>Units:</strong>
              <span>${carton.units}</span>
            </div>
            <div class="details">
              <strong>Item:</strong>
              <span>${carton.item}</span>
            </div>
            <div class="details">
              <strong>Status:</strong>
              <span>${carton.status.toUpperCase()}</span>
            </div>
            <div class="details">
              <strong>Customer:</strong>
              <span>${carton.division}</span>
            </div>
            <div class="details">
              <strong>Print Date:</strong>
              <span>${new Date().toLocaleDateString()}</span>
            </div>
          </div>
          
          <script>
            // Generate QR code
            const canvas = document.getElementById('qrcode');
            if (typeof QRCode !== 'undefined') {
              QRCode.toCanvas(canvas, '${carton.barcode_2d}', {
                width: 120,
                height: 120,
                margin: 1
              }, function (error) {
                if (error) console.error(error);
                // Auto print after QR code is generated
                setTimeout(() => window.print(), 500);
              });
            } else {
              // Fallback if QRCode library doesn't load
              setTimeout(() => window.print(), 500);
            }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(labelContent);
    printWindow.document.close();
  }, []);

  const handlePrintLabel = useCallback(async (carton) => {
    try {
      await withAdminAuth('print label', async () => {
        printCartonLabel(carton);
      });
    } catch (_) {
      /* cancelled */
    }
  }, [withAdminAuth, printCartonLabel]);

  const handleCopyBarcode = useCallback((barcode) => {
    navigator.clipboard.writeText(barcode).then(() => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'info',
        message: `Barcode ${barcode} copied to clipboard`,
        timestamp: new Date()
      }]);
    }).catch(() => {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: 'Failed to copy barcode',
        timestamp: new Date()
      }]);
    });
  }, []);

  // Filter and search cartons
  const filteredCartons = useMemo(() => {
    if (!cartonData?.cartons) return [];
    
    let filtered = cartonData.cartons;
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(carton => 
        carton.barcode_2d?.toLowerCase().includes(search) ||
        carton.size?.toLowerCase().includes(search) ||
        carton.po_number?.toLowerCase().includes(search) ||
        carton.item?.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  }, [cartonData, searchTerm]);

  const shippableFiltered = useMemo(
    () => filteredCartons.filter((c) => c.status === 'entered'),
    [filteredCartons]
  );

  // Paginate filtered cartons
  const paginatedCartons = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCartons.slice(startIndex, endIndex);
  }, [filteredCartons, currentPage, itemsPerPage]);

  const shippableOnPage = useMemo(
    () => paginatedCartons.filter((c) => c.status === 'entered'),
    [paginatedCartons]
  );

  const allPageSelected =
    shippableOnPage.length > 0 &&
    shippableOnPage.every((c) => selectedCartonIds.includes(c.id));

  const toggleCartonSelection = useCallback((cartonId) => {
    setSelectedCartonIds((prev) =>
      prev.includes(cartonId) ? prev.filter((id) => id !== cartonId) : [...prev, cartonId]
    );
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    const pageIds = shippableOnPage.map((c) => c.id);
    if (allPageSelected) {
      setSelectedCartonIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedCartonIds((prev) => [...new Set([...prev, ...pageIds])]);
    }
  }, [shippableOnPage, allPageSelected]);

  const toggleSelectAllShippable = useCallback(() => {
    const allIds = shippableFiltered.map((c) => c.id);
    const allSelected =
      allIds.length > 0 && allIds.every((id) => selectedCartonIds.includes(id));
    if (allSelected) {
      setSelectedCartonIds((prev) => prev.filter((id) => !allIds.includes(id)));
    } else {
      setSelectedCartonIds(allIds);
    }
  }, [shippableFiltered, selectedCartonIds]);

  // Pagination info
  const paginationInfo = useMemo(() => {
    const totalItems = filteredCartons.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startItem = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);
    
    return {
      totalItems,
      totalPages,
      startItem,
      endItem,
      currentPage
    };
  }, [filteredCartons.length, currentPage, itemsPerPage]);

  // Analyze carton statuses to determine available bulk actions (use all cartons, not just paginated)
  const bulkActionAnalysis = useMemo(() => {
    if (!cartonData?.cartons) return null;
    
    const cartons = cartonData.cartons;
    const statusCounts = {
      pending: cartons.filter(c => c.status === 'pending').length,
      entered: cartons.filter(c => c.status === 'entered').length,
      exited: cartons.filter(c => c.status === 'exited').length
    };
    
    const total = cartons.length;
    const canEnterWarehouse = statusCounts.pending > 0;
    const canExitWarehouse = statusCounts.entered > 0;
    
    return {
      statusCounts,
      total,
      canEnterWarehouse,
      canExitWarehouse,
      primaryAction: canEnterWarehouse ? 'enter' : canExitWarehouse ? 'exit' : null,
      pendingCartons: cartons.filter(c => c.status === 'pending'),
      warehouseCartons: cartons.filter(c => c.status === 'entered')
    };
  }, [cartonData]);

  // Reset to first page when filters change
  const handleFilterChange = useCallback((filterName, value) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
    setCurrentPage(1);
  }, []);

  // Reset to first page when search changes
  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  // Helper function to process cartons in bulk (single API call)
  const processBulkUpdate = useCallback(async (cartons, status, actionName) => {
    const totalCartons = cartons.length;
    
    // Set bulk processing state
    setIsBulkProcessing(true);
    setBulkProgress({ current: 0, total: totalCartons, action: actionName });
    
    // Show initial notification
    setNotifications(prev => [...prev, {
      id: Date.now(),
      type: 'info',
      message: `🔄 Processing ${totalCartons} cartons for ${actionName}...`,
      timestamp: new Date()
    }]);
    
    try {
      // Prepare bulk update data
      const updates = cartons.map(carton => ({
        carton_id: carton.id,
        status: status
      }));
      
      // Make single bulk API call
      const response = await axios.post(`${API_BASE_URL}/bulk_update_carton_status.php`, {
        updates: updates
      }, {
        timeout: 30000 // 30 second timeout for bulk operations
      });
      
      const result = response.data;
      
      // Show result notification
      if (result.success) {
        if (result.error_count === 0) {
          setNotifications(prev => [...prev, {
            id: Date.now(),
            type: 'success',
            message: `✅ Successfully ${actionName.toLowerCase()}: ${result.success_count} cartons`,
            timestamp: new Date()
          }]);
        } else {
          setNotifications(prev => [...prev, {
            id: Date.now(),
            type: 'warning',
            message: `⚠️ ${actionName} completed: ${result.success_count} successful, ${result.error_count} failed`,
            timestamp: new Date()
          }]);
        }
        
        // Immediately update local carton data to reflect changes
        // This provides instant visual feedback before the API refresh
        if (cartonData?.cartons && result.updated_cartons) {
          console.log('🔄 Updating local carton data immediately...');
          
          // This is a temporary local update for immediate UI feedback
          // The actual refresh will happen after this
        }
      } else {
        throw new Error(result.message || 'Bulk update failed');
      }
      
      // Update progress to show completion
      setBulkProgress(prev => ({ ...prev, current: prev.total }));
      
      console.log('🔄 Bulk operation completed, refreshing table and stats...');
      
      // Refresh only table and stats data (not timeline)
      await refreshTableAndStats();
      
      console.log('✅ Table and stats refresh completed');
      
    } catch (error) {
      console.error('Error in bulk update process:', error);
      
      // If bulk API fails and we have a small number of cartons, try individual updates
      if (totalCartons <= 10 && error.response?.status !== 400) {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'info',
          message: `🔄 Bulk API failed, trying individual updates for ${totalCartons} cartons...`,
          timestamp: new Date()
        }]);
        
        try {
          let successCount = 0;
          let errorCount = 0;
          
          for (const carton of cartons) {
            try {
              await axios.post(`${API_BASE_URL}/update_carton_status.php`, {
                carton_id: carton.id,
                status: status
              }, {
                timeout: 5000
              });
              successCount++;
            } catch (individualError) {
              console.error(`Failed to update carton ${carton.id}:`, individualError);
              errorCount++;
            }
            
            // Small delay between individual requests
            await new Promise(resolve => setTimeout(resolve, 200));
          }
          
          // Show fallback result
          if (errorCount === 0) {
            setNotifications(prev => [...prev, {
              id: Date.now(),
              type: 'success',
              message: `✅ Successfully ${actionName.toLowerCase()}: ${successCount} cartons (via fallback)`,
              timestamp: new Date()
            }]);
          } else {
            setNotifications(prev => [...prev, {
              id: Date.now(),
              type: 'warning',
              message: `⚠️ ${actionName} completed via fallback: ${successCount} successful, ${errorCount} failed`,
              timestamp: new Date()
            }]);
          }
          
          await refreshTableAndStats();
          
          return;
          
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
        }
      }
      
      // Show original error if fallback not attempted or also failed
      let errorMessage = `❌ Bulk ${actionName.toLowerCase()} failed`;
      if (error.code === 'ECONNABORTED') {
        errorMessage += ': Request timed out. Please try with fewer cartons.';
      } else if (error.response?.data?.message) {
        errorMessage += `: ${error.response.data.message}`;
      } else {
        errorMessage += `: ${error.message}`;
      }
      
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: errorMessage,
        timestamp: new Date()
      }]);
    } finally {
      // Reset bulk processing state
      setIsBulkProcessing(false);
      setBulkProgress({ current: 0, total: 0, action: '' });
    }
  }, [refreshTableAndStats]);

  // Bulk status update handlers
  const handleBulkEnterWarehouse = useCallback(async () => {
    if (!bulkActionAnalysis?.pendingCartons.length) return;
    await processBulkUpdate(bulkActionAnalysis.pendingCartons, 'entered', 'Enter Warehouse');
  }, [bulkActionAnalysis, processBulkUpdate]);

  const handleBulkExitWarehouse = useCallback(async () => {
    if (!bulkActionAnalysis?.warehouseCartons.length) return;
    if (canDirectShip) {
      openManualShipModal(bulkActionAnalysis.warehouseCartons);
    } else {
      openExitScannerForPo();
    }
  }, [bulkActionAnalysis, canDirectShip, openExitScannerForPo, openManualShipModal]);

  const handleBulkShipSelected = useCallback(async () => {
    if (!cartonData?.cartons || selectedCartonIds.length === 0) return;
    const toShip = cartonData.cartons.filter(
      (c) => selectedCartonIds.includes(c.id) && c.status === 'entered'
    );
    if (toShip.length === 0) {
      setNotifications((prev) => [
        ...prev,
        {
          id: Date.now(),
          type: 'warning',
          message: 'No selected cartons are in warehouse (entered) status.',
          timestamp: new Date()
        }
      ]);
      return;
    }
    if (canDirectShip) {
      openManualShipModal(toShip);
    } else {
      openExitScannerForPo();
    }
  }, [cartonData, selectedCartonIds, canDirectShip, openExitScannerForPo, openManualShipModal]);

  const handleBulkPrintLabels = useCallback(async () => {
    if (!cartonData?.cartons) return;
    
    const cartonsToProcess = cartonData.cartons.filter(carton => carton.status !== 'exited');
    
    if (cartonsToProcess.length === 0) {
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'info',
        message: 'No cartons available for printing (all shipped)',
        timestamp: new Date()
      }]);
      return;
    }

    try {
      await withAdminAuth('print labels', async () => {
        cartonsToProcess.forEach((carton, index) => {
          setTimeout(() => printCartonLabel(carton), index * 1000);
        });
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: `Printing ${cartonsToProcess.length} labels...`,
          timestamp: new Date()
        }]);
      });
    } catch (_) {
      /* cancelled */
    }
  }, [cartonData, withAdminAuth, printCartonLabel]);

  // Loading state
  if (loading) {
    return (
      <Container className="py-4">
        <div className="text-center py-5">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted">Loading PO analytics...</p>
        </div>
      </Container>
    );
  }

  // Error state
  if (error) {
    return (
      <Container className="py-4">
        <Alert variant="danger" className="d-flex align-items-center">
          <i className="bi bi-exclamation-triangle-fill me-2"></i>
          <div>
            <strong>Error:</strong> {error}
            <div className="mt-2">
              <Button variant="outline-danger" size="sm" onClick={refreshData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Retry
              </Button>
            </div>
          </div>
        </Alert>
      </Container>
    );
  }

  const hideSizeColumn = isOtbCustomer(shipment?.customer);
  
  return (
    <Container fluid className="py-3">
      {/* Notifications */}
      {notifications.length > 0 && (
        <Row className="mb-3">
          <Col>
            {notifications.slice(-3).map(notification => (
              <Alert 
                key={notification.id}
                variant={notification.type === 'error' ? 'danger' : notification.type}
                dismissible
                onClose={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
                className="mb-2"
              >
                <div className="d-flex align-items-center">
                  <i className={`bi ${
                    notification.type === 'success' ? 'bi-check-circle-fill' :
                    notification.type === 'error' ? 'bi-exclamation-triangle-fill' :
                    'bi-info-circle-fill'
                  } me-2`}></i>
                  {notification.message}
                  <small className="ms-auto text-muted">
                    {notification.timestamp.toLocaleTimeString()}
                  </small>
                </div>
              </Alert>
            ))}
          </Col>
        </Row>
      )}

      {/* Header Section */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <button className="btn btn-sm btn-outline-secondary mb-2" onClick={() => navigate(-1)}>
                <i className="bi bi-arrow-left me-1"></i> Back
              </button>
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb">
                  <li className="breadcrumb-item">
                    <Link to="/dashboard" className="text-decoration-none">Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="/reports" className="text-decoration-none">Reports</Link>
                  </li>
                  <li className="breadcrumb-item active">PO Details</li>
                </ol>
              </nav>
              <h1 className="display-6 mb-2">
                <i className="bi bi-box-seam me-2 text-primary"></i>
                {formatInternalPoDisplay(shipment?.customer, shipment?.internal_po_number) || `PO #${id}`}
              </h1>
              <div className="d-flex align-items-center flex-wrap gap-3">
                <Badge bg={getWarehouseOrderStatusBadge(warehouseOrderStatus)} className="fs-6">
                  {getWarehouseOrderStatusLabel(warehouseOrderStatus)}
                </Badge>
                <Form.Select
                  size="sm"
                  className="w-auto"
                  value={warehouseOrderStatus}
                  onChange={handleWarehouseOrderStatusChange}
                  disabled={savingWhStatus}
                  aria-label="Warehouse order status"
                >
                  {Object.entries(WAREHOUSE_ORDER_STATUS_OPTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Form.Select>
                <Badge bg={stats?.completionRate >= 80 ? 'success' : stats?.completionRate >= 50 ? 'warning' : 'danger'} className="fs-6">
                  {stats?.completionRate}% cartons shipped
                </Badge>
                <span className="text-muted">
                  <i className="bi bi-calendar3 me-1"></i>
                  Import Date: {shipment?.import_date ? new Date(shipment.import_date).toLocaleDateString() : 'N/A'}
                </span>
              </div>
            </div>
            
            <div className="d-flex gap-2">
              <Dropdown>
                <Dropdown.Toggle variant="outline-secondary" size="sm">
                  <i className="bi bi-clock-history me-1"></i> {timeRange.replace('days', ' Days')}
                </Dropdown.Toggle>
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => setTimeRange('1day')}>Last 24 Hours</Dropdown.Item>
                  <Dropdown.Item onClick={() => setTimeRange('7days')}>Last 7 Days</Dropdown.Item>
                  <Dropdown.Item onClick={() => setTimeRange('30days')}>Last 30 Days</Dropdown.Item>
                  <Dropdown.Item onClick={() => setTimeRange('all')}>All Time</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
              
              <Button variant="outline-primary" size="sm" onClick={() => setShowExportModal(true)}>
                <i className="bi bi-download me-1"></i> Export
              </Button>
              
              <Button variant="primary" size="sm" onClick={refreshData}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </Button>
            </div>
          </div>
        </Col>
      </Row>

      {/* Key Metrics Cards */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-primary bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-boxes text-primary fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.total_cartons || 0}</h3>
              <p className="text-muted mb-2 small">Total Cartons</p>
              <ProgressBar 
                variant="primary" 
                now={100} 
                style={{ height: '4px' }}
              />
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-secondary bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-box-seam text-secondary fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.total_units?.toLocaleString() || 0}</h3>
              <p className="text-muted mb-2 small">Total Units</p>
              <ProgressBar 
                variant="secondary" 
                now={100} 
                style={{ height: '4px' }}
              />
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-success bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-check-circle text-success fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.completionRate || 0}%</h3>
              <p className="text-muted mb-2 small">Completion Rate</p>
              <ProgressBar 
                variant={stats?.completionRate >= 80 ? 'success' : stats?.completionRate >= 50 ? 'warning' : 'danger'}
                now={stats?.completionRate || 0}
                style={{ height: '4px' }}
              />
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-info bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-speedometer2 text-info fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.processingEfficiency || 0}%</h3>
              <p className="text-muted mb-2 small">
                Processing Efficiency
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Measures carton processing speed - higher scores indicate faster processing times</Tooltip>}
                >
                  <i className="bi bi-info-circle-fill ms-1 small text-muted"></i>
                </OverlayTrigger>
              </p>
              <ProgressBar 
                variant="info" 
                now={stats?.processingEfficiency || 0}
                style={{ height: '4px' }}
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Unit Tracking Cards */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #f59e0b' }}>
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-building text-warning fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1 text-warning">{stats?.factory_units?.toLocaleString() || 0}</h3>
              <p className="text-muted mb-2 small">Units in Factory</p>
              <small className="text-muted">Currently in warehouse</small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #10b981' }}>
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-success bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-truck text-success fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1 text-success">{stats?.shipped_units?.toLocaleString() || 0}</h3>
              <p className="text-muted mb-2 small">Units Shipped</p>
              <small className="text-muted">Successfully delivered</small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #6b7280' }}>
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-secondary bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-clock text-secondary fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1 text-secondary">{stats?.pending_units?.toLocaleString() || 0}</h3>
              <p className="text-muted mb-2 small">Units Pending</p>
              <small className="text-muted">Awaiting processing</small>
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={3}>
          <Card className="border-0 shadow-sm h-100" style={{ borderLeft: '4px solid #ef4444' }}>
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-danger bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-rulers text-danger fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.size_variations || 0}</h3>
              <p className="text-muted mb-2 small">
                Size Variations
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Number of different sizes in this order</Tooltip>}
                >
                  <i className="bi bi-info-circle-fill ms-1 small text-muted"></i>
                </OverlayTrigger>
              </p>
              <small className="text-muted">Different sizes</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Additional Metrics */}
      <Row className="mb-4 g-3">        
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-warning bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-award text-warning fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.qualityScore || 0}%</h3>
              <p className="text-muted mb-2 small">
                Data Completeness
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip>Percentage of cartons with complete scan data (QC and finishing information)</Tooltip>}
                >
                  <i className="bi bi-info-circle-fill ms-1 small text-muted"></i>
                </OverlayTrigger>
              </p>
              <ProgressBar 
                variant="warning" 
                now={stats?.qualityScore || 0}
                style={{ height: '4px' }}
              />
            </Card.Body>
          </Card>
        </Col>
        
        <Col md={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="text-center">
              <div className="d-flex align-items-center justify-content-center mb-2">
                <div className="bg-info bg-opacity-10 rounded-circle p-3">
                  <i className="bi bi-calculator text-info fs-4"></i>
                </div>
              </div>
              <h3 className="fw-bold mb-1">{stats?.avg_units_per_carton?.toFixed(1) || 0}</h3>
              <p className="text-muted mb-2 small">Average Units per Carton</p>
              <small className="text-muted">Packing efficiency metric</small>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Detailed Analytics Tabs */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-bottom">
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
          >
            <Tab eventKey="overview" title={<><i className="bi bi-graph-up me-1"></i> Overview</>} />
            <Tab eventKey="cartons" title={<><i className="bi bi-boxes me-1"></i> Cartons</>} />
          </Tabs>
        </Card.Header>
        
        <Card.Body className="p-4">
          {activeTab === 'overview' && (
            <Row className="g-4">
              {/* Status Distribution Chart */}
              <Col lg={6}>
                <Card className="border-0 bg-light">
                  <Card.Header className="bg-transparent border-0">
                    <h5 className="mb-0">
                      <i className="bi bi-pie-chart me-2"></i>Status Distribution
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    {statusChartData && (
                      <div style={{ height: '300px' }}>
                        <Doughnut 
                          key="status-chart"
                          data={statusChartData} 
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: {
                              legend: { position: 'bottom' }
                            }
                          }}
                        />
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Processing Timeline */}
              <Col lg={6}>
                <Card className="border-0 bg-light">
                  <Card.Header className="bg-transparent border-0">
                    <h5 className="mb-0">
                      <i className="bi bi-graph-up me-2"></i>Processing Timeline
                    </h5>
                  </Card.Header>
                  <Card.Body>
                    {timelineChartData && (
                      <div style={{ height: '300px' }}>
                        <Line 
                          key="timeline-chart"
                          data={timelineChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: {
                              y: { beginAtZero: true }
                            }
                          }}
                        />
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>

              {/* Quick Stats Grid */}
              <Col lg={12}>
                <Row className="g-3">
                  <Col md={3}>
                    <div className="bg-primary bg-opacity-10 p-3 rounded text-center">
                      <h4 className="text-primary mb-1">{stats?.avg_processing_time?.toFixed(1) || 0}h</h4>
                      <small className="text-muted">Avg Processing Time</small>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="bg-success bg-opacity-10 p-3 rounded text-center">
                      <h4 className="text-success mb-1">{stats?.shipped_cartons || 0}</h4>
                      <small className="text-muted">Shipped Cartons</small>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="bg-warning bg-opacity-10 p-3 rounded text-center">
                      <h4 className="text-warning mb-1">{stats?.pending_cartons || 0}</h4>
                      <small className="text-muted">Pending Cartons</small>
                    </div>
                  </Col>
                  <Col md={3}>
                    <div className="bg-info bg-opacity-10 p-3 rounded text-center">
                      <h4 className="text-info mb-1">{stats?.warehouse_cartons || 0}</h4>
                      <small className="text-muted">In Warehouse</small>
                    </div>
                  </Col>
                </Row>
              </Col>
            </Row>
          )}

          {activeTab === 'cartons' && (
            <div>
              {/* Search and Filters */}
              <Row className="mb-3">
                <Col md={4}>
                  <Form.Control
                    type="text"
                    placeholder="🔍 Search cartons (barcode, size, PO, item)..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    size="sm"
                  />
                </Col>
                <Col md={2}>
                  <Form.Select 
                    size="sm" 
                    value={filters.status} 
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <option value="">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="entered">In Warehouse</option>
                    <option value="exited">Shipped</option>
                  </Form.Select>
                </Col>
                {!hideSizeColumn && (
                <Col md={2}>
                  <Form.Select 
                    size="sm"
                    value={filters.size} 
                    onChange={(e) => handleFilterChange('size', e.target.value)}
                  >
                    <option value="">All Sizes</option>
                    {cartonData?.cartons && [...new Set(cartonData.cartons.map(carton => carton.size))].map(size => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </Form.Select>
                </Col>
                )}
                <Col md={2}>
                  <Button 
                    variant="outline-secondary" 
                    size="sm" 
                    onClick={() => {
                      setFilters({ status: '', size: '', qcStatus: '', finishingStatus: '' });
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                  >
                    <i className="bi bi-arrow-clockwise me-1"></i> Reset
                  </Button>
                </Col>
                
                {/* Continue Receiving for Partial Receipts */}
                {bulkActionAnalysis?.canEnterWarehouse && bulkActionAnalysis?.pendingCartons?.length > 0 && (
                  <Col md={3}>
                    <Link to={`/scanner?po=${shipment?.internal_po_number}&action=enter`}>
                      <Button variant="info" size="sm" className="w-100">
                        <i className="bi bi-upc-scan me-1"></i>
                        Continue Receiving ({bulkActionAnalysis.pendingCartons.length})
                      </Button>
                    </Link>
                  </Col>
                )}
                
                <Col md={2} className="text-end">
                  <Dropdown>
                    <Dropdown.Toggle 
                      variant="outline-primary" 
                      size="sm"
                      disabled={isBulkProcessing}
                    >
                      {isBulkProcessing ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <i className="bi bi-gear me-1"></i> Bulk Actions
                        </>
                      )}
                    </Dropdown.Toggle>
                    <Dropdown.Menu>
                      {/* Status Update Actions */}
                      {bulkActionAnalysis?.canEnterWarehouse && (
                        <Dropdown.Item 
                          onClick={handleBulkEnterWarehouse}
                          disabled={isBulkProcessing}
                        >
                          <i className="bi bi-box-arrow-in-down me-2 text-info"></i>
                          Enter Warehouse ({bulkActionAnalysis.statusCounts.pending} pending)
                          {isBulkProcessing && <Spinner animation="border" size="sm" className="ms-2" />}
                        </Dropdown.Item>
                      )}
                      
                      {selectedCartonIds.length > 0 && (
                        <Dropdown.Item
                          onClick={handleBulkShipSelected}
                          disabled={isBulkProcessing}
                        >
                          <i className={`bi ${canDirectShip ? 'bi-truck' : 'bi-upc-scan'} me-2 text-success`}></i>
                          {canDirectShip
                            ? `Mark Selected as Shipped (${selectedCartonIds.length})`
                            : `Scan Selected Out (${selectedCartonIds.length})`}
                        </Dropdown.Item>
                      )}
                      {bulkActionAnalysis?.canExitWarehouse && (
                        <Dropdown.Item 
                          onClick={handleBulkExitWarehouse}
                          disabled={isBulkProcessing}
                        >
                          <i className="bi bi-truck me-2 text-success"></i>
                          {canDirectShip
                            ? `Ship All In Warehouse (${bulkActionAnalysis.statusCounts.entered})`
                            : `Scan All Out (${bulkActionAnalysis.statusCounts.entered} in warehouse)`}
                          {isBulkProcessing && <Spinner animation="border" size="sm" className="ms-2" />}
                        </Dropdown.Item>
                      )}
                      
                      {(bulkActionAnalysis?.canEnterWarehouse || bulkActionAnalysis?.canExitWarehouse) && (
                        <Dropdown.Divider />
                      )}
                      
                      {/* Print and Export Actions */}
                      <Dropdown.Item onClick={handleBulkPrintLabels}>
                        <i className="bi bi-printer me-2"></i>
                        Print All Labels ({cartonData?.cartons?.filter(c => c.status !== 'exited').length || 0} available)
                      </Dropdown.Item>
                      
                      <Dropdown.Item onClick={() => handleExport('csv')}>
                        <i className="bi bi-file-earmark-spreadsheet me-2"></i>
                        Export Filtered Data
                      </Dropdown.Item>
                      
                      <Dropdown.Divider />
                      
                      {/* Status Summary */}
                      <Dropdown.Header className="small">
                        <i className="bi bi-info-circle me-1"></i>
                        Status Summary
                      </Dropdown.Header>
                      <Dropdown.ItemText className="small text-muted">
                        Pending: {bulkActionAnalysis?.statusCounts.pending || 0} | 
                        In Warehouse: {bulkActionAnalysis?.statusCounts.entered || 0} | 
                        Shipped: {bulkActionAnalysis?.statusCounts.exited || 0}
                      </Dropdown.ItemText>
                    </Dropdown.Menu>
                  </Dropdown>
                </Col>
              </Row>

              {shippableFiltered.length > 0 && (
                <div className="d-flex flex-wrap align-items-center gap-2 mb-3 p-2 bg-light rounded">
                  <Form.Check
                    type="checkbox"
                    id="select-all-shippable"
                    label={`Mark all in warehouse (${shippableFiltered.length})`}
                    checked={
                      shippableFiltered.length > 0 &&
                      shippableFiltered.every((c) => selectedCartonIds.includes(c.id))
                    }
                    onChange={toggleSelectAllShippable}
                  />
                  {selectedCartonIds.length > 0 && (
                    <>
                      <Badge bg="primary">{selectedCartonIds.length} selected</Badge>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={handleBulkShipSelected}
                        disabled={isBulkProcessing}
                        title={canDirectShip ? 'Mark selected cartons as shipped' : 'Open exit scanner for this PO'}
                      >
                        <i className={`bi ${canDirectShip ? 'bi-truck' : 'bi-upc-scan'} me-1`}></i>
                        {canDirectShip ? 'Mark as Shipped' : 'Scan to Ship'}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => setSelectedCartonIds([])}
                      >
                        Clear
                      </Button>
                    </>
                  )}
                </div>
              )}

              {/* Table Info and Pagination Controls */}
              <Row className="mb-2">
                <Col md={4}>
                  <small className="text-muted">
                    Showing {paginationInfo.startItem} to {paginationInfo.endItem} of {paginationInfo.totalItems} cartons
                    {searchTerm && ` (filtered from ${cartonData?.cartons?.length || 0} total)`}
                  </small>
                </Col>
                <Col md={4} className="text-center">
                  <div className="d-flex align-items-center justify-content-center gap-2">
                    <small className="text-muted">Show:</small>
                    <Form.Select
                      size="sm"
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{ width: 'auto' }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </Form.Select>
                    <small className="text-muted">per page</small>
                  </div>
                </Col>
                <Col md={4} className="text-end">
                  <small className="text-muted">
                    Page {paginationInfo.currentPage} of {paginationInfo.totalPages}
                  </small>
                </Col>
              </Row>

              {/* Cartons Table */}
              {cartonLoading || isRefreshing ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-2 text-muted">
                    {isRefreshing ? '🔄 Updating carton data...' : 'Loading cartons...'}
                  </p>
                </div>
              ) : (
                <div className="table-responsive">
                  <Table striped hover>
                    <thead className="bg-light">
                      <tr>
                        <th style={{ width: '40px' }}>
                          <Form.Check
                            type="checkbox"
                            checked={allPageSelected}
                            onChange={toggleSelectAllOnPage}
                            title="Select all shippable on this page"
                            disabled={shippableOnPage.length === 0}
                          />
                        </th>
                        <th>Barcode</th>
                        {!hideSizeColumn && <th>Size</th>}
                        <th>Units</th>
                        <th>Status</th>
                        <th>Scan In Time</th>
                        <th>Scan Out Time</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedCartons.length > 0 ? (
                        paginatedCartons.map(carton => (
                          <tr key={carton.id} className={selectedCartonIds.includes(carton.id) ? 'table-primary' : ''}>
                            <td>
                              <Form.Check
                                type="checkbox"
                                checked={selectedCartonIds.includes(carton.id)}
                                onChange={() => toggleCartonSelection(carton.id)}
                                disabled={carton.status !== 'entered'}
                                title={carton.status !== 'entered' ? 'Only in-warehouse cartons can be selected to ship' : 'Select to ship'}
                              />
                            </td>
                            <td>
                              <code className="small">{carton.barcode_2d}</code>
                            </td>
                            {!hideSizeColumn && <td>{carton.size}</td>}
                            <td>{carton.units}</td>
                            <td>
                              <Badge bg={
                                carton.status === 'exited' ? 'success' :
                                carton.status === 'entered' ? 'info' : 'warning'
                              }>
                                {formatCartonStatus(carton.status)}
                              </Badge>
                            </td>
                            <td className="small text-muted">
                              {formatCartonDateTime(getCartonEntryTime(carton))}
                            </td>
                            <td className="small text-muted">
                              {formatCartonDateTime(getCartonExitTime(carton))}
                            </td>
                            <td>
                              <div className="d-flex gap-1">
                                <OverlayTrigger
                                  placement="top"
                                  overlay={<Tooltip>View Details</Tooltip>}
                                >
                                  <Button 
                                    variant="outline-info" 
                                    size="sm"
                                    onClick={() => handleViewCarton(carton)}
                                  >
                                    <i className="bi bi-eye"></i>
                                  </Button>
                                </OverlayTrigger>

                                <OverlayTrigger
                                  placement="top"
                                  overlay={<Tooltip>Edit Carton</Tooltip>}
                                >
                                  <Button 
                                    variant="outline-primary" 
                                    size="sm"
                                    onClick={() => handleEditCarton(carton)}
                                  >
                                    <i className="bi bi-pencil"></i>
                                  </Button>
                                </OverlayTrigger>

                                {carton.status === 'entered' && (
                                  <OverlayTrigger
                                    placement="top"
                                    overlay={
                                      <Tooltip>
                                        {canDirectShip ? 'Mark as Shipped' : 'Scan to Ship'}
                                      </Tooltip>
                                    }
                                  >
                                    <Button 
                                      variant="outline-success" 
                                      size="sm"
                                      onClick={() => handleMarkAsShipped(carton)}
                                    >
                                      <i className={`bi ${canDirectShip ? 'bi-truck' : 'bi-upc-scan'}`}></i>
                                    </Button>
                                  </OverlayTrigger>
                                )}

                                <OverlayTrigger
                                  placement="top"
                                  overlay={<Tooltip>Print Label</Tooltip>}
                                >
                                  <Button 
                                    variant="outline-secondary" 
                                    size="sm"
                                    onClick={() => handlePrintLabel(carton)}
                                  >
                                    <i className="bi bi-printer"></i>
                                  </Button>
                                </OverlayTrigger>

                                <OverlayTrigger
                                  placement="top"
                                  overlay={<Tooltip>Copy Barcode</Tooltip>}
                                >
                                  <Button 
                                    variant="outline-dark" 
                                    size="sm"
                                    onClick={() => handleCopyBarcode(carton.barcode_2d)}
                                  >
                                    <i className="bi bi-clipboard"></i>
                                  </Button>
                                </OverlayTrigger>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={hideSizeColumn ? 6 : 7} className="text-center text-muted py-4">
                            {searchTerm || filters.status || filters.size 
                              ? 'No cartons match the current filters' 
                              : cartonData ? 'No cartons found for this shipment' : 'Loading carton data...'
                            }
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                  
                  {/* Pagination Controls */}
                  {paginationInfo.totalPages > 1 && (
                    <div className="d-flex justify-content-between align-items-center mt-3">
                      <div>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                        >
                          <i className="bi bi-chevron-double-left"></i>
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => prev - 1)}
                          className="ms-1"
                        >
                          <i className="bi bi-chevron-left"></i>
                        </Button>
                      </div>
                      
                      <div className="d-flex align-items-center gap-1">
                        {/* Show page numbers */}
                        {Array.from({ length: Math.min(5, paginationInfo.totalPages) }, (_, i) => {
                          let pageNum;
                          if (paginationInfo.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            pageNum = i + 1;
                          } else if (currentPage >= paginationInfo.totalPages - 2) {
                            pageNum = paginationInfo.totalPages - 4 + i;
                          } else {
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={pageNum === currentPage ? "primary" : "outline-secondary"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <div>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === paginationInfo.totalPages}
                          onClick={() => setCurrentPage(prev => prev + 1)}
                        >
                          <i className="bi bi-chevron-right"></i>
                        </Button>
                        <Button
                          variant="outline-secondary"
                          size="sm"
                          disabled={currentPage === paginationInfo.totalPages}
                          onClick={() => setCurrentPage(paginationInfo.totalPages)}
                          className="ms-1"
                        >
                          <i className="bi bi-chevron-double-right"></i>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}


        </Card.Body>
      </Card>

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Export PO Data</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Choose the format for exporting PO data:</p>
          <div className="d-grid gap-2">
            <Button variant="outline-primary" onClick={() => handleExport('csv')}>
              <i className="bi bi-file-earmark-spreadsheet me-2"></i>
              Export as CSV
            </Button>
            <Button variant="outline-secondary" onClick={() => handleExport('pdf')}>
              <i className="bi bi-file-earmark-pdf me-2"></i>
              Export as PDF
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Bulk Processing Modal */}
      <Modal 
        show={isBulkProcessing} 
        backdrop="static"
        keyboard={false}
        centered
        size="sm"
      >
        <Modal.Body className="text-center py-4">
          <div className="mb-3">
            <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          </div>
          <h5 className="mb-2">🔄 {bulkProgress.action}</h5>
          <p className="text-muted mb-3">
            Processing {bulkProgress.total} cartons...
          </p>
          <ProgressBar 
            now={bulkProgress.total > 0 ? (bulkProgress.current / bulkProgress.total) * 100 : 0}
            variant="primary"
            style={{ height: '8px' }}
            className="mb-2"
          />
          <small className="text-muted">
            {bulkProgress.current} of {bulkProgress.total} completed
          </small>
          <div className="mt-3">
            <small className="text-muted">
              Please wait, do not close this window...
            </small>
          </div>
        </Modal.Body>
      </Modal>

      {/* Carton Details Modal */}
      <Modal 
        show={showCartonModal} 
        onHide={() => setShowCartonModal(false)} 
        size="lg"
        animation={true}
        backdrop="static"
        keyboard={true}
        restoreFocus={false}
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fs-5">
            <i className="bi bi-box-seam me-2 text-primary"></i>
            Carton Details - {selectedCarton?.barcode_2d}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          {selectedCarton && (
            <div className="row g-3">
              <div className="col-md-6">
                <div className="bg-light rounded p-3">
                  <h6 className="text-muted mb-3 fw-semibold">Basic Information</h6>
                  <div className="mb-2">
                    <strong>Barcode:</strong>
                    <div className="d-flex align-items-center gap-2 mt-1">
                      <code className="bg-white px-2 py-1 rounded border">{selectedCarton.barcode_2d}</code>
                      <Button 
                        variant="outline-secondary" 
                        size="sm"
                        onClick={() => handleCopyBarcode(selectedCarton.barcode_2d)}
                      >
                        <i className="bi bi-clipboard"></i>
                      </Button>
                    </div>
                  </div>
                  <div className="mb-2">
                    <strong>Customer PO:</strong> <span className="text-muted">{formatCustomerPoForDisplay(shipment?.customer, selectedCarton.po_number)}</span>
                  </div>
                  <div className="mb-2">
                    <strong>Size:</strong> <span className="text-muted">{selectedCarton.size}</span>
                  </div>
                  <div className="mb-2">
                    <strong>Units:</strong> <span className="text-muted">{selectedCarton.units}</span>
                  </div>
                  <div className="mb-2">
                    <strong>Item:</strong> <span className="text-muted">{selectedCarton.item}</span>
                  </div>
                  <div className="mb-0">
                    <strong>Status:</strong>{' '}
                    <Badge bg={
                      selectedCarton.status === 'exited' ? 'success' :
                      selectedCarton.status === 'entered' ? 'info' : 'warning'
                    }>
                      {formatCartonStatus(selectedCarton.status)}
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="col-md-6">
                <div className="bg-light rounded p-3">
                  <h6 className="text-muted mb-3 fw-semibold">Processing Information</h6>
                  <div className="mb-2">
                    <strong>Transfer Number:</strong> <span className="text-muted">{selectedCarton.transfer_number}</span>
                  </div>
                  <div className="mb-2">
                    <strong>Sequence:</strong> <span className="text-muted">{selectedCarton.sequence_number}</span>
                  </div>
                  <div className="mb-2">
                    <strong>Customer:</strong> <span className="text-muted">{selectedCarton.division}</span>
                  </div>
                  <div className="mb-0">
                    <strong>Category:</strong> <span className="text-muted">{selectedCarton.wave_category}</span>
                  </div>
                </div>
              </div>
              
              <div className="col-12">
                <div className="bg-light rounded p-3">
                  <h6 className="text-muted mb-3 fw-semibold">Timestamps</h6>
                  <div className="row">
                    <div className="col-md-6">
                      <div className="mb-2">
                        <strong>Scan In Time:</strong><br />
                        <small className="text-muted">{selectedCarton.formattedEntryTime}</small>
                      </div>
                      <div className="mb-2">
                        <strong>Scan Out Time:</strong><br />
                        <small className="text-muted">{selectedCarton.formattedExitTime}</small>
                      </div>
                      <div className="mb-2">
                        <strong>Created:</strong><br />
                        <small className="text-muted">{selectedCarton.formattedCreatedAt}</small>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <div className="mb-2">
                        <strong>Updated:</strong><br />
                        <small className="text-muted">{selectedCarton.formattedUpdatedAt}</small>
                      </div>
                      <div className="mb-2">
                        <strong>Print Date:</strong><br />
                        <small className="text-muted">{selectedCarton.print_date}</small>
                      </div>
                    </div>
                  </div>
                  {selectedCarton.notes && (
                    <div className="mt-3">
                      <strong>Notes:</strong>
                      <div className="bg-white p-2 rounded border mt-1">
                        <small>{selectedCarton.notes}</small>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <div className="d-flex gap-2 w-100 justify-content-between">
            <div className="d-flex gap-2">
              <Button 
                variant="outline-primary" 
                size="sm"
                onClick={() => handleEditCarton(selectedCarton)}
              >
                <i className="bi bi-pencil me-1"></i> Edit
              </Button>
              <Button 
                variant="outline-secondary" 
                size="sm"
                onClick={() => handlePrintLabel(selectedCarton)}
              >
                <i className="bi bi-printer me-1"></i> Print Label
              </Button>
              {selectedCarton?.status === 'entered' && (
                <Button 
                  variant="outline-success" 
                  size="sm"
                  onClick={() => {
                    handleMarkAsShipped(selectedCarton);
                    setShowCartonModal(false);
                  }}
                >
                  <i className={`bi ${canDirectShip ? 'bi-truck' : 'bi-upc-scan'} me-1`}></i>
                  {canDirectShip ? 'Mark as Shipped' : 'Scan to Ship'}
                </Button>
              )}
            </div>
            <Button variant="secondary" size="sm" onClick={() => setShowCartonModal(false)}>
              Close
            </Button>
          </div>
        </Modal.Footer>
      </Modal>

      {/* Manual entry: driver / truck info before marking shipped */}
      <Modal show={showShipModal} onHide={closeShipModal} centered backdrop="static">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-truck me-2"></i>
            Mark as Shipped
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="info" className="mb-3 py-2">
            <small>
              Manual-entry order — enter truck and driver details, then mark{' '}
              <strong>{shipModalCartonCount}</strong> carton{shipModalCartonCount !== 1 ? 's' : ''} as shipped.
              No barcode scanning required.
            </small>
          </Alert>

          {cartonToShip && (
            <p className="small text-muted mb-3">
              Carton: <code>{cartonToShip.barcode_2d}</code>
            </p>
          )}
          {cartonsToShipBulk?.length > 0 && (
            <p className="small text-muted mb-3">
              {cartonsToShipBulk.length} cartons selected from this PO
            </p>
          )}

          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleShipModalSubmit();
            }}
          >
            <Form.Group className="mb-3">
              <Form.Label>Truck Registration *</Form.Label>
              <Form.Control
                type="text"
                name="truck_reg"
                value={shipFormData.truck_reg}
                onChange={(e) => setShipFormData((prev) => ({ ...prev, truck_reg: e.target.value }))}
                placeholder="e.g., ABC 123 GP"
                required
                autoFocus
                style={{ textTransform: 'uppercase' }}
                disabled={shippingSubmitting}
              />
            </Form.Group>

            <Form.Group className="mb-0">
              <Form.Label>Driver Name *</Form.Label>
              <Form.Control
                type="text"
                name="driver_name"
                value={shipFormData.driver_name}
                onChange={(e) => setShipFormData((prev) => ({ ...prev, driver_name: e.target.value }))}
                placeholder="First and surname"
                required
                disabled={shippingSubmitting}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeShipModal} disabled={shippingSubmitting}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleShipModalSubmit}
            disabled={shippingSubmitting || !shipFormData.truck_reg.trim() || !shipFormData.driver_name.trim()}
          >
            {shippingSubmitting ? (
              <>
                <Spinner animation="border" size="sm" className="me-2" />
                Shipping…
              </>
            ) : (
              <>
                <i className="bi bi-check-circle me-1"></i>
                Confirm Shipped
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
});

export default PODetails;
