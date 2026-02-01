import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPricing, logAudit, type PricingConfig } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Cpu, 
  HardDrive, 
  Server, 
  Clock, 
  Calculator,
  Save,
  Loader2,
  DollarSign
} from 'lucide-react';

interface CostBreakdown {
  cpu: number;
  storage: number;
  server: number;
  operations: number;
  total: number;
}

export default function CostCalculator() {
  const [cpuCount, setCpuCount] = useState(4);
  const [storageGb, setStorageGb] = useState(100);
  const [serverCount, setServerCount] = useState(2);
  const [operationHours, setOperationHours] = useState(2000);
  const [calculationName, setCalculationName] = useState('');
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [costs, setCosts] = useState<CostBreakdown>({ cpu: 0, storage: 0, server: 0, operations: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    calculateCosts();
  }, [cpuCount, storageGb, serverCount, operationHours, pricing]);

  async function loadPricing() {
    try {
      const data = await getCurrentPricing();
      setPricing(data);
    } catch (error) {
      console.error('Error loading pricing:', error);
      toast({
        title: 'Fel vid laddning av priser',
        description: 'Kunde inte ladda aktuell priskonfiguration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function calculateCosts() {
    const getPriceForType = (type: string) => {
      const config = pricing.find(p => p.component_type === type);
      return config ? Number(config.price_per_unit) : 0;
    };

    const cpuCost = cpuCount * getPriceForType('cpu');
    const storageCost = storageGb * getPriceForType('storage_gb');
    const serverCost = serverCount * getPriceForType('server');
    const operationCost = operationHours * getPriceForType('operation_hour');

    setCosts({
      cpu: cpuCost,
      storage: storageCost,
      server: serverCost,
      operations: operationCost,
      total: cpuCost + storageCost + serverCost + operationCost,
    });
  }

  async function saveCalculation() {
    if (!user) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('calculations')
        .insert({
          user_id: user.id,
          name: calculationName || `Beräkning ${new Date().toLocaleDateString('sv-SE')}`,
          cpu_count: cpuCount,
          storage_gb: storageGb,
          server_count: serverCount,
          operation_hours: operationHours,
          cpu_cost: costs.cpu,
          storage_cost: costs.storage,
          server_cost: costs.server,
          operation_cost: costs.operations,
          total_cost: costs.total,
        })
        .select()
        .single();

      if (error) throw error;

      await logAudit('create', 'calculations', data.id, undefined, {
        name: data.name,
        total_cost: data.total_cost,
      });

      toast({
        title: 'Beräkning sparad',
        description: 'Din beräkning har sparats i historiken.',
      });

      setCalculationName('');
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: 'Fel vid sparande',
        description: 'Kunde inte spara beräkningen.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 2,
    }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Infrastruktur Kostnadskalkylator</h1>
        <p className="text-muted-foreground mt-1">Beräkna din årliga IT-infrastrukturkostnad</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Konfiguration
              </CardTitle>
              <CardDescription>
                Justera reglagen för att matcha dina infrastrukturbehov
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* CPU Count */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Cpu className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Label className="text-base font-medium">CPU-kärnor</Label>
                      <p className="text-sm text-muted-foreground">Antal processorkärnor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={cpuCount}
                      onChange={(e) => setCpuCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center font-mono"
                      min={1}
                      max={128}
                    />
                  </div>
                </div>
                <Slider
                  value={[cpuCount]}
                  onValueChange={(v) => setCpuCount(v[0])}
                  max={128}
                  min={1}
                  step={1}
                  className="py-2"
                />
              </div>

              {/* Storage */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-accent/10">
                      <HardDrive className="h-5 w-5 text-accent" />
                    </div>
                    <div>
                      <Label className="text-base font-medium">Lagring (GB)</Label>
                      <p className="text-sm text-muted-foreground">Total lagringskapacitet</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={storageGb}
                      onChange={(e) => setStorageGb(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center font-mono"
                      min={1}
                      max={10000}
                    />
                  </div>
                </div>
                <Slider
                  value={[storageGb]}
                  onValueChange={(v) => setStorageGb(v[0])}
                  max={10000}
                  min={1}
                  step={10}
                  className="py-2"
                />
              </div>

              {/* Servers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-success/10">
                      <Server className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <Label className="text-base font-medium">Servrar</Label>
                      <p className="text-sm text-muted-foreground">Antal serverinstanser</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={serverCount}
                      onChange={(e) => setServerCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20 text-center font-mono"
                      min={1}
                      max={100}
                    />
                  </div>
                </div>
                <Slider
                  value={[serverCount]}
                  onValueChange={(v) => setServerCount(v[0])}
                  max={100}
                  min={1}
                  step={1}
                  className="py-2"
                />
              </div>

              {/* Operation Hours */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-warning/10">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <Label className="text-base font-medium">Drifttimmar/år</Label>
                      <p className="text-sm text-muted-foreground">Årlig drifttid</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={operationHours}
                      onChange={(e) => setOperationHours(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 text-center font-mono"
                      min={1}
                      max={8760}
                    />
                  </div>
                </div>
                <Slider
                  value={[operationHours]}
                  onValueChange={(v) => setOperationHours(v[0])}
                  max={8760}
                  min={1}
                  step={100}
                  className="py-2"
                />
                <p className="text-xs text-muted-foreground">
                  Max 8 760 timmar = 24/7 drift under ett år
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Save Section */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <Input
                  placeholder="Namnge din beräkning (valfritt)"
                  value={calculationName}
                  onChange={(e) => setCalculationName(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={saveCalculation} disabled={saving} className="gap-2">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Spara beräkning
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cost Summary */}
        <div className="space-y-6">
          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Årlig kostnadssammanställning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> CPU
                  </span>
                  <span className="font-mono font-medium">{formatCurrency(costs.cpu)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <HardDrive className="h-4 w-4" /> Lagring
                  </span>
                  <span className="font-mono font-medium">{formatCurrency(costs.storage)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Server className="h-4 w-4" /> Servrar
                  </span>
                  <span className="font-mono font-medium">{formatCurrency(costs.server)}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-border/50">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Drift
                  </span>
                  <span className="font-mono font-medium">{formatCurrency(costs.operations)}</span>
                </div>
              </div>

              <div className="pt-4 border-t-2 border-primary/20">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total årskostnad</span>
                  <span className="text-2xl font-bold font-mono text-primary">
                    {formatCurrency(costs.total)}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Månadsvis: {formatCurrency(costs.total / 12)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Current Pricing Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Aktuella pristariffer
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {pricing.map((p) => (
                <div key={p.id} className="flex justify-between">
                  <span className="capitalize text-muted-foreground">
                    {p.component_type === 'cpu' && 'CPU'}
                    {p.component_type === 'storage_gb' && 'Lagring (GB)'}
                    {p.component_type === 'server' && 'Server'}
                    {p.component_type === 'operation_hour' && 'Drifttimme'}
                  </span>
                  <span className="font-mono">
                    {formatCurrency(Number(p.price_per_unit))}/enhet
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
