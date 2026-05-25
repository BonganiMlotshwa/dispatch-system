import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UNSAFE_DataRouterContext, UNSAFE_DataRouterStateContext } from 'react-router';
import './App.css';
import './styles/modern-theme.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { AdminAuthProvider } from './contexts/AdminAuthContext';
import Sidebar from './components/Sidebar';
import ModernHeader from './components/ModernHeader';
import Footer from './components/Footer';
import Login from './pages/Login';
import { isLoggedIn } from './services/authService';
import Dashboard from './pages/Dashboard';
import FileUpload from './pages/FileUpload';
import CartonScanner from './pages/CartonScanner';
import StickerGenerator from './pages/StickerGenerator';
import XmlGenerator from './pages/XmlGenerator';
import ShipmentDetails from './pages/ShipmentDetails';
import PODetails from './pages/PODetails';
import POManagement from './pages/POManagement';
import ManualEntry from './pages/ManualEntry';
import LegacyWarehouseGoods from './pages/LegacyWarehouseGoods';
import DailySummary from './pages/DailySummary';
import TruckShipment from './pages/TruckShipment';
import TruckSummary from './pages/TruckSummary';
import EmployeeLogin from './pages/EmployeeLogin';
import Reports from './pages/Reports';
import ErrorBoundary from './components/ErrorBoundary';

// Enable React Router v7 future flags
UNSAFE_DataRouterContext.displayName = 'DataRouterContext';
UNSAFE_DataRouterStateContext.displayName = 'DataRouterStateContext';

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const [authed, setAuthed] = useState(isLoggedIn());

  useEffect(() => {
    const onAuthChange = () => setAuthed(isLoggedIn());
    window.addEventListener('auth-changed', onAuthChange);
    return () => window.removeEventListener('auth-changed', onAuthChange);
  }, []);

  return (
    <ThemeProvider>
      <AdminAuthProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        {authed ? (
          <div className="app-with-sidebar">
            <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
            <div className="main-content-with-sidebar">
              <ModernHeader toggleSidebar={toggleSidebar} />
              <main className="main-content">
                <div className="container-fluid px-3 px-md-4">
                  <ErrorBoundary>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/upload" element={<FileUpload />} />
                      <Route path="/scanner" element={<CartonScanner />} />
                      <Route path="/stickers" element={<StickerGenerator />} />
                      <Route path="/xml-generator" element={<XmlGenerator />} />
                      <Route path="/shipment/:id" element={<ShipmentDetails />} />
                      <Route path="/po/:id" element={<PODetails />} />
                      <Route path="/pos" element={<POManagement />} />
                      <Route path="/manual-entry" element={<ManualEntry />} />
                      <Route path="/legacy-warehouse" element={<LegacyWarehouseGoods />} />
                      <Route path="/daily-summary" element={<DailySummary />} />
                      <Route path="/truck-shipment" element={<TruckShipment />} />
                      <Route path="/truck-summary" element={<TruckSummary />} />
                      <Route path="/employee-login" element={<EmployeeLogin />} />
                      <Route path="/reports" element={<Reports />} />
                      <Route path="/login" element={<Dashboard />} />
                    </Routes>
                  </ErrorBoundary>
                </div>
              </main>
              <Footer />
            </div>
          </div>
        ) : (
          <main className="main-content">
            <div className="container-fluid px-3 px-md-4">
              <ErrorBoundary>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="*" element={<Login />} />
                </Routes>
              </ErrorBoundary>
            </div>
          </main>
        )}
      </Router>
      </AdminAuthProvider>
    </ThemeProvider>
  );
}

export default App;