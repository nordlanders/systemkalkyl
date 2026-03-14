import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import BudgetCompensationsManagement from '@/components/admin/BudgetCompensationsManagement';
import { Loader2 } from 'lucide-react';

export default function BudgetCompensationsPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, loading, isAdmin, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6 fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Budgetkompensationer</h1>
          <p className="text-muted-foreground mt-1">
            Hantera avskrivningskompensationer per ägande organisation
          </p>
        </div>
        <BudgetCompensationsManagement />
      </div>
    </DashboardLayout>
  );
}
