import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, RotateCcw, Percent } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface SimPrice {
  id: string;
  pricing_config_id: string | null;
  price_type: string;
  original_price_per_unit: number;
  simulated_price_per_unit: number;
  unit: string | null;
  category: string | null;
  ukonto: string | null;
  account_type: string;
}

interface SimulationPriceEditorProps {
  scenarioId: string;
  scenarioName: string;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('sv-SE', { style: 'currency', currency: 'SEK', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(v);

export default function SimulationPriceEditor({ scenarioId, scenarioName }: SimulationPriceEditorProps) {
  const { toast } = useToast();
  const [prices, setPrices] = useState<SimPrice[]>([]);
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkPct, setBulkPct] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => { loadPrices(); }, [scenarioId]);

  async function loadPrices() {
    setLoading(true);
    const { data, error } = await supabase
      .from('simulation_prices')
      .select('*')
      .eq('scenario_id', scenarioId)
      .order('price_type');
    if (!error && data) {
      setPrices(data as SimPrice[]);
      setEditedPrices({});
    }
    setLoading(false);
  }

  function handlePriceChange(id: string, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setEditedPrices(prev => ({ ...prev, [id]: num }));
    }
  }

  function getSimulatedPrice(p: SimPrice): number {
    return editedPrices[p.id] ?? p.simulated_price_per_unit;
  }

  function getDiffPercent(original: number, simulated: number): number {
    if (original === 0) return 0;
    return ((simulated - original) / original) * 100;
  }

  async function saveChanges() {
    if (Object.keys(editedPrices).length === 0) return;
    setSaving(true);
    try {
      for (const [id, price] of Object.entries(editedPrices)) {
        const { error } = await supabase
          .from('simulation_prices')
          .update({ simulated_price_per_unit: price })
          .eq('id', id);
        if (error) throw error;
      }
      toast({ title: 'Priser sparade', description: `${Object.keys(editedPrices).length} priser uppdaterade` });
      loadPrices();
    } catch (err: any) {
      toast({ title: 'Fel', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function applyBulkChange() {
    const pct = parseFloat(bulkPct);
    if (isNaN(pct)) return;
    const factor = 1 + pct / 100;
    const newEdits: Record<string, number> = {};
    prices.forEach(p => {
      newEdits[p.id] = Math.round(p.original_price_per_unit * factor * 100) / 100;
    });
    setEditedPrices(newEdits);
    setBulkOpen(false);
    setBulkPct('');
  }

  function resetAll() {
    const resets: Record<string, number> = {};
    prices.forEach(p => { resets[p.id] = p.original_price_per_unit; });
    setEditedPrices(resets);
  }

  const hasChanges = Object.keys(editedPrices).length > 0;
  const filtered = prices.filter(p =>
    !filter || p.price_type.toLowerCase().includes(filter.toLowerCase()) ||
    (p.category || '').toLowerCase().includes(filter.toLowerCase())
  );

  if (loading) {
    return <Card><CardContent className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <CardTitle>Prisredigering – {scenarioName}</CardTitle>
            <CardDescription>Redigera simulerade priser. Originalpriset visas som referens.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Input placeholder="Filtrera pristyp..." value={filter} onChange={e => setFilter(e.target.value)} className="w-[200px]" />
            <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2"><Percent className="h-4 w-4" />Procentuell ändring</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Applicera procentuell ändring</DialogTitle>
                  <DialogDescription>Ändra alla priser med en procentsats relativt originalpriser. T.ex. +5 för 5% höjning.</DialogDescription>
                </DialogHeader>
                <div>
                  <Label>Procentuell ändring (%)</Label>
                  <Input type="number" value={bulkPct} onChange={e => setBulkPct(e.target.value)} placeholder="T.ex. 5 eller -3" />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setBulkOpen(false)}>Avbryt</Button>
                  <Button onClick={applyBulkChange}>Applicera</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="gap-2" onClick={resetAll}><RotateCcw className="h-4 w-4" />Återställ</Button>
            <Button className="gap-2" onClick={saveChanges} disabled={!hasChanges || saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              <Save className="h-4 w-4" />Spara
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pristyp</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Enhet</TableHead>
                <TableHead className="text-right">Originalpris</TableHead>
                <TableHead className="text-right w-[150px]">Simulerat pris</TableHead>
                <TableHead className="text-right">Differens</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(p => {
                const sim = getSimulatedPrice(p);
                const diff = getDiffPercent(p.original_price_per_unit, sim);
                const isChanged = sim !== p.original_price_per_unit;
                return (
                  <TableRow key={p.id} className={isChanged ? 'bg-accent/30' : ''}>
                    <TableCell className="font-medium max-w-[250px] truncate" title={p.price_type}>{p.price_type}</TableCell>
                    <TableCell className="text-muted-foreground">{p.category || '–'}</TableCell>
                    <TableCell>{p.unit || '–'}</TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{formatCurrency(p.original_price_per_unit)}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        step="0.01"
                        value={editedPrices[p.id] ?? p.simulated_price_per_unit}
                        onChange={e => handlePriceChange(p.id, e.target.value)}
                        className="w-[130px] text-right ml-auto font-mono"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      {isChanged ? (
                        <Badge variant={diff > 0 ? 'destructive' : 'default'} className={diff < 0 ? 'bg-green-600 hover:bg-green-700' : ''}>
                          {diff > 0 ? '+' : ''}{diff.toFixed(1)}%
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        {hasChanges && (
          <p className="text-sm text-amber-600 mt-3">Du har osparade ändringar. Klicka "Spara" för att behålla dem.</p>
        )}
      </CardContent>
    </Card>
  );
}
