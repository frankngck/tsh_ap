import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SupplierList from './pages/SupplierList';
import SupplierForm from './pages/SupplierForm';
import BillList from './pages/BillList';
import BillForm from './pages/BillForm';
import BillDetail from './pages/BillDetail';
import PaymentList from './pages/PaymentList';
import PaymentForm from './pages/PaymentForm';
import Reports from './pages/Reports';
import PurchaseOrderList from './pages/PurchaseOrderList';
import PurchaseOrderForm from './pages/PurchaseOrderForm';
import PurchaseOrderDetail from './pages/PurchaseOrderDetail';
import DeliveryOrderForm from './pages/DeliveryOrderForm';
import SupplierConfirmation from './pages/SupplierConfirmation';
import ThreeWayMatch from './pages/ThreeWayMatch';
import AIReportGenerator from './pages/AIReportGenerator';
import Reminders from './pages/Reminders';
import './App.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/" replace />;
}

function RoleRoute({ children, roles }) {
  const { isAuthenticated, hasRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && !hasRole(...roles)) {
      sessionStorage.setItem('accessDenied', '1');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, roles]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!hasRole(...roles)) return null;
  return children;
}

function AppShell() {
  const { isAuthenticated } = useAuth();
  return (
    <>
      {isAuthenticated && <Navbar />}
      <main className={isAuthenticated ? 'main-content' : ''}>
        <Routes>
          <Route path="/" element={<Login />} />

          <Route path="/dashboard"
            element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          <Route path="/suppliers"
            element={<ProtectedRoute><SupplierList /></ProtectedRoute>} />
          <Route path="/suppliers/new"
            element={<RoleRoute roles={['admin','clerk']}><SupplierForm /></RoleRoute>} />
          <Route path="/suppliers/:id/edit"
            element={<RoleRoute roles={['admin','clerk']}><SupplierForm /></RoleRoute>} />

          <Route path="/bills"
            element={<ProtectedRoute><BillList /></ProtectedRoute>} />
          <Route path="/bills/new"
            element={<ProtectedRoute><BillForm /></ProtectedRoute>} />
          <Route path="/bills/:id"
            element={<ProtectedRoute><BillDetail /></ProtectedRoute>} />

          <Route path="/payments"
            element={<ProtectedRoute><PaymentList /></ProtectedRoute>} />
          <Route path="/payments/new"
            element={<RoleRoute roles={['admin','clerk']}><PaymentForm /></RoleRoute>} />

          <Route path="/reports"
            element={<ProtectedRoute><Reports /></ProtectedRoute>} />

          <Route path="/purchase-orders"
            element={<ProtectedRoute><PurchaseOrderList /></ProtectedRoute>} />
          <Route path="/purchase-orders/new"
            element={<RoleRoute roles={['admin','clerk']}><PurchaseOrderForm /></RoleRoute>} />
          <Route path="/purchase-orders/:id/edit"
            element={<ProtectedRoute><PurchaseOrderForm /></ProtectedRoute>} />
          <Route path="/purchase-orders/:id"
            element={<ProtectedRoute><PurchaseOrderDetail /></ProtectedRoute>} />

          <Route path="/delivery-orders/new"
            element={<ProtectedRoute><DeliveryOrderForm /></ProtectedRoute>} />
          <Route path="/supplier-confirmation"
            element={<ProtectedRoute><SupplierConfirmation /></ProtectedRoute>} />

          <Route path="/three-way-match"
            element={<ProtectedRoute><ThreeWayMatch /></ProtectedRoute>} />
          <Route path="/ai-reports"
            element={<RoleRoute roles={['admin','manager']}><AIReportGenerator /></RoleRoute>} />
          <Route path="/reminders"
            element={<ProtectedRoute><Reminders /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
