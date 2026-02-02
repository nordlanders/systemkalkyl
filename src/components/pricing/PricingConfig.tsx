import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, type PricingConfig as PricingConfigType } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Settings, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  Calendar,
  Coins,
  AlertCircle,
  Layers
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const categories = [
  { value: 'Drift', label: 'Drift' },
  { value: 'Licenser', label: 'Licenser' },
  { value: 'Förvaltning', label: 'Förvaltning' },
  { value: 'Personalkostnad', label: 'Personalkostnad' },
  { value: 'Avtal', label: 'Avtal' },
  { value: 'Avskrivning', label: 'Avskrivning' },
  { value: 'Annat', label: 'Annat' },
];

const SERVICE_TYPES = [
  { value: 'Anpassad drift', label: 'Anpassad drift' },
  { value: 'Anpassad förvaltning', label: 'Anpassad förvaltning' },
  { value: 'Bastjänst Digital infrastruktur', label: 'Bastjänst Digital infrastruktur' },
  { value: 'Bastjänst IT infrastruktur', label: 'Bastjänst IT infrastruktur' },
];

const costOwners = [
  { value: 'Produktion', label: 'Produktion' },
  { value: 'Digital Utveckling', label: 'Digital Utveckling' },
  { value: 'Strategi och styrning', label: 'Strategi och styrning' },
  { value: 'Avskrivning', label: 'Avskrivning' },
  { value: 'Annat', label: 'Annat' },
];

