import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Modal, Button, Form, Alert, Badge, Table, ProgressBar } from 'react-bootstrap';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Quagga from 'quagga';
import { API_BASE_URL } from '../config';
import ExitScanModal from '../components/ExitScanModal';
import TruckLoadChoiceModal from '../components/TruckLoadChoiceModal';
import {
  getActiveTrucks,
  addActiveTruck,
  removeActiveTruck,
  fetchOpenTrucks,
  mergeOpenTruckLists
} from '../utils/truckStorage';

const normalizeExpectedPo = (po) => {
  const value = String(po || '').trim();
  if (!value) return '';
  const match = value.match(/^([A-Za-z]+)-(.+)$/);
  if (match) {
    return `${match[1].toUpperCase()}-${match[2].trim()}`;
  }
  return value.toUpperCase();
};

const poMatches = (left, right) => {
  const a = normalizeExpectedPo(left);
  const b = normalizeExpectedPo(right);
  return a !== '' && a === b;
};

// Simple audio cues using Web Audio API for distinct feedback tones
const createAudioContext = () => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    return Ctx ? new Ctx() : null;
  } catch (e) {
    return null;
  }
};

let sharedAudioCtx;
const getAudioCtx = () => {
  if (!sharedAudioCtx) sharedAudioCtx = createAudioContext();
  return sharedAudioCtx;
};

// Haptics support
const vibrate = (pattern) => {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
};

// Centralized audio scheduler to avoid overlapping and ensure distinct patterns
let activeAudioStops = [];
const stopActiveAudio = () => {
  try {
    activeAudioStops.forEach(stop => stop());
  } catch (_) {}
  activeAudioStops = [];
};

const playPattern = (segments) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  stopActiveAudio();
  const startBase = ctx.currentTime;
  let t = startBase;
  segments.forEach(seg => {
    const durationS = (seg.durationMs || 120) / 1000;
    const gapS = (seg.gapMs || 0) / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(seg.gain != null ? seg.gain : 0.12, t);
    osc.type = seg.type || 'sine';
    const startFreq = seg.startFreq || seg.freq || 700;
    osc.frequency.setValueAtTime(startFreq, t);
    if (seg.endFreq && seg.endFreq !== startFreq) {
      // Use exponential ramp for smooth chirp when frequencies differ
      const safeEnd = Math.max(1, seg.endFreq);
      try {
        osc.frequency.exponentialRampToValueAtTime(safeEnd, t + durationS);
      } catch (_) {
        osc.frequency.setValueAtTime(safeEnd, t + durationS);
      }
    }
    // Quick fade to avoid clicks
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain.gain.value), t + durationS - 0.01);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + durationS);
    activeAudioStops.push(() => {
      try { osc.stop(); } catch (_) {}
    });
    t += durationS + gapS;
  });
};

const playTone = (frequency = 880, durationMs = 150, type = 'sine', gain = 0.1) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    // Best-effort resume; must be called in a user gesture somewhere else as well
    ctx.resume().catch(() => {});
  }
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  amp.gain.value = gain;
  oscillator.connect(amp);
  amp.connect(ctx.destination);
  const now = ctx.currentTime;
  oscillator.start(now);
  oscillator.stop(now + durationMs / 1000);
};

const playSuccessSound = () => {
  // Two quick rising chirps
  playPattern([
    { type: 'sine', startFreq: 650, endFreq: 980, durationMs: 130, gain: 0.12, gapMs: 60 },
    { type: 'sine', startFreq: 800, endFreq: 1200, durationMs: 120, gain: 0.12 }
  ]);
};

const playDuplicateSound = () => {
  // Two short square beeps, distinct timing
  playPattern([
    { type: 'square', freq: 520, durationMs: 110, gain: 0.14, gapMs: 90 },
    { type: 'square', freq: 520, durationMs: 110, gain: 0.14 }
  ]);
};

const playWrongPoSound = () => {
  // Single low sawtooth buzz
  playPattern([
    { type: 'sawtooth', freq: 230, durationMs: 360, gain: 0.16 }
  ]);
};

const playErrorSound = () => {
  // Descending two-tone triangle
  playPattern([
    { type: 'triangle', freq: 760, durationMs: 150, gain: 0.12, gapMs: 70 },
    { type: 'triangle', freq: 520, durationMs: 220, gain: 0.12 }
  ]);
};

const playNotFoundSound = () => {
  // Three descending tones (clearly different cadence)
  playPattern([
    { type: 'triangle', freq: 900, durationMs: 120, gain: 0.12, gapMs: 80 },
    { type: 'triangle', freq: 640, durationMs: 150, gain: 0.12, gapMs: 110 },
    { type: 'triangle', freq: 430, durationMs: 220, gain: 0.12 }
  ]);
};

// One-time user interaction hook to resume audio on scanners/keyboard
let audioResumeBound = false;
const bindAudioResumeOnInteraction = () => {
  if (audioResumeBound) return;
  audioResumeBound = true;
  const tryResume = () => {
    const ctx = getAudioCtx();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };
  ['click', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, tryResume, { passive: true });
  });
};

// Add debounce utility to prevent excessive API calls
const debounce = (func, delay) => {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => func.apply(this, args), delay);
  };
};

// Helper function to detect camera support
const detectCameraSupport = async () => {
  try {
    // Check if running in a secure context (required for camera access)
    const isSecure = window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1' ||
                    window.location.hostname === '0.0.0.0' ||
                    window.isSecureContext; // Browser's built-in secure context check
    
    const isLocalNetwork = /^192\.168\./.test(window.location.hostname) || 
                          /^10\.0\./.test(window.location.hostname) || 
                          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(window.location.hostname);

    console.log('Security check:', {
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isSecureContext: window.isSecureContext,
      isSecure,
      isLocalNetwork
    });

    if (!isSecure && !isLocalNetwork) {
      return {
        supported: false,
        reason: 'Camera access requires HTTPS. For development, please access via localhost or use manual entry.',
        isHttpsRequired: true
      };
    }

    // Enhanced camera API support detection
    const hasMediaDevices = !!(navigator.mediaDevices);
    const hasGetUserMedia = !!(navigator.mediaDevices?.getUserMedia);
    const hasLegacyGetUserMedia = !!(navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia);
    
    console.log('Camera API support check:', {
      hasMediaDevices,
      hasGetUserMedia,
      hasLegacyGetUserMedia,
      userAgent: navigator.userAgent
    });

    if (!hasMediaDevices && !hasLegacyGetUserMedia) {
      return { 
        supported: false, 
        reason: 'Camera API not supported. Please use a modern browser like Chrome, Firefox, Safari, or Edge.' 
      };
    }

    if (!hasGetUserMedia) {
      // Don't immediately fail - let the actual camera test determine support
    }

    // First try to enumerate devices to check if camera exists
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        return { supported: false, reason: 'No camera found on this device.' };
      }
    } catch (enumError) {
      console.warn('Could not enumerate devices:', enumError);
      // Continue anyway, as some browsers require permission first
    }

    // Try to get camera permission with multiple fallback strategies
    let stream = null;
    
    // Define camera configurations to try in order
    const cameraConfigs = [
      // Try environment camera first (best for barcode scanning)
      {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      },
      // Try user camera
      {
        video: { 
          facingMode: 'user',
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      },
      // Try any camera with basic constraints
      {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      },
      // Try minimal constraints
      {
        video: true
      }
    ];
    
    let lastError = null;
    
    for (let i = 0; i < cameraConfigs.length; i++) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(cameraConfigs[i]);
        break; // Success, exit loop
      } catch (configError) {
        lastError = configError;
        
        // If this is a permission error, don't try other configs
        if (configError.name === 'NotAllowedError') {
          break;
        }
      }
    }
    
    // If no config worked, throw the last error
    if (!stream) {
      console.error('All camera configurations failed');
      throw lastError || new Error('Camera access failed');
    }

    // Stop the stream immediately after getting permission
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }

    return { supported: true, reason: null };
  } catch (error) {
    console.error('Camera access denied or not available:', error);
    console.log('Error details:', {
      name: error.name,
      message: error.message,
      constraint: error.constraint
    });

    let reason = 'Unknown camera error. Please try manual entry.';
    let isHttpsRequired = false;

    if (error.name === 'NotAllowedError') {
      reason = 'Camera permission denied. Please click "Allow" when prompted and refresh the page.';
    } else if (error.name === 'NotFoundError') {
      reason = 'No camera found on this device. Please ensure your laptop has a working camera.';
    } else if (error.name === 'NotReadableError') {
      reason = 'Camera is already in use by another application. Please close other camera apps and try again.';
    } else if (error.name === 'OverconstrainedError') {
      reason = 'Camera does not support the required settings. Your camera may not support the resolution needed for barcode scanning.';
    } else if (error.name === 'SecurityError') {
      reason = 'Camera access blocked due to security restrictions. Please access via https://localhost:3000 or allow camera permissions.';
      isHttpsRequired = true;
    } else if (error.name === 'AbortError') {
      reason = 'Camera access was interrupted. Please try again.';
    }

    return { supported: false, reason, isHttpsRequired };
  }
};

