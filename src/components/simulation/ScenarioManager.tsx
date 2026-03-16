import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Copy, Loader2, RefreshCw } from 'lucide-react';

interface Scenario {
  id: string;
  name: string;
  description: string | null;
  created_by_name: string | null;
  created_at: string;
  updated_at: string;
  price_count?: number;
}

interface ScenarioManagerProps {
  selectedScenarioId: string | null;
  onSelectScenario: (id: string | null) => void;
}

export default function ScenarioManager({ selectedScenarioId, onSelectScenario }: ScenarioManagerProps) {
  const { user, fullName } = useAuth();
  const { toast } = useToast();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadScenarios(); }, []);

  async function loadScenarios() {
    setLoading(true);
    const { data, error } = await supabase
      .from('simulation_scenarios')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) {
      // Count prices per scenario
      const { data: prices } = await supabase
        .from('simulation_prices')
        .select('scenario_id');
      const countMap: Record<string, number> = {};
      (prices || []).forEach(p => {
        countMap[p.scenario_id] = (countMap[p.scenario_id] || 0) + 1;
      });
      setScenarios(data.map(s => ({ ...s, price_count: countMap[s.id] || 0 })));
    }
    setLoading(false);
  }

  async function createScenario() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      // Create scenario
      const { data: scenario, error: scenarioError } = await supabase
        .from('simulation_scenarios')
        .insert({ name: newName.trim(), description: newDesc.trim() || null, created_by: user?.id, created_by_name: fullName })
        .select()
        .single();
      if (scenarioError) throw scenarioError;

      // Copy current pricing config into simulation prices
      const { data: pricingConfigs, error: pricingError } = await supabase
        .from('pricing_config')
        .select('id, price_type, price_per_unit, unit, category, ukonto, account_type')
        .is('effective_to', null);
      if (pricingError) throw pricingError;

      if (pricingConfigs && pricingConfigs.length > 0) {
        const simPrices = pricingConfigs.map(pc => ({
          scenario_id: scenario.id,
          pricing_config_id: pc.id,
          price_type: pc.price_type,
          original_price_per_unit: pc.price_per_unit,
          simulated_price_per_unit: pc.price_per_unit,
          unit: pc.unit,
          category: pc.category,
          ukonto: pc.ukonto,
          account_type: pc.account_type,
        }));
        const { error: insertError } = await supabase.from('simulation_prices').insert(simPrices);
        if (insertError) throw insertError;
      }

      toast({ title: 'Scenario skapat', description: `"${newName}" med ${pricingConfigs?.length || 0} prisrader` });
      setNewName('');
      setNewDesc('');
      setCreateOpen(false);
      onSelectScenario(scenario.id);
      loadScenarios();
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  }

  async function syncScenarioPrices(id: string, name: string) {
    try {
      // Get current active pricing configs
      const { data: pricingConfigs, error: pricingError } = await supabase
        .from('pricing_config')
        .select('id, price_type, price_per_unit, unit, category, ukonto, account_type')
        .is('effective_to', null);
      if (pricingError) throw pricingError;

      // Get existing simulation prices for this scenario
      const { data: existingPrices } = await supabase
        .from('simulation_prices')
        .select('pricing_config_id, simulated_price_per_unit')
        .eq('scenario_id', id);

      // Build map of existing customized prices (to preserve user edits)
      const existingMap: Record<string, number> = {};
      (existingPrices || []).forEach(ep => {
        if (ep.pricing_config_id) existingMap[ep.pricing_config_id] = ep.simulated_price_per_unit;
      });

      // Delete old prices and re-insert from current config
      const { error: delError } = await supabase.from('simulation_prices').delete().eq('scenario_id', id);
      if (delError) throw delError;

      if (pricingConfigs && pricingConfigs.length > 0) {
        const simPrices = pricingConfigs.map(pc => ({
          scenario_id: id,
          pricing_config_id: pc.id,
          price_type: pc.price_type,
          original_price_per_unit: pc.price_per_unit,
          simulated_price_per_unit: existingMap[pc.id] ?? pc.price_per_unit,
          unit: pc.unit,
          category: pc.category,
          ukonto: pc.ukonto,
          account_type: pc.account_type,
        }));
        const { error: insertError } = await supabase.from('simulation_prices').insert(simPrices);
        if (insertError) throw insertError;
      }

      toast({ title: 'Scenario synkroniserat', description: `"${name}" uppdaterat med ${pricingConfigs?.length || 0} prisrader. Tidigare prisjusteringar har bevarats.` });
      loadScenarios();
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    }
  }

  async function deleteScenario(id: string) {
    const { error } = await supabase.from('simulation_scenarios').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Scenario borttaget' });
      if (selectedScenarioId === id) onSelectScenario(null);
      loadScenarios();
    }
  }

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Simuleringsscenarier</CardTitle>
            <CardDescription>Skapa och hantera prisscenarier baserade på den aktuella prislistan</CardDescription>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Nytt scenario</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Skapa nytt scenario</DialogTitle>
                <DialogDescription>Scenariot skapas som en kopia av den nuvarande aktiva prislistan.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="scenario-name">Namn</Label>
                  <Input id="scenario-name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="T.ex. Budget 2026 +5%" />
                </div>
                <div>
                  <Label htmlFor="scenario-desc">Beskrivning (valfritt)</Label>
                  <Textarea id="scenario-desc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Beskriv scenariot..." />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Avbryt</Button>
                <Button onClick={createScenario} disabled={!newName.trim() || creating}>
                  {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Skapa
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {scenarios.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">Inga scenarier ännu. Skapa ett nytt scenario för att börja simulera.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead className="text-right">Prisrader</TableHead>
                  <TableHead>Skapad av</TableHead>
                  <TableHead>Skapad</TableHead>
                  <TableHead className="w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scenarios.map(s => (
                  <TableRow
                    key={s.id}
                    className={`cursor-pointer ${selectedScenarioId === s.id ? 'bg-primary/10' : ''}`}
                    onClick={() => onSelectScenario(s.id)}
                  >
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">{s.description || '–'}</TableCell>
                    <TableCell className="text-right">{s.price_count}</TableCell>
                    <TableCell>{s.created_by_name || '–'}</TableCell>
                    <TableCell>{new Date(s.created_at).toLocaleDateString('sv-SE')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Synkronisera med aktuell prislista" onClick={e => { e.stopPropagation(); syncScenarioPrices(s.id, s.name); }}>
                          <RefreshCw className="h-4 w-4 text-primary" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={e => e.stopPropagation()}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Ta bort scenario?</AlertDialogTitle>
                            <AlertDialogDescription>"{s.name}" och alla dess simulerade priser tas bort permanent.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Avbryt</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteScenario(s.id)}>Ta bort</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
