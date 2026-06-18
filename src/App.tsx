import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import ManageUsersPage from './pages/ManageUsersPage';
import SyncDataPage from './pages/SyncDataPage';

function ProtectedRoute({ allowedRoles }: { allowedRoles?: ('admin' | 'standard')[] }) {
  const { session, role } = useAuth();

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/users" element={<ManageUsersPage />} />
            <Route path="/sync-data" element={<SyncDataPage />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
