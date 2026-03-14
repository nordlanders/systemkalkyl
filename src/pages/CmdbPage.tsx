import DashboardLayout from '@/components/layout/DashboardLayout';
import CmdbManagement from '@/components/admin/CmdbManagement';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function CmdbPage() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <DashboardLayout>
      <CmdbManagement />
    </DashboardLayout>
  );
}
