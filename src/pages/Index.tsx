import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import CostCalculator from '@/components/calculator/CostCalculator';
import CalculationsList from '@/components/calculator/CalculationsList';
import { Loader2 } from 'lucide-react';
import { type Calculation } from '@/lib/supabase';

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'calculator'>('list');
  const [editingCalculation, setEditingCalculation] = useState<Calculation | null>(null);

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
    setEditingCalculation(calculation);
    setView('calculator');
  };

  const handleCreateNew = () => {
    setEditingCalculation(null);
    setView('calculator');
  };

  const handleBack = () => {
    setEditingCalculation(null);
    setView('list');
  };

  const handleSaved = () => {
    setEditingCalculation(null);
    setView('list');
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
        />
      )}
    </DashboardLayout>
  );
};

export default Index;
