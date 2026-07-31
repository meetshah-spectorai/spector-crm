import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectBootstrapped, selectUser } from '@/features/auth/authSlice';
import { LoadingState } from '@/components/ui';

/** Blocks rendering until the refresh-cookie exchange has settled. */
export default function ProtectedRoute() {
  const user = useSelector(selectUser);
  const bootstrapped = useSelector(selectBootstrapped);
  const location = useLocation();

  if (!bootstrapped) {
    return (
      <div className="grid h-full place-items-center">
        <LoadingState label="Restoring your session…" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <Outlet />;
}