export default function PricingConfig() {
  const [pricing, setPricing] = useState<PricingConfigType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [priceType, setPriceType] = useState('');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [unit, setUnit] = useState('');
  const [category, setCategory] = useState('Drift');
  const [comment, setComment] = useState('');
  const [costOwner, setCostOwner] = useState('Produktion');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(
    SERVICE_TYPES.map(st => st.value)
  );

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadPricing();
  }, []);

  async function loadPricing() {
    try {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .order('category')
        .order('price_type');

      if (error) throw error;
      setPricing(data as PricingConfigType[]);
    } catch (error) {
      console.error('Error loading pricing:', error);
      toast({
        title: 'Fel vid laddning av priser',
        description: 'Kunde inte ladda priskonfiguration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setPriceType('');
    setPricePerUnit('');
    setUnit('');
    setCategory('Drift');
    setComment('');
    setCostOwner('Produktion');
    setEffectiveFrom('');
    setEffectiveTo('');
    setSelectedServiceTypes(SERVICE_TYPES.map(st => st.value));
    setEditingId(null);
  }

  function openEditDialog(config: PricingConfigType) {
    setEditingId(config.id);
    setPriceType(config.price_type);
    setPricePerUnit(config.price_per_unit.toString());
    setUnit(config.unit || '');
    setCategory(config.category || 'Drift');
    setComment(config.comment || '');
    setCostOwner(config.cost_owner || 'Produktion');
    setEffectiveFrom(config.effective_from);
    setEffectiveTo(config.effective_to || '');
    setSelectedServiceTypes(config.service_types || []);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user || !isAdmin) {
      toast({
        title: 'Åtkomst nekad',
        description: 'Endast administratörer kan ändra priser.',
        variant: 'destructive',
      });
      return;
    }

    if (!priceType || !pricePerUnit || !effectiveFrom) {
      toast({
        title: 'Valideringsfel',
        description: 'Fyll i alla obligatoriska fält.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const priceData = {
        price_type: priceType,
        price_per_unit: parseFloat(pricePerUnit),
        unit: unit || null,
        category: category || null,
        comment: comment || null,
        cost_owner: costOwner || null,
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        created_by: user.id,
        service_types: selectedServiceTypes.length > 0 ? selectedServiceTypes : null,
      };

      if (editingId) {
        // Update existing
        const oldConfig = pricing.find(p => p.id === editingId);
        const { error } = await supabase
          .from('pricing_config')
          .update(priceData)
          .eq('id', editingId);

        if (error) throw error;

        await logAudit('update', 'pricing_config', editingId, 
          { price_per_unit: oldConfig?.price_per_unit },
          { price_per_unit: priceData.price_per_unit }
        );

        toast({ title: 'Pris uppdaterat', description: 'Priskonfigurationen har uppdaterats.' });
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('pricing_config')
          .insert(priceData)
          .select()
          .single();

        if (error) throw error;

        await logAudit('create', 'pricing_config', data.id, undefined, {
          price_type: data.price_type,
          price_per_unit: data.price_per_unit,
        });

        toast({ title: 'Pris tillagt', description: 'Ny priskonfiguration har lagts till.' });
      }

      resetForm();
      setDialogOpen(false);
      loadPricing();
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast({
        title: 'Fel vid sparande',
        description: 'Kunde inte spara priskonfiguration.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;

    try {
      const oldConfig = pricing.find(p => p.id === id);
      const { error } = await supabase
        .from('pricing_config')
        .delete()
        .eq('id', id);

      if (error) throw error;

      await logAudit('delete', 'pricing_config', id, {
        price_type: oldConfig?.price_type,
        price_per_unit: oldConfig?.price_per_unit,
      });

      toast({ title: 'Pris borttaget', description: 'Priskonfigurationen har tagits bort.' });
      loadPricing();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort priskonfiguration.',
        variant: 'destructive',
      });
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Priskonfiguration</h1>
          <p className="text-muted-foreground mt-1">
            Hantera priser med kategori, enhet och kostnadsägare
          </p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Lägg till pris
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Redigera pris' : 'Lägg till nytt pris'}</DialogTitle>
                <DialogDescription>
                  Konfigurera prissättning för infrastrukturkomponenter
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4 max-h-[60vh] overflow-y-auto">
                <div className="space-y-2">
                  <Label>Pristyp *</Label>
                  <Input
                    placeholder="T.ex. Virtuell server (CPU delen)"
                    value={priceType}
                    onChange={(e) => setPriceType(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Pris per enhet (SEK) *</Label>
                    <div className="relative">
                      <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={pricePerUnit}
                        onChange={(e) => setPricePerUnit(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Enhet</Label>
                    <Input
                      placeholder="T.ex. vcpu, GB, kr/år"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Kategori</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Kostnadsägare</Label>
                    <Select value={costOwner} onValueChange={setCostOwner}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {costOwners.map((owner) => (
                          <SelectItem key={owner.value} value={owner.value}>
                            {owner.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Kommentar</Label>
                  <Textarea
                    placeholder="Beskrivning eller instruktioner för denna pristyp"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Giltigt från *</Label>
                    <Input
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Giltigt till</Label>
                    <Input
                      type="date"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    Ingår default i kalkyler för
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    {SERVICE_TYPES.map((st) => (
                      <div key={st.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`service-${st.value}`}
                          checked={selectedServiceTypes.includes(st.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedServiceTypes([...selectedServiceTypes, st.value]);
                            } else {
                              setSelectedServiceTypes(
                                selectedServiceTypes.filter(s => s !== st.value)
                              );
                            }
                          }}
                        />
                        <label
                          htmlFor={`service-${st.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {st.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Välj vilka tjänstetyper denna prisrad ska visas i. Om ingen är vald visas den i alla.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Avbryt
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingId ? 'Uppdatera' : 'Skapa'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {!isAdmin && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-warning" />
            <p className="text-sm text-muted-foreground">
              Endast administratörer kan ändra priskonfigurationer. Kontakta din administratör för ändringar.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Pristabell
          </CardTitle>
          <CardDescription>
            Alla priskonfigurationer ({pricing.length} st)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Pristyp</TableHead>
                  <TableHead>Pris</TableHead>
                  <TableHead>Enhet</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Ingår default i kalkyler för</TableHead>
                  <TableHead>Giltigt från</TableHead>
                  {isAdmin && <TableHead className="text-right">Åtgärder</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Inga priskonfigurationer hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  pricing.map((config) => {
                    const isActive = !config.effective_to || new Date(config.effective_to) >= new Date();
                    
                    return (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium max-w-[200px] truncate" title={config.price_type}>
                              {config.price_type}
                            </span>
                            {isActive && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success shrink-0">
                                Aktiv
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(Number(config.price_per_unit))}
                        </TableCell>
                        <TableCell>
                          {config.unit || '—'}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs px-2 py-1 rounded bg-muted">
                            {config.category || '—'}
                          </span>
                        </TableCell>
                        <TableCell>
                          {config.service_types && config.service_types.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {config.service_types.length === SERVICE_TYPES.length ? (
                                <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                                  Alla
                                </span>
                              ) : (
                                config.service_types.map(st => (
                                  <span 
                                    key={st} 
                                    className="text-xs px-2 py-0.5 rounded bg-muted"
                                    title={st}
                                  >
                                    {st.split(' ')[0]}
                                  </span>
                                ))
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(config.effective_from), 'd MMM yyyy', { locale: sv })}
                          </div>
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(config)}
                                title="Redigera"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(config.id)}
                                className="text-destructive hover:text-destructive"
                                title="Ta bort"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
