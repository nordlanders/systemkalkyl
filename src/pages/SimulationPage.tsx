import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FlaskConical, Settings, BarChart3 } from 'lucide-react';
import ScenarioManager from '@/components/simulation/ScenarioManager';
import SimulationPriceEditor from '@/components/simulation/SimulationPriceEditor';
import SimulationAnalysis from '@/components/simulation/SimulationAnalysis';
import { supabase } from '@/integrations/supabase/client';

export default function SimulationPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const [scenarioName, setScenarioName] = useState('');
  const [activeTab, setActiveTab] = useState('scenarios');

  useEffect(() => {
    if (selectedScenarioId) {
      supabase.from('simulation_scenarios').select('name').eq('id', selectedScenarioId).single()
        .then(({ data }) => {
          if (data) setScenarioName(data.name);
        });
    }
  }, [selectedScenarioId]);

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <DashboardLayout>
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <FlaskConical className="h-8 w-8 text-primary" />
            Simulering
          </h1>
          <p className="text-muted-foreground mt-1">
            Simulera prisändringar och analysera deras påverkan på kalkyler
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="scenarios" className="gap-2">
              <FlaskConical className="h-4 w-4" />
              Scenarier
            </TabsTrigger>
            <TabsTrigger value="prices" className="gap-2" disabled={!selectedScenarioId}>
              <Settings className="h-4 w-4" />
              Priser
            </TabsTrigger>
            <TabsTrigger value="analysis" className="gap-2" disabled={!selectedScenarioId}>
              <BarChart3 className="h-4 w-4" />
              Analys
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scenarios">
            <ScenarioManager
              selectedScenarioId={selectedScenarioId}
              onSelectScenario={(id) => {
                setSelectedScenarioId(id);
                if (id) setActiveTab('prices');
              }}
            />
          </TabsContent>

          <TabsContent value="prices">
            {selectedScenarioId && (
              <SimulationPriceEditor scenarioId={selectedScenarioId} scenarioName={scenarioName} />
            )}
          </TabsContent>

          <TabsContent value="analysis">
            {selectedScenarioId && (
              <SimulationAnalysis scenarioId={selectedScenarioId} scenarioName={scenarioName} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
