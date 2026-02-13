import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CostCalculator from '@/components/calculator/CostCalculator';
import CalculationsList from '@/components/calculator/CalculationsList';
import { Loader2 } from 'lucide-react';
import { type Calculation } from '@/lib/supabase';

export default function CalculatorPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'calculator'>('list');
  const [editingCalculation, setEditingCalculation] = useState<Calculation | null>(null);
  const [readOnly, setReadOnly] = useState(false);

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

  if (!user) {
    return null;
  }

  const handleEdit = (calculation: Calculation) => {
    const isApproved = calculation.status === 'approved';
    setEditingCalculation(calculation);
    setReadOnly(isApproved);
    setView('calculator');
  };

  const handleCreateNew = () => {
    setEditingCalculation(null);
    setReadOnly(false);
    setView('calculator');
  };

  const handleBack = () => {
    setEditingCalculation(null);
    setReadOnly(false);
    setView('list');
  };

  const handleSaved = () => {
    setEditingCalculation(null);
    setReadOnly(false);
    setView('list');
  };

  const handleCreateNewVersion = () => {
    setReadOnly(false);
  };

  return (
    <DashboardLayout>
      {view === 'list' ? (
        <CalculationsList onEdit={handleEdit} onCreateNew={handleCreateNew} />
      ) : (
        <CostCalculator 
          editCalculation={editingCalculation} 
          onBack={handleBack}
          onSaved={handleSaved}
          readOnly={readOnly}
          onCreateNewVersion={handleCreateNewVersion}
        />
      )}
    </DashboardLayout>
  );
}
