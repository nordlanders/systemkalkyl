import DashboardLayout from '@/components/layout/DashboardLayout';
import CmdbManagement from '@/components/admin/CmdbManagement';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function CmdbPage() {
  const { user, loading, isSuperAdmin } = useAuth();

  if (loading) return null;
  if (!user || !isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <CmdbManagement />
    </DashboardLayout>
  );
}