// Configure axios error handling
axios.interceptors.response.use(
  response => response,
  error => {
    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('Network request timed out. Please check your connection.'));
    }
    if (!error.response) {
      return Promise.reject(new Error('Network error. Please check your connection to the server.'));
    }
    return Promise.reject(error);
  }
);

/**
 * CartonScanner Page Component
 * 
 * Handles barcode scanning for carton entry and exit tracking
 */
const CartonScanner = () => {
  const [searchParams] = useSearchParams();
  const [barcode, setBarcode] = useState('');
  const [barcodes, setBarcodes] = useState(''); // For batch scanning
  const [batchMode, setBatchMode] = useState(false); // Toggle for batch mode
  const [action, setAction] = useState(''); // 'enter' or 'exit' - empty by default
  const [poPrefix, setPoPrefix] = useState('FTM');
  const [poNumber, setPoNumber] = useState(''); // Required: PO number to validate scans
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [cameraErrorReason, setCameraErrorReason] = useState(null);
  const [isHttpsRequired, setIsHttpsRequired] = useState(false);
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState('environment');
  const [processingTimes, setProcessingTimes] = useState([]); // Track processing times
  const [lastScanTime, setLastScanTime] = useState(0); // Track last scan timestamp
  const [scanCooldown, setScanCooldown] = useState(3000); // 3 second cooldown between scans
  const [isProcessingScan, setIsProcessingScan] = useState(false); // Prevent multiple simultaneous scans
  const [detectedCodes, setDetectedCodes] = useState([]); // Store multiple detected codes
  const [showCodeSelection, setShowCodeSelection] = useState(false); // Show code selection modal
  const [scanTimeoutId, setScanTimeoutId] = useState(null); // Store timeout ID for cleanup
  const [isSecureContext, setIsSecureContext] = useState(false); // Check if running over HTTPS
  const [poValidation, setPoValidation] = useState({
    checked: false,
    exists: false,
    allowed: false,
    status: '',
    summary: '',
    counts: null
  });
  const [searchTerm, setSearchTerm] = useState(''); // For filtering recent scans
  const [showExitModal, setShowExitModal] = useState(false);
  const [showTruckChoiceModal, setShowTruckChoiceModal] = useState(false);
  const [loadingOpenTrucks, setLoadingOpenTrucks] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [activeTrucks, setActiveTrucks] = useState([]);
  const [activeTruck, setActiveTruck] = useState(null);
  const [exitWithoutTruck, setExitWithoutTruck] = useState(false);
  const [sessionScanCount, setSessionScanCount] = useState(0);
  const [sessionUnitCount, setSessionUnitCount] = useState(0);
  const [counterPulse, setCounterPulse] = useState(false);
  const [poProgress, setPoProgress] = useState(null); // live counts across all scanners
  const expectedPo = normalizeExpectedPo(poNumber ? `${poPrefix}-${poNumber}` : '');
  const normalizedPo = expectedPo;

  // Reference to barcode input for focus management
  const barcodeInputRef = useRef(null);
  const poInputRef = useRef(null);
  const scannerRef = useRef(null);

  // Detect camera support and mobile device on component mount
  useEffect(() => {
    // Ensure audio is allowed to play on user interaction devices
    bindAudioResumeOnInteraction();

    // Check if device is mobile
    const checkMobileDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobileDevice(isMobile);
      return isMobile;
    };

    // Check camera support
    const checkCameraSupport = async () => {
      const result = await detectCameraSupport();
      setCameraSupported(result.supported);
      setCameraErrorReason(result.reason);
      setIsHttpsRequired(result.isHttpsRequired || false);
    };

    const loadActiveTrucks = () => {
      const trucks = getActiveTrucks();
      setActiveTrucks(trucks);
      if (trucks.length > 0) {
        setActiveTruck(trucks[trucks.length - 1]);
      }
    };

    // Check both camera and mobile device
    checkCameraSupport();
    checkMobileDevice();
    loadActiveTrucks();

    // Log access method
  }, []);
  
  // Handle URL parameters for pre-configuration (from PO Details "Scan to Ship" button)
  useEffect(() => {
    const urlPo = searchParams.get('po');
    const urlAction = searchParams.get('action');
    
    if (urlPo && urlPo.trim()) {
      const normalizedUrlPo = normalizeExpectedPo(urlPo);
      const match = normalizedUrlPo.match(/^([A-Z]+)-(.+)$/);
      if (match) {
        setPoPrefix(match[1]);
        setPoNumber(match[2]);
      } else {
        setPoNumber(normalizedUrlPo);
      }
    }
    
    if (urlAction === 'enter') {
      setAction('enter');
      setExitWithoutTruck(false);
    } else if (urlAction === 'exit') {
      // Open truck selection modal for exit mode
      setShowTruckChoiceModal(true);
    }
  }, [searchParams]);
  
  // Auto-clear success messages after 5 seconds
  useEffect(() => {
    if (scanResult?.success) {
      const timer = setTimeout(() => {
        setScanResult(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [scanResult]);

  // Auto-clear error messages after 8 seconds (longer for errors)
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Focus barcode input on component mount and after each scan
  useEffect(() => {
    if (!showScanner && !loading) {
      if (!poValidation.checked || !poValidation.exists || !poValidation.allowed) {
        if (poInputRef.current) poInputRef.current.focus();
      } else if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  }, [scanResult, showScanner, loading, poValidation]);

  const refreshOpenTrucks = useCallback(async () => {
    setLoadingOpenTrucks(true);
    try {
      const fromApi = await fetchOpenTrucks();
      const merged = mergeOpenTruckLists(fromApi, getActiveTrucks());
      setActiveTrucks(merged);
      return merged;
    } finally {
      setLoadingOpenTrucks(false);
    }
  }, []);

  useEffect(() => {
    if (!showTruckChoiceModal) return;
    refreshOpenTrucks();
  }, [showTruckChoiceModal, refreshOpenTrucks]);

  // Fetch live carton counts for the selected PO — shared across all scanners.
  const fetchPoProgress = useCallback(async () => {
    if (!expectedPo || !poValidation.exists) return;
    try {
      const res = await axios.get(`${API_BASE_URL}/po_scan_progress.php`, {
        params: { po: expectedPo },
        timeout: 4000
      });
      if (res.data.success && res.data.found) {
        setPoProgress(res.data);
      }
    } catch (_) {
      // Best-effort — don't surface errors for the progress poll
    }
  }, [expectedPo, poValidation.exists]);

  // Poll every 3 seconds while a valid PO is selected.
  useEffect(() => {
    if (!poValidation.exists || !expectedPo) {
      setPoProgress(null);
      return;
    }
    fetchPoProgress();
    const interval = setInterval(fetchPoProgress, 3000);
    return () => clearInterval(interval);
  }, [expectedPo, poValidation.exists, fetchPoProgress]);

  const handleFinishLoading = async () => {
    if (!activeTruck) return;
    if (!window.confirm(`Mark truck ${activeTruck.truck_reg} as finished loading? You can still view it in Truck Summary.`)) {
      return;
    }
    try {
      await axios.post(`${API_BASE_URL}/close_truck_loading.php`, { id: activeTruck.id });
      const remaining = removeActiveTruck(activeTruck.id);
      const merged = mergeOpenTruckLists(await fetchOpenTrucks(), remaining);
      setActiveTrucks(merged);
      setActiveTruck(merged.length ? merged[merged.length - 1] : null);
      if (merged.length === 0) {
        setAction('');
        setExitWithoutTruck(false);
      }
      setScanResult({
        success: true,
        message: `Truck ${activeTruck.truck_reg} loading complete.`
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to close truck loading');
    }
  };

  const getPoInputClass = () => {
    if (!poValidation.checked) return '';
    if (!poValidation.exists) return 'is-invalid';
    if (poValidation.status === 'fully_shipped') return 'is-valid';
    if (poValidation.allowed) return 'is-valid';
    return '';
  };

  const getPoFeedbackTone = () => {
    if (!poValidation.checked) return 'muted';
    if (!poValidation.exists) return 'danger';
    if (poValidation.status === 'fully_shipped') return 'success';
    if (poValidation.allowed) return 'success';
    if (poValidation.status === 'found') return 'info';
    return 'warning';
  };

  const renderPoFeedbackIcon = () => {
    const tone = getPoFeedbackTone();
    if (tone === 'success') return 'bi-check-circle-fill';
    if (tone === 'danger') return 'bi-x-circle-fill';
    if (tone === 'info') return 'bi-info-circle-fill';
    return 'bi-exclamation-circle-fill';
  };

  // Validate PO on change with debounce (uses action-specific or general check)
  const validatePoDebounced = useRef(debounce(async (po, currentAction) => {
    if (!po || !po.trim()) {
      setPoValidation({
        checked: false,
        exists: false,
        allowed: false,
        status: '',
        summary: '',
        counts: null
      });
      return;
    }
    const apiAction = currentAction && ['enter', 'exit'].includes(currentAction) ? currentAction : 'check';
    try {
      const normalizedPo = normalizeExpectedPo(po);
      const res = await axios.post(`${API_BASE_URL}/validate_po.php`, {
        po: normalizedPo || po.trim(),
        action: apiAction
      });
      const data = res.data || {};
      setPoValidation({
        checked: true,
        exists: !!data.exists,
        allowed: !!data.allowed,
        status: data.status || '',
        summary: data.summary || '',
        counts: data.counts || null
      });
    } catch (e) {
      const msg = e.response?.data?.message || 'Validation failed';
      setPoValidation({
        checked: true,
        exists: false,
        allowed: false,
        status: 'not_found',
        summary: msg,
        counts: null
      });
    }
  }, 400)).current;

  useEffect(() => {
    validatePoDebounced(expectedPo, action);
  }, [expectedPo, action]);


  // Initialize and clean up Quagga scanner when modal is shown/hidden
  useEffect(() => {
    if (!cameraSupported) {
      console.error('Camera not supported on this device');
      setError('Camera is not supported on this device. Please use manual entry.');
      return;
    }

    if (!Quagga) {
      console.error('Quagga library is not available');
      setError('Camera scanning is not available. Please use manual entry.');
      return;
    }

    if (showScanner) {
      // Initialize Quagga when scanner modal opens
      initQuagga();
    } else {
      // Clean up when scanner modal closes
      cleanupQuagga();
    }

    return () => {
      // Clean up on component unmount
      cleanupQuagga();
    };
  }, [showScanner, cameraSupported]);

  // Clean up any pending timeouts when component unmounts
  useEffect(() => {
    return () => {
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
      }
    };
  }, [scanTimeoutId]);

  // Helper function to clean up Quagga
  const cleanupQuagga = () => {
    try {
      // Clear any existing timeout
      if (scanTimeoutId) {
        clearTimeout(scanTimeoutId);
        setScanTimeoutId(null);
      }

      // First check if Quagga has an active instance
      const hasActiveInstance = Quagga && (Quagga._isInitialized ||
                              (Quagga._inputStream && Quagga._inputStream.constraints) ||
                              (Quagga._canvas && Quagga._canvas.ctx));

      if (hasActiveInstance && typeof Quagga.stop === 'function') {
        // Properly clean up event listeners first
        if (typeof Quagga.offDetected === 'function') {
          Quagga.offDetected();
        }
        Quagga.stop();
      }
    } catch (error) {
      console.error('Error stopping Quagga:', error);
    }
  };

  // Initialize Quagga barcode scanner
  const initQuagga = () => {
    if (!cameraSupported) {
      console.error('Camera not supported on this device');
      setError('Camera is not supported on this device. Please use manual entry.');
      setShowScanner(false);
      return;
    }

    if (!Quagga) {
      console.error('Quagga library is not available');
      setError('Camera scanning is not available. Please use manual entry.');
      setShowScanner(false);
      return;
    }

    if (scannerRef.current) {
      // Make sure any existing Quagga instance is properly cleaned up
      try {
        // First check if Quagga has an active instance
        const hasActiveInstance = Quagga._isInitialized ||
                                (Quagga._inputStream && Quagga._inputStream.constraints) ||
                                (Quagga._canvas && Quagga._canvas.ctx);

        if (hasActiveInstance && typeof Quagga.stop === 'function') {
          // Properly clean up event listeners first
          if (typeof Quagga.offDetected === 'function') {
            Quagga.offDetected();
          }
          Quagga.stop();
        }
      } catch (error) {
        console.error('Error stopping Quagga before init:', error);
        // Continue anyway as we'll reinitialize
      }

      try {

        Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: { min: 640 },
            height: { min: 480 },
            // Use the selected camera facing mode
            facingMode: cameraFacingMode,
            aspectRatio: { min: 1, max: 2 }
          },
        },
        locator: {
          patchSize: "large", // Changed from "medium" to "large" for better accuracy
          halfSample: false // Changed to false for better quality
        },
        numOfWorkers: 4, // Increased workers for better performance
        frequency: 5, // Reduced frequency to prevent too many detections
        decoder: {
          readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
        },
        locate: true,
        // Enable multiple detection for stickers with multiple codes
        multiple: true, // Allow detection of multiple codes
        debug: false // Disable debug mode for production
      }, function(err) {
        if (err) {
          console.error("Quagga initialization error:", err);
          setError("Camera initialization failed. Please try again or use manual entry.");
          return;
        }
        
        
        try {
          // Start Quagga scanner
          Quagga.start();
          
          // Register detected barcode handler
          Quagga.offDetected(handleQuaggaDetection);
          Quagga.onDetected(handleQuaggaDetection);
        } catch (error) {
          console.error("Quagga start error:", error);
          setError("Camera initialization failed. Please try again or use manual entry.");
        }
      });
      } catch (error) {
        console.error("Error in Quagga initialization:", error);
        setError("Camera initialization failed. Please try again or use manual entry.");
      }
    }
  };

  // Handle barcode detection from Quagga
  const handleQuaggaDetection = useCallback((result) => {
    try {
      // Prevent multiple simultaneous scans
      if (isProcessingScan) {
        return;
      }

      if (!result || !result.codeResult) {
        console.error("Invalid barcode detection result");
        return;
      }

      const detectedBarcode = result.codeResult.code;
      const confidence = result.codeResult.confidence || 0;
      const format = result.codeResult.format || 'unknown';

      // Only log every 10th detection to reduce console spam
      if (Math.random() < 0.1) {
      }

      // Validate basic requirements
      if (!detectedBarcode || detectedBarcode.trim().length === 0) {
        console.error("Empty code detected");
        return;
      }

      // Basic code format validation
      if (!/^[A-Za-z0-9\-_]+$/.test(detectedBarcode) || detectedBarcode.length < 3 || detectedBarcode.length > 100) {
        console.error("Invalid code format detected:", detectedBarcode);
        return;
      }

      // Check if we already have this code to avoid duplicates
      const existingCodes = detectedCodes.filter(c => c.code === detectedBarcode);
      if (existingCodes.length > 0) {
        // Update confidence if this detection has higher confidence
        if (confidence > existingCodes[0].confidence) {
          const updatedCodes = detectedCodes.map(c =>
            c.code === detectedBarcode ? { ...c, confidence: confidence } : c
          );
          setDetectedCodes(updatedCodes);
        }
        return; // Don't process duplicate
      }

      // For zero confidence, we'll still collect the code but mark it as low confidence
      // This prevents the infinite loop while still allowing user selection
      const effectiveConfidence = confidence === 0 ? 0.1 : confidence; // Give zero confidence a small boost

      // Determine code type priority (QR codes have higher priority than barcodes)
      const isQR = format.includes('qr') || format.includes('QR') || detectedBarcode.length > 20;
      const codeType = isQR ? 'qr' : 'barcode';

      // Create code object
      const codeObject = {
        code: detectedBarcode,
        format: format,
        type: codeType,
        confidence: effectiveConfidence,
        originalConfidence: confidence, // Keep original for display
        timestamp: Date.now()
      };

      // Add to detected codes
      const newDetectedCodes = [...detectedCodes, codeObject];
      setDetectedCodes(newDetectedCodes);

      // Set processing state to prevent further detections during collection
      setIsProcessingScan(true);

      // Wait a bit to collect more codes, then process
      setTimeout(() => {
        processDetectedCodes(newDetectedCodes);
      }, 2000); // Increased to 2 seconds to collect more codes

    } catch (error) {
      console.error("Error in code detection handler:", error);
      setIsProcessingScan(false);
      setError("Error processing code. Please try again.");
    }
  }, [isProcessingScan, detectedCodes]);

  // Process collected codes and determine which one to use
  const processDetectedCodes = (codes) => {
    if (codes.length === 0) {
      setIsProcessingScan(false);
      return;
    }

    // Sort by confidence and priority (QR > Barcode)
    const sortedCodes = codes.sort((a, b) => {
      // First prioritize by type (QR codes first)
      if (a.type === 'qr' && b.type !== 'qr') return -1;
      if (b.type === 'qr' && a.type !== 'qr') return 1;

      // Then by confidence (use original confidence for sorting)
      return b.originalConfidence - a.originalConfidence;
    });


    // Filter out codes with extremely low confidence (but keep zero confidence ones)
    const validCodes = sortedCodes.filter(c => c.originalConfidence >= 0);

    if (validCodes.length === 0) {
      setIsProcessingScan(false);
      setError("No valid codes detected. Please try again or use manual entry.");
      return;
    }

    // If we have any codes with reasonable confidence (> 0.85), prefer those
    const goodCodes = validCodes.filter(c => c.originalConfidence > 0.85);

    if (goodCodes.length > 0) {
      // Use good confidence codes
      if (goodCodes.length === 1) {
        selectCode(goodCodes[0]);
      } else {
        setDetectedCodes(goodCodes);
        setShowCodeSelection(true);
        setIsProcessingScan(false);
      }
    } else {
      // All codes have low/zero confidence, but still show them for selection
      setDetectedCodes(validCodes);
      setShowCodeSelection(true);
      setIsProcessingScan(false);
    }
  };

  // Handle code selection from the modal
  const selectCode = (selectedCode) => {

    // Set the selected barcode
    setBarcode(selectedCode.code);

    // Close modals
    setShowCodeSelection(false);
    setShowScanner(false);

    // Clear detected codes
    setDetectedCodes([]);

    // Stop Quagga
    try {
      const hasActiveInstance = Quagga && (Quagga._isInitialized ||
                              (Quagga._inputStream && Quagga._inputStream.constraints) ||
                              (Quagga._canvas && Quagga._canvas.ctx));

      if (hasActiveInstance && typeof Quagga.stop === 'function') {
        if (typeof Quagga.offDetected === 'function') {
          Quagga.offDetected(handleQuaggaDetection);
        }
        Quagga.stop();
      }
    } catch (error) {
      console.error("Error stopping Quagga:", error);
    }

    // Automatically submit the form after a short delay
    setTimeout(() => {
      handleScan({ preventDefault: () => {} }).finally(() => {
        setIsProcessingScan(false);
      });
    }, 500);
  };

  // Cancel code selection
  const cancelCodeSelection = () => {
    setShowCodeSelection(false);
    setDetectedCodes([]);
    setIsProcessingScan(false);
  };

  // Handle barcode input change
  const handleBarcodeChange = (e) => {
    setBarcode(e.target.value);
    setError(null);
  };

  // Handle action selection change
  const handleActionChange = (e) => {
    setAction(e.target.value);
    setError(null);
  };

  const handlePoPrefixChange = (prefix) => {
    setPoPrefix(prefix);
    setError(null);
  };

  const handlePoNumberChange = (e) => {
    const value = e.target.value;
    const trimmed = String(value || '').trim();
    const match = trimmed.match(/^([A-Za-z]+)-(.+)$/);
    if (match) {
      setPoPrefix(match[1].toUpperCase());
      setPoNumber(match[2]);
    } else {
      setPoNumber(value);
    }
    setError(null);
  };

  // Process single carton scan
  const handleSingleScan = async (barcodeToScan, actionToUse) => {
    try {
      const normalizedPo = normalizeExpectedPo(expectedPo);
      
      // Prepare request data
      const requestData = {
        barcode: barcodeToScan,
        action: actionToUse,
        expected_po: normalizedPo || undefined
      };
      
      if (activeTruck && actionToUse === 'exit' && !exitWithoutTruck) {
        requestData.truck_shipment_id = activeTruck.id;
        requestData.notes = `Loaded to ${activeTruck.truck_reg}`;
      }
      
      const response = await axios.post(`${API_BASE_URL}/scan.php`, requestData);

      // Some servers might still return 200 with success=false; handle here
      if (!response.data?.success) {
        const fauxErr = { response: { data: { message: response.data?.message || 'Scan failed', error_code: response.data?.error_code || 'UNKNOWN' } } };
        throw fauxErr;
      }
      
      // Track processing time if available
      if (response.data.processing_time_ms) {
        setProcessingTimes(prev => [...prev.slice(-9), response.data.processing_time_ms]);
      }

      // Handle successful scan
      setScanResult({
        success: true,
        message: response.data.message,
        carton: response.data.carton
      });

      // Play success sound
      playSuccessSound();
      vibrate([40]);
      
      // Increment session counters
      setSessionScanCount(prev => prev + 1);
      const units = parseInt(response.data.carton?.units || 0);
      if (units > 0) {
        setSessionUnitCount(prev => prev + units);
      }
      
      // Trigger pulse animation
      setCounterPulse(true);
      setTimeout(() => setCounterPulse(false), 300);
      
      // Add to recent scans list (keep last 10) - store with PO number
      setRecentScans(prevScans => [
        {
          barcode: barcodeToScan,
          action: actionToUse,
          po_number: normalizedPo,
          timestamp: new Date().toLocaleTimeString(),
          fullTimestamp: new Date().toISOString(),
          success: true,
          processingTime: response.data.processing_time_ms
        },
        ...prevScans.slice(0, 9)
      ]);
      
      // Save scan history to localStorage for persistence
      try {
        const scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        scanHistory.unshift({
          barcode: barcodeToScan,
          action: actionToUse,
          po_number: normalizedPo,
          timestamp: new Date().toISOString(),
          success: true
        });
        // Keep last 100 scans
        localStorage.setItem('scanHistory', JSON.stringify(scanHistory.slice(0, 100)));
      } catch (e) {
        console.error('Failed to save scan history:', e);
      }
      
      // Immediately refresh shared PO progress so this scanner shows the updated count.
      fetchPoProgress();

      return { success: true, message: response.data.message };
    } catch (err) {
      console.error('Scan error:', err);
      const errorMessage = err.response?.data?.message || 'An error occurred during scanning. Please try again.';
      const errorCode = err.response?.data?.error_code || 'UNKNOWN';
      
      // Set error state for UI display
      setError(errorMessage);

      // Distinct sounds for specific errors
      if (errorCode === 'WRONG_PO') {
        playWrongPoSound();
        vibrate([250]);
      } else if (errorCode === 'DUPLICATE') {
        playDuplicateSound();
        vibrate([80, 80, 80]);
      } else if (errorCode === 'NOT_FOUND') {
        playNotFoundSound();
        vibrate([120, 80, 120]);
      } else {
        playErrorSound();
        vibrate([160, 80, 160]);
      }
      
      // Add failed scan to recent scans list
      setRecentScans(prevScans => [
        {
          barcode: barcodeToScan,
          action: actionToUse,
          po_number: expectedPo,
          timestamp: new Date().toLocaleTimeString(),
          fullTimestamp: new Date().toISOString(),
          success: false,
          error: errorMessage
        },
        ...prevScans.slice(0, 9)
      ]);
      
      // Save failed scan to history
      try {
        const scanHistory = JSON.parse(localStorage.getItem('scanHistory') || '[]');
        scanHistory.unshift({
          barcode: barcodeToScan,
          action: actionToUse,
          po_number: expectedPo,
          timestamp: new Date().toISOString(),
          success: false,
          error: errorMessage
        });
        localStorage.setItem('scanHistory', JSON.stringify(scanHistory.slice(0, 100)));
      } catch (e) {
        console.error('Failed to save scan history:', e);
      }
      
      // Throw the error to be caught by the batch handler
      throw err;
    }
  };
  
  // Process batch of barcodes
  const handleBatchScan = async (barcodeList, actionToUse) => {
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    try {
      for (const code of barcodeList) {
        if (!code.trim()) continue;
        
        try {
          const result = await handleSingleScan(code.trim(), actionToUse);
          results.push({
            barcode: code.trim(),
            success: result.success,
            message: result.message
          });
          
          if (result.success) successCount++;
          else failCount++;
        } catch (err) {
          console.error('Error processing barcode:', code, err);
          results.push({
            barcode: code.trim(),
            success: false,
            message: err.response?.data?.message || 'Failed to process barcode'
          });
          failCount++;
        }
      }
      
      // Set overall result message
      setScanResult({
        success: successCount > 0,
        message: `Batch processing complete: ${successCount} successful, ${failCount} failed`,
        batchResults: results
      });
      
      return results;
    } catch (err) {
      console.error('Batch processing error:', err);
      setError('Failed to process batch scan');
      return [];
    }
  };
  
  // Main scan handler
  const handleScan = async (e) => {
    e.preventDefault();

    // Prevent multiple simultaneous scans
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    const normalizedPo = normalizeExpectedPo(expectedPo);

    if (!normalizedPo) {
      setError('Please enter the PO number before scanning.');
      setLoading(false);
      return;
    }
    if (!poValidation.checked || !poValidation.exists || !poValidation.allowed) {
      setError(poValidation.summary || 'This PO cannot be scanned for the selected action.');
      setLoading(false);
      return;
    }
    
    try {
      if (batchMode) {
        // Process batch mode
        if (!barcodes.trim()) {
          setError('Please enter at least one barcode');
          setLoading(false);
          return;
        }
        
        const barcodeList = barcodes.split('\n').filter(code => code.trim());
        const actionToUse = action;
        
        // Clear barcodes input immediately for next batch
        setBarcodes('');
        
        await handleBatchScan(barcodeList, actionToUse);
      } else {
        // Process single barcode
        if (!barcode.trim()) {
          setError('Please enter a barcode');
          setLoading(false);
          return;
        }
        
        const barcodeToScan = barcode.trim();
        const actionToUse = action;
        
        // Clear barcode input immediately for next scan
        setBarcode('');
        
        await handleSingleScan(barcodeToScan, actionToUse);
      }
    } catch (err) {
      console.error('Scan processing error:', err);
      setError('An unexpected error occurred during scanning.');
    } finally {
      setLoading(false);
      
      // Refocus on barcode input after scan completes
      setTimeout(() => {
        if (barcodeInputRef.current) {
          barcodeInputRef.current.focus();
        }
      }, 100);
    }
  };

  // Get CSS class for scan result status
  const getScanStatusClass = (scan) => {
    return scan.success ? 'table-success' : 'table-danger';
  };

  // Handle switching between front and rear cameras
  const handleCameraSwitch = () => {
    // Toggle camera facing mode
    const newMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
    setCameraFacingMode(newMode);
    
    // Restart Quagga with new camera
    if (typeof Quagga.stop === 'function') {
      try {
        Quagga.stop();
      } catch (error) {
        console.error('Error stopping Quagga for camera switch:', error);
      }
    }
    
    // Short delay before reinitializing
    setTimeout(() => {
      initQuagga();
    }, 500);
  };

  return (
    <div className="py-2">
      {/* Floating Scan Counter */}
      <div 
        style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: sessionScanCount > 0 ? '#ffffff' : '#f8f9fa',
          color: '#212529',
          padding: '15px 20px',
          borderRadius: '12px',
          border: sessionScanCount > 0 ? '2px solid #28a745' : '2px solid #dee2e6',
          boxShadow: counterPulse 
            ? '0 6px 20px rgba(40, 167, 69, 0.3)' 
            : '0 4px 12px rgba(0,0,0,0.1)',
          minWidth: '180px',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          transform: counterPulse ? 'scale(1.05)' : 'scale(1)'
        }}
        onClick={() => {
          if (window.confirm(`Reset session counter?\n\nCurrent: ${sessionScanCount} cartons, ${sessionUnitCount} units`)) {
            setSessionScanCount(0);
            setSessionUnitCount(0);
          }
        }}
        title="Click to reset counter"
      >
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <div style={{ fontSize: '10px', fontWeight: '600', color: '#6c757d', marginBottom: '4px', letterSpacing: '0.5px' }}>
              SESSION CARTONS
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', lineHeight: 1, color: sessionScanCount > 0 ? '#28a745' : '#6c757d' }}>
              {sessionScanCount}
            </div>
            <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '4px' }}>
              {sessionUnitCount} units
            </div>
          </div>
          <div style={{ fontSize: '32px', marginLeft: '15px', color: sessionScanCount > 0 ? '#28a745' : '#6c757d' }}>
            <i className="bi bi-box-seam"></i>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h1 className="text-gradient mb-0">Carton Scanner</h1>
      </div>
      
      {/* Active Truck Banner */}
      {(activeTrucks.length > 0 || (action === 'exit' && exitWithoutTruck)) && (
        <div className="alert alert-success mb-4">
          <div className="d-flex flex-wrap justify-content-between align-items-start gap-2">
            <div className="flex-grow-1">
              <i className="bi bi-truck me-2"></i>
              {exitWithoutTruck && !activeTruck ? (
                <strong>Exit mode — no truck assignment</strong>
              ) : (
                <>
                  <strong>Loading to: {activeTruck?.truck_reg}</strong>
                  <br />
                  <small>Driver: {activeTruck?.driver_name}</small>
                  {activeTrucks.length > 1 && (
                    <div className="mt-2">
                      <label className="small text-muted me-2">Switch truck:</label>
                      <select
                        className="form-select form-select-sm d-inline-block w-auto"
                        value={activeTruck?.id || ''}
                        onChange={(e) => {
                          const truck = activeTrucks.find((t) => String(t.id) === e.target.value);
                          if (truck) {
                            setActiveTruck(truck);
                            setExitWithoutTruck(false);
                          }
                        }}
                      >
                        {activeTrucks.map((t) => (
                          <option key={t.id} value={t.id}>{t.truck_reg} — {t.driver_name}</option>
                        ))}
                      </select>
                      <small className="text-muted ms-2">({activeTrucks.length} open trucks)</small>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="d-flex gap-2 flex-wrap">
              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowTruckChoiceModal(true)}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add / switch truck
              </button>
              {activeTruck && (
                <button
                  type="button"
                  className="btn btn-sm btn-success"
                  onClick={handleFinishLoading}
                >
                  <i className="bi bi-check-circle me-1"></i>
                  Finish loading
                </button>
              )}
              {activeTruck && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-warning"
                  onClick={() => {
                    if (window.confirm(`Park truck ${activeTruck.truck_reg}? You can start another truck while this one stays open.`)) {
                      const remaining = removeActiveTruck(activeTruck.id);
                      setActiveTrucks(remaining);
                      setActiveTruck(remaining.length ? remaining[remaining.length - 1] : null);
                      if (remaining.length === 0) {
                        setAction('');
                        setExitWithoutTruck(false);
                      }
                      setScanResult({
                        success: true,
                        message: `Truck ${activeTruck.truck_reg} parked — still open in Truck Summary.`
                      });
                    }
                  }}
                >
                  Park truck
                </button>
              )}
            </div>
          </div>
          <small className="text-muted d-block mt-2">
            Trucks do not need to be fully loaded. Park when done for now and load another truck anytime.
          </small>
        </div>
      )}
      
      <div className="row g-3 g-md-4">
        {/* Scan Form */}
        <div className="col-12 col-lg-6 mb-4">
          <div className="modern-card">
            <div className="modern-card-header">
              <h5 className="mb-0"><i className="bi bi-upc-scan me-2"></i>Scan Carton</h5>
            </div>
            <div className="modern-card-body">
              <form onSubmit={handleScan}>
                <div className="mb-4">
                  {/* PO must be above barcode */}
                  <div className="mb-3">
                    <label className="form-label-modern">
                      <i className="bi bi-receipt me-1"></i>PO Number (required)
                    </label>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {['FTM', 'OTTO', 'OBSW'].map((prefix) => (
                        <Form.Check
                          key={prefix}
                          type="radio"
                          id={`po-prefix-${prefix.toLowerCase()}`}
                          name="poPrefix"
                          label={prefix}
                          checked={poPrefix === prefix}
                          onChange={() => handlePoPrefixChange(prefix)}
                          disabled={loading}
                          className="me-2"
                        />
                      ))}
                    </div>
                    <div className="input-group">
                      <span className="input-group-text">{poPrefix}-</span>
                      <input
                        ref={poInputRef}
                        type="text"
                        className={`form-control-modern ${getPoInputClass()}`}
                        placeholder="Enter number only, e.g. 1234"
                        value={poNumber}
                        onChange={handlePoNumberChange}
                        disabled={loading}
                        autoComplete="off"
                      />
                    </div>
                    <div className="small mt-1">
                      {expectedPo ? (
                        poValidation.checked ? (
                          <span className={`text-${getPoFeedbackTone()}`}>
                            <i className={`bi ${renderPoFeedbackIcon()} me-1`}></i>
                            {poValidation.summary}
                            {!action && poValidation.exists && poValidation.status !== 'fully_shipped' && poValidation.status !== 'not_found' && (
                              <span className="d-block mt-1 text-muted">
                                Select Enter or Exit Warehouse to continue scanning.
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-muted">Validating PO...</span>
                        )
                      ) : (
                        <span className="text-muted">Choose a prefix, then type the number. Example: FTM-1234.</span>
                      )}
                    </div>

                  {/* Shared multi-scanner progress — visible to all scanners on this PO */}
                  {poProgress && poProgress.total > 0 && (
                    <div className="mt-2 mb-1">
                      <div className="d-flex justify-content-between align-items-center mb-1">
                        <small className="text-muted fw-semibold">
                          <i className="bi bi-people me-1"></i>All scanners — {poProgress.po}
                        </small>
                        <small className="text-muted">
                          {poProgress.exited} / {poProgress.total} exited
                        </small>
                      </div>
                      <ProgressBar style={{ height: '10px' }}>
                        <ProgressBar
                          variant="success"
                          now={Math.round((poProgress.exited / poProgress.total) * 100)}
                          key="exited"
                          title={`${poProgress.exited} exited`}
                        />
                        <ProgressBar
                          variant="primary"
                          now={Math.round((poProgress.entered / poProgress.total) * 100)}
                          key="entered"
                          title={`${poProgress.entered} entered`}
                        />
                        <ProgressBar
                          variant="secondary"
                          now={Math.round((poProgress.pending / poProgress.total) * 100)}
                          key="pending"
                          title={`${poProgress.pending} pending`}
                        />
                      </ProgressBar>
                      <div className="d-flex gap-3 mt-1">
                        <small className="text-success"><span className="fw-bold">{poProgress.exited}</span> exited</small>
                        <small className="text-primary"><span className="fw-bold">{poProgress.entered}</span> in warehouse</small>
                        <small className="text-muted"><span className="fw-bold">{poProgress.pending}</span> pending</small>
                      </div>
                    </div>
                  )}
                  </div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <label className="form-label-modern">
                      <i className="bi bi-barcode me-1"></i>Barcode
                    </label>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="batchModeSwitch"
                        checked={batchMode}
                        onChange={() => setBatchMode(!batchMode)}
                        disabled={loading}
                      />
                      <label className="form-check-label" htmlFor="batchModeSwitch">
                        Batch Mode {batchMode && <span className="badge-modern badge-modern-info">Faster</span>}
                      </label>
                    </div>
                  </div>
                  
                  {!batchMode ? (
                    // Single barcode input
                    <div className="d-flex gap-2">
                      <div className="flex-grow-1 position-relative">
                        <i className="bi bi-qr-code-scan position-absolute" style={{left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}}></i>
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          className="form-control-modern ps-5"
                          placeholder="Scan or enter barcode"
                          value={barcode}
                          onChange={handleBarcodeChange}
                          disabled={loading || !poValidation.checked || !poValidation.exists || !poValidation.allowed}
                          autoComplete="off"
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn-modern ${cameraSupported ? 'btn-modern-secondary' : 'btn-modern-outline-secondary'}`}
                        onClick={() => setShowScanner(true)}
                        disabled={loading || !cameraSupported || !poValidation.checked || !poValidation.exists || !poValidation.allowed}
                        title={!cameraSupported ? (cameraErrorReason || 'Camera not available') : 'Scan barcode with camera'}
                      >
                        <i className={`bi ${cameraSupported ? 'bi-camera' : 'bi-camera-slash'}`}></i>
                        <span className="d-none d-sm-inline ms-1">
                          {cameraSupported ? 'Scan' : 'Camera Unavailable'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    // Batch input textarea
                    <div className="position-relative">
                      <textarea
                        className="form-control-modern"
                        placeholder="Enter multiple barcodes (one per line)"
                        value={barcodes}
                        onChange={(e) => setBarcodes(e.target.value)}
                        rows="4"
                        disabled={loading || !poValidation.checked || !poValidation.exists || !poValidation.allowed}
                      />
                    </div>
                  )}
                  
                  <div className="text-muted small mt-1">
                    {!batchMode ? "Use barcode scanner or use your device's camera to scan" : "Enter multiple barcodes, one per line"}
                    {processingTimes.length > 0 && (
                      <span className="ms-2">
                        Avg. processing time: {(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length).toFixed(2)} ms
                      </span>
                    )}
                  </div>

                  <div className="text-muted small mt-1">Only cartons belonging to the above PO will be accepted</div>

                  {!cameraSupported && cameraErrorReason && (
                    <div className="alert-modern alert-modern-warning mt-2">
                      <i className="bi bi-exclamation-triangle"></i>
                      <div>
                        <strong>Camera Unavailable:</strong> {cameraErrorReason}
                        <div className="mt-1 small">
                          {isHttpsRequired ? (
                            <>
                              <strong>For mobile devices:</strong> Camera access requires HTTPS. Please access via HTTPS or use manual entry.
                              <br />
                              <strong>Local network access:</strong> If accessing from the same network, try using the local IP address with HTTPS.
                            </>
                          ) : (
                            "Please use manual entry or check your camera permissions."
                          )}
                        </div>
                        <div className="mt-2">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-2"
                            onClick={async () => {
                              const result = await detectCameraSupport();
                              setCameraSupported(result.supported);
                              setCameraErrorReason(result.reason);
                              setIsHttpsRequired(result.isHttpsRequired || false);
                              if (result.supported) {
                                setError(null);
                              }
                            }}
                          >
                            <i className="bi bi-arrow-clockwise me-1"></i>
                            Test Camera Again
                          </button>
                          <small className="text-muted">
                            Click to retry camera detection. Make sure to allow camera permissions when prompted.
                          </small>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mb-4">
                  <label className="form-label-modern">
                    <i className="bi bi-arrow-left-right me-1"></i>Action
                  </label>
                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className={`flex-grow-1 py-3 ${action === 'enter' ? 'btn-modern btn-modern-primary' : 'btn-modern btn-modern-outline-secondary'}`}
                      onClick={() => {
                        if (loading) return;
                        setExitWithoutTruck(false);
                        setAction('enter');
                      }}
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
                    >
                      <i className="bi bi-box-arrow-in-down me-2 fs-5"></i>
                      <div className="fs-6 fw-medium">Enter Warehouse</div>
                    </button>
                    <button
                      type="button"
                      className={`flex-grow-1 py-3 ${action === 'exit' ? 'btn-modern btn-modern-success' : 'btn-modern btn-modern-outline-secondary'}`}
                      onClick={() => {
                        if (loading) return;
                        setShowTruckChoiceModal(true);
                      }}
                      style={{ cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
                    >
                      <i className="bi bi-box-arrow-right me-2 fs-5"></i>
                      <div className="fs-6 fw-medium">Exit Warehouse</div>
                    </button>
                  </div>
                  {action === 'exit' && (
                    <div className="alert alert-info mt-2 py-2 px-3 small mb-0">
                      <i className="bi bi-info-circle me-1"></i>
                      {activeTruck
                        ? <>Loading to <strong>{activeTruck.truck_reg}</strong>. Use &quot;Add / switch truck&quot; for another truck or park when partially loaded.</>
                        : exitWithoutTruck
                          ? <>Exiting without truck assignment. Use &quot;Add / switch truck&quot; to load onto a truck.</>
                          : <>Choose a truck or exit mode using the options above.</>}
                    </div>
                  )}
                  {action && normalizedPo && poValidation.checked && !poValidation.allowed && (
                    <div className={`alert mt-2 py-2 px-3 small mb-0 ${poValidation.status === 'fully_shipped' || !poValidation.exists ? 'alert-danger' : 'alert-warning'}`}>
                      <i className={`bi ${poValidation.status === 'fully_shipped' || !poValidation.exists ? 'bi-x-circle' : 'bi-exclamation-triangle'} me-1`}></i>
                      {poValidation.summary}
                    </div>
                  )}
                </div>
                
                <div className="d-grid">
                  <button 
                    type="submit" 
                    className="btn-modern btn-modern-primary py-3"
                    disabled={
                      loading ||
                      !action ||
                      (batchMode ? !barcodes.trim() : !barcode.trim()) ||
                      !normalizedPo ||
                      !poValidation.checked || !poValidation.exists || !poValidation.allowed
                    }
                  >
                    {loading ? (
                      <>
                        <div className="loading-spinner-modern me-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i> Process Scan
                      </>
                    )}
                  </button>
                  {!action && (
                    <small className="text-muted text-center mt-2">
                      <i className="bi bi-info-circle me-1"></i>
                      Please select an action (Enter or Exit Warehouse)
                    </small>
                  )}
                </div>
              </form>
            </div>
          </div>
          
          {error && (
            <div className="alert-modern alert-modern-danger mt-3">
              <i className="bi bi-exclamation-triangle-fill"></i>
              <div>
                <strong>Scan Failed</strong>
                <div className="mt-1">{error}</div>
              </div>
            </div>
          )}
          
          {scanResult?.success && (
            <div className="alert-modern alert-modern-success mt-3">
              <i className="bi bi-check-circle-fill"></i>
              <div className="flex-grow-1">
                <strong>Scan Successful!</strong>
                <div className="mt-2">{scanResult.message}</div>
                
                {/* Show batch results if available */}
                {scanResult.batchResults && scanResult.batchResults.length > 0 ? (
                  <div className="mt-3">
                    <div className="modern-card bg-light border-0 mb-3">
                      <div className="modern-card-body">
                        <h6 className="mb-3">Batch Results</h6>
                        <div className="table-responsive">
                          <table className="table table-sm">
                            <thead>
                              <tr>
                                <th>Barcode</th>
                                <th>Status</th>
                                <th>Message</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scanResult.batchResults.map((result, index) => (
                                <tr key={index} className={result.success ? 'table-success' : 'table-danger'}>
                                  <td>{result.barcode}</td>
                                  <td>
                                    {result.success ? (
                                      <span className="badge-modern badge-modern-success">Success</span>
                                    ) : (
                                      <span className="badge-modern badge-modern-danger">Failed</span>
                                    )}
                                  </td>
                                  <td>{result.message}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : scanResult.carton && (
                  <div className="mt-3">
                    <div className="modern-card bg-light border-0 mb-3">
                      <div className="modern-card-body">
                        <h6 className="mb-3">Carton Details</h6>
                        <div className="row g-3">
                          <div className="col-md-6">
                            <div className="d-flex align-items-center">
                              <i className="bi bi-upc me-2 text-muted"></i>
                              <div>
                                <div className="small text-muted">Barcode</div>
                                <div className="fw-bold">{scanResult.carton.barcode}</div>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="d-flex align-items-center">
                              <i className="bi bi-tag me-2 text-muted"></i>
                              <div>
                                <div className="small text-muted">Status</div>
                                <span className={`badge-modern ${
                                  scanResult.carton.status === 'entered' ? 'badge-modern-primary' : 
                                  scanResult.carton.status === 'exited' ? 'badge-modern-success' : 'badge-modern-info'
                                }`}>
                                  {scanResult.carton.status === 'entered' ? 'In Warehouse' : 
                                   scanResult.carton.status === 'exited' ? 'Shipped' : 'Pending'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="d-flex align-items-center">
                              <i className="bi bi-rulers me-2 text-muted"></i>
                              <div>
                                <div className="small text-muted">Size</div>
                                <div>{scanResult.carton.size || 'N/A'}</div>
                              </div>
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="d-flex align-items-center">
                              <i className="bi bi-box-seam me-2 text-muted"></i>
                              <div>
                                <div className="small text-muted">PO Number</div>
                                <div>{scanResult.carton.po_number}</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="d-flex justify-content-end">
                      <Link 
                        to={`/manual-entry?barcode=${scanResult.carton.barcode}`}
                        className="btn-modern btn-modern-primary"
                      >
                        <i className="bi bi-pencil-square"></i> Update Carton Data
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Recent Scans */}
        <div className="col-12 col-lg-6">
          <div className="modern-card mb-4">
            <div className="modern-card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0"><i className="bi bi-clock-history me-2"></i>Recent Scans</h5>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className={`btn btn-sm ${showAllHistory ? 'btn-primary' : 'btn-outline-primary'}`}
                  onClick={() => setShowAllHistory(!showAllHistory)}
                  title="Show all scan history"
                >
                  <i className="bi bi-archive"></i>
                </button>
              </div>
            </div>
            <div className="modern-card-body p-0">
              {/* Search/Filter */}
              <div className="p-3 border-bottom">
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="Search by barcode, FTM PO, or Customer PO..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {(() => {
                // Get scans to display
                let scansToShow = showAllHistory 
                  ? JSON.parse(localStorage.getItem('scanHistory') || '[]').map(scan => ({
                      ...scan,
                      timestamp: new Date(scan.timestamp).toLocaleTimeString(),
                      fullTimestamp: scan.timestamp
                    }))
                  : recentScans;
                
                // Filter by search term
                if (searchTerm.trim()) {
                  scansToShow = scansToShow.filter(scan => 
                    scan.barcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    scan.po_number?.toLowerCase().includes(searchTerm.toLowerCase())
                  );
                }
                
                // Filter by current PO if one is selected
                if (normalizedPo && !showAllHistory) {
                  scansToShow = scansToShow.filter(scan => 
                    poMatches(scan.po_number, normalizedPo)
                  );
                }
                
                return scansToShow.length > 0 ? (
                  <div className="table-responsive">
                    <table className="table-modern mb-0">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Barcode</th>
                          <th className="d-none d-md-table-cell">PO</th>
                          <th>Action</th>
                          <th>Status</th>
                          <th className="d-none d-lg-table-cell">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scansToShow.slice(0, showAllHistory ? 50 : 10).map((scan, index) => (
                          <tr key={index}>
                            <td>
                              <small className="text-muted">{scan.timestamp}</small>
                            </td>
                            <td>
                              <span className="fw-medium">{scan.barcode}</span>
                            </td>
                            <td className="d-none d-md-table-cell">
                              <small className="text-muted">{scan.po_number || 'N/A'}</small>
                            </td>
                            <td>
                              {scan.action === 'enter' ? (
                                <span className="badge-modern badge-modern-primary">
                                  <i className="bi bi-box-arrow-in-down"></i>
                                  <span className="d-none d-md-inline ms-1">Enter</span>
                                </span>
                              ) : (
                                <span className="badge-modern badge-modern-success">
                                  <i className="bi bi-box-arrow-right"></i>
                                  <span className="d-none d-md-inline ms-1">Exit</span>
                                </span>
                              )}
                            </td>
                            <td>
                              {scan.success ? (
                                <span className="badge-modern badge-modern-success">
                                  <i className="bi bi-check-circle"></i>
                                  <span className="d-none d-lg-inline ms-1">Success</span>
                                </span>
                              ) : (
                                <span className="badge-modern badge-modern-danger">
                                  <i className="bi bi-x-circle"></i>
                                  <span className="d-none d-lg-inline ms-1">Failed</span>
                                </span>
                              )}
                            </td>
                            <td className="d-none d-lg-table-cell">
                              {!scan.success && scan.error && (
                                <small className="text-danger">{scan.error}</small>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-5">
                    <i className="bi bi-inbox fs-1 text-muted"></i>
                    <p className="text-muted mt-2">
                      {searchTerm.trim() ? 'No scans match your search' : 'No recent scans'}
                    </p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      
      {/* Instructions */}
      <div className="modern-card mt-4">
        <div className="modern-card-header">
          <h5 className="mb-0"><i className="bi bi-info-circle me-2"></i>Scanner Instructions</h5>
        </div>
        <div className="modern-card-body">
          <h6 className="mb-3">How to Use the Carton Scanner</h6>
          <div className="d-flex mb-3">
            <div className="me-3">
              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                1
              </div>
            </div>
            <div>
              <p className="mb-0"><strong>Select Action</strong></p>
              <p className="text-muted small">Choose whether the carton is entering or exiting the warehouse</p>
            </div>
          </div>
          <div className="d-flex mb-3">
            <div className="me-3">
              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                2
              </div>
            </div>
            <div>
              <p className="mb-0"><strong>Scan Barcode</strong></p>
              <p className="text-muted small">Use your phone's camera or barcode scanner</p>
            </div>
          </div>
          <div className="d-flex mb-3">
            <div className="me-3">
              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                3
              </div>
            </div>
            <div>
              <p className="mb-0"><strong>Process Scan</strong></p>
              <p className="text-muted small">Click the "Process Scan" button or press Enter</p>
            </div>
          </div>
          <div className="d-flex mb-3">
            <div className="me-3">
              <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{width: '30px', height: '30px'}}>
                4
              </div>
            </div>
            <div>
              <p className="mb-0"><strong>Verify Result</strong></p>
              <p className="text-muted small">Check that the scan was successful and review carton details</p>
            </div>
          </div>
          <div className="alert-modern alert-modern-info mt-3">
            <i className="bi bi-lightbulb"></i>
            <div>
              <strong>Note:</strong> Cartons must be scanned when entering and exiting the warehouse.
              The system will track the carton's location and status automatically.
            </div>
          </div>
        </div>
      </div>

      {/* Camera Scanner Modal */}
      <Modal
        show={showScanner}
        onHide={() => setShowScanner(false)}
        centered
        backdrop="static"
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-camera me-2"></i>
            Scan Barcode with Camera
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="scanner-container">
            <div
              ref={scannerRef}
              className="viewport"
              style={{
                position: 'relative',
                height: '70vh',
                maxHeight: '500px',
                overflow: 'hidden'
              }}
            ></div>
            <div className="scanner-overlay" style={{
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              bottom: '0',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              pointerEvents: 'none'
            }}>
              <div style={{
                border: isProcessingScan ? '3px solid #28a745' : '2px solid #007bff',
                width: '80%',
                height: '200px',
                boxShadow: '0 0 0 5000px rgba(0, 0, 0, 0.3)',
                borderRadius: '10px',
                transition: 'border-color 0.3s ease'
              }}></div>
            </div>

            {isProcessingScan && (
              <div className="processing-overlay" style={{
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000
              }}>
                <div className="text-center text-white">
                  <div className="loading-spinner-modern mb-3" style={{width: '40px', height: '40px'}}></div>
                  <h5>Scanning for Codes...</h5>
                  {detectedCodes.length > 0 && (
                    <p className="mb-1">
                      <i className="bi bi-check-circle-fill text-success me-1"></i>
                      {detectedCodes.length} code{detectedCodes.length > 1 ? 's' : ''} detected
                    </p>
                  )}
                  <p className="mb-0 small">Keep the sticker steady</p>
                </div>
              </div>
            )}
          </div>
          <div className="text-center mt-3">
            <p className="text-muted">
              {isProcessingScan
                ? "Processing barcode detection..."
                : "Position the barcode within the blue rectangle"
              }
            </p>
            {lastScanTime > 0 && !isProcessingScan && (
              <small className="text-muted">
                Last scan: {new Date(lastScanTime).toLocaleTimeString()}
              </small>
            )}
          </div>
          <div className="d-flex justify-content-center mt-3">
            <button 
              type="button"
              className="btn-modern btn-modern-secondary"
              onClick={handleCameraSwitch}
            >
              <i className="bi bi-camera-switch"></i>
              Switch Camera ({cameraFacingMode === 'environment' ? 'Rear' : 'Front'})
            </button>
          </div>
        </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn-modern btn-modern-outline-secondary me-2"
              onClick={() => {
                // Stop scanning and show detected codes if any
                if (detectedCodes.length > 0) {
                  processDetectedCodes(detectedCodes);
                } else {
                  setShowScanner(false);
                  setIsProcessingScan(false);
                }
              }}
              disabled={!isProcessingScan && detectedCodes.length === 0}
            >
              {detectedCodes.length > 0 ? 'Stop & Select' : 'Stop Scanning'}
            </button>
            <button
              type="button"
              className="btn-modern btn-modern-secondary"
              onClick={() => {
                setShowScanner(false);
                setIsProcessingScan(false);
                setDetectedCodes([]);
              }}
            >
              Cancel
            </button>
          </Modal.Footer>
        </Modal>

        {/* Code Selection Modal */}
        <Modal
          show={showCodeSelection}
          onHide={cancelCodeSelection}
          centered
          size="lg"
        >
          <Modal.Header closeButton>
            <Modal.Title>
              <i className="bi bi-list-check me-2"></i>
              Multiple Codes Detected
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p className="text-muted mb-3">
              Multiple codes were detected on the sticker. Please select the correct one:
            </p>
            <div className="row g-3">
              {detectedCodes.map((code, index) => (
                <div key={index} className="col-12">
                  <div className="modern-card p-3">
                    <div className="d-flex justify-content-between align-items-center">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center mb-2">
                          <span className={`badge-modern me-2 ${
                            code.type === 'qr' ? 'badge-modern-primary' : 'badge-modern-secondary'
                          }`}>
                            <i className={`bi ${code.type === 'qr' ? 'bi-qr-code' : 'bi-upc'}`}></i>
                            {code.type.toUpperCase()}
                          </span>
                          <small className="text-muted">
                            {code.originalConfidence === 0
                              ? 'Low confidence'
                              : `${Math.round(code.originalConfidence * 100)}% confidence`
                            }
                          </small>
                        </div>
                        <div className="fw-bold fs-5 mb-1">{code.code}</div>
                        <small className="text-muted">Format: {code.format}</small>
                      </div>
                      <button
                        type="button"
                        className="btn-modern btn-modern-primary"
                        onClick={() => selectCode(code)}
                      >
                        <i className="bi bi-check-circle me-1"></i>
                        Select
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn-modern btn-modern-secondary"
              onClick={cancelCodeSelection}
            >
              Cancel
            </button>
          </Modal.Footer>
        </Modal>

        {/* Exit Scan Modal */}
        <TruckLoadChoiceModal
          show={showTruckChoiceModal}
          onHide={() => setShowTruckChoiceModal(false)}
          activeTrucks={activeTrucks}
          loadingTrucks={loadingOpenTrucks}
          onContinueTruck={(truck) => {
            const list = addActiveTruck(truck);
            setActiveTrucks(list);
            setActiveTruck(truck);
            setExitWithoutTruck(false);
            setAction('exit');
            setShowTruckChoiceModal(false);
            setScanResult({
              success: true,
              message: `Continuing load on ${truck.truck_reg}`
            });
          }}
          onNewTruck={() => {
            setShowTruckChoiceModal(false);
            setShowExitModal(true);
          }}
        />

        <ExitScanModal
          show={showExitModal}
          onHide={() => setShowExitModal(false)}
          onSuccess={(result) => {
            if (result.mode === 'created') {
              const list = addActiveTruck(result.truck);
              setActiveTrucks(list);
              setActiveTruck(result.truck);
              setExitWithoutTruck(false);
              setAction('exit');
              setShowExitModal(false);
              let msg = `Truck ${result.truck.truck_reg} added. Scan cartons to load (other trucks can stay open).`;
              if (result.assigned_orders?.length > 0) {
                const names = result.assigned_orders
                  .map((o) => `${o.customer} ${o.internal_po_number} (${o.cartons_shipped} ctns)`)
                  .join('; ');
                msg = `Truck ${result.truck.truck_reg} ready. ${result.assigned_orders.length} manual order(s) assigned: ${names}. You can still scan MRP cartons onto this truck.`;
              }
              if (result.assign_errors?.length > 0) {
                msg += ` Warnings: ${result.assign_errors.join('; ')}`;
              }
              setScanResult({
                success: true,
                message: msg
              });
              setTimeout(() => {
                if (barcodeInputRef.current) barcodeInputRef.current.focus();
              }, 100);
            }
          }}
        />
    </div>
  );
};

export default CartonScanner;
