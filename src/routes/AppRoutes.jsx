import React, { Suspense, lazy, useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout = lazy(() => import('../components/layout/Layout'));
const Login = lazy(() => import('../pages/Login'));
const Dashboard = lazy(() => import('../pages/Dashboard'));
const WaiterHome = lazy(() => import('../pages/waiter/WaiterHome'));
const WaiterDashboard = lazy(() => import('../pages/waiter/WaiterDashboard'));
const ReadyOrders = lazy(() => import('../pages/waiter/ReadyOrders'));
const KitchenDashboard = lazy(() => import('../pages/kitchen/KitchenDashboard'));
const KitchenHistory = lazy(() => import('../pages/kitchen/KitchenHistory'));
const ClientReservation = lazy(() => import('../pages/client/ClientReservation'));
const ClientTableView = lazy(() => import('../pages/client/ClientTableView'));
const ReservationsDashboard = lazy(() => import('../pages/reservations/ReservationsDashboard'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminMenu = lazy(() => import('../pages/admin/AdminMenu'));
const AdminCategories = lazy(() => import('../pages/admin/AdminCategories'));
const AdminReports = lazy(() => import('../pages/admin/AdminReports'));
const AdminSettings = lazy(() => import('../pages/admin/AdminSettings'));
const AdminInventory = lazy(() => import('../pages/admin/AdminInventory'));
const AdminTablesQrPage = lazy(() => import('../pages/admin/AdminTablesQrPage'));
const CashierDashboard = lazy(() => import('../pages/cashier/CashierDashboard'));
const CashierClosing = lazy(() => import('../pages/cashier/CashierClosing'));
const PlaceholderPage = lazy(() => import('../pages/PlaceholderPage'));

const roleWarmups = {
  waiter: () =>
    Promise.all([
      import('../pages/waiter/WaiterHome'),
      import('../pages/waiter/WaiterDashboard'),
      import('../pages/waiter/ReadyOrders'),
      import('../pages/reservations/ReservationsDashboard'),
    ]),
  kitchen: () =>
    Promise.all([
      import('../pages/kitchen/KitchenDashboard'),
      import('../pages/kitchen/KitchenHistory'),
    ]),
  cashier: () =>
    Promise.all([
      import('../pages/cashier/CashierDashboard'),
      import('../pages/cashier/CashierClosing'),
      import('../pages/reservations/ReservationsDashboard'),
    ]),
  client: () =>
    Promise.all([
      import('../pages/client/ClientReservation'),
      import('../pages/client/ClientTableView'),
    ]),
  admin: () =>
    Promise.all([
      import('../pages/admin/AdminDashboard'),
      import('../pages/admin/AdminUsers'),
      import('../pages/admin/AdminMenu'),
      import('../pages/admin/AdminCategories'),
      import('../pages/admin/AdminReports'),
      import('../pages/admin/AdminSettings'),
      import('../pages/admin/AdminInventory'),
      import('../pages/admin/AdminTablesQrPage'),
      import('../pages/reservations/ReservationsDashboard'),
    ]),
};

const RouteFallback = () => (
  <div className="min-h-screen bg-[#080809] flex items-center justify-center px-6">
    <div className="text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium">
        Cargando modulo...
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <RouteFallback />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

const RoleDashboard = () => {
  const { user } = useAuth();

  useEffect(() => {
    const warmup = roleWarmups[user?.role];
    if (warmup) {
      warmup().catch(() => {});
    }
  }, [user?.role]);

  switch (user?.role) {
    case 'waiter':
      return <WaiterHome />;
    case 'kitchen':
      return <KitchenDashboard />;
    case 'cashier':
      return <CashierDashboard />;
    case 'client':
      return <ClientReservation />;
    case 'admin':
      return <AdminDashboard />;
    default:
      return <Dashboard />;
  }
};

const ReservationsRoute = () => {
  const { user } = useAuth();

  if (user?.role === 'client') {
    return <ClientReservation />;
  }

  return <ReservationsDashboard />;
};

const AppRoutes = () => {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/table/:tableUuid" element={<ClientTableView />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<RoleDashboard />} />
          <Route path="order" element={<WaiterDashboard />} />
          <Route path="ready" element={<ReadyOrders />} />
          <Route path="kitchen" element={<KitchenDashboard />} />
          <Route path="history" element={<KitchenHistory />} />
          <Route path="closing" element={<CashierClosing />} />
          <Route path="reservations" element={<ReservationsRoute />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="tables" element={<AdminTablesQrPage />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="*" element={<PlaceholderPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
