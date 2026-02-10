import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BudgetOutcomeManagement from '@/components/admin/BudgetOutcomeManagement';
import { Loader2 } from 'lucide-react';

export default function BudgetOutcomePage() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Du har inte behörighet att visa denna sida.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <BudgetOutcomeManagement />
    </DashboardLayout>
  );
}
