import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import AppLayout from '@/components/layout/AppLayout';
import ProtectedRoute from '@/routes/ProtectedRoute';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import Dashboard from '@/pages/Dashboard';
import Deals from '@/pages/Deals';
import DealDetail from '@/pages/DealDetail';
import Tasks from '@/pages/Tasks';
import ActivityLog from '@/pages/ActivityLog';
import Settings from '@/pages/Settings';
import NotFound from '@/pages/NotFound';
import { restoreSession, selectBootstrapped } from '@/features/auth/authSlice';

export default function App() {
  const dispatch = useDispatch();
  const bootstrapped = useSelector(selectBootstrapped);

  // Exchange the refresh cookie for an access token once, on first mount.
  useEffect(() => {
    if (!bootstrapped) dispatch(restoreSession());
  }, [dispatch, bootstrapped]);

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="deals" element={<Deals />} />
            <Route path="deals/:id" element={<DealDetail />} />
            {/* Old bookmarks and links from earlier emails still work. */}
            <Route path="pipeline" element={<Navigate to="/deals" replace />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="activity" element={<ActivityLog />} />
            <Route path="settings" element={<Settings />} />
            <Route path="404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
        </Route>
      </Routes>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          className: 'text-sm',
          success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
          error: { duration: 5000, iconTheme: { primary: '#e11d48', secondary: '#fff' } },
        }}
      />
    </>
  );
}
