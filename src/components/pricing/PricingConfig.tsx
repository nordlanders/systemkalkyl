import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';

const componentTypes = [
  { value: 'cpu', label: 'CPU Core' },
  { value: 'storage_gb', label: 'Storage (per GB)' },
  { value: 'server', label: 'Server' },
  { value: 'operation_hour', label: 'Operation Hour' },
];

export default function PricingConfig() {
  const [pricing, setPricing] = useState<PricingConfigType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [componentType, setComponentType] = useState('cpu');
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

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
        .order('component_type')
        .order('effective_from', { ascending: false });

      if (error) throw error;
      setPricing(data as PricingConfigType[]);
    } catch (error) {
      console.error('Error loading pricing:', error);
      toast({
        title: 'Error loading pricing',
        description: 'Could not load pricing configuration.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setComponentType('cpu');
    setPricePerUnit('');
    setEffectiveFrom('');
    setEffectiveTo('');
    setEditingId(null);
  }

  function openEditDialog(config: PricingConfigType) {
    setEditingId(config.id);
    setComponentType(config.component_type);
    setPricePerUnit(config.price_per_unit.toString());
    setEffectiveFrom(config.effective_from);
    setEffectiveTo(config.effective_to || '');
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user || !isAdmin) {
      toast({
        title: 'Permission denied',
        description: 'Only administrators can modify pricing.',
        variant: 'destructive',
      });
      return;
    }

    if (!pricePerUnit || !effectiveFrom) {
      toast({
        title: 'Validation error',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const priceData = {
        component_type: componentType,
        price_per_unit: parseFloat(pricePerUnit),
        effective_from: effectiveFrom,
        effective_to: effectiveTo || null,
        created_by: user.id,
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

        toast({ title: 'Price updated', description: 'Pricing configuration has been updated.' });
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('pricing_config')
          .insert(priceData)
          .select()
          .single();

        if (error) throw error;

        await logAudit('create', 'pricing_config', data.id, undefined, {
          component_type: data.component_type,
          price_per_unit: data.price_per_unit,
        });

        toast({ title: 'Price added', description: 'New pricing configuration has been added.' });
      }

      resetForm();
      setDialogOpen(false);
      loadPricing();
    } catch (error) {
      console.error('Error saving pricing:', error);
      toast({
        title: 'Error saving',
        description: 'Could not save pricing configuration.',
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
        component_type: oldConfig?.component_type,
        price_per_unit: oldConfig?.price_per_unit,
      });

      toast({ title: 'Price deleted', description: 'Pricing configuration has been removed.' });
      loadPricing();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      toast({
        title: 'Error deleting',
        description: 'Could not delete pricing configuration.',
        variant: 'destructive',
      });
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
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
          <h1 className="text-3xl font-bold text-foreground">Pricing Configuration</h1>
          <p className="text-muted-foreground mt-1">
            Manage component pricing with effective dates
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
                Add Price
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit Price' : 'Add New Price'}</DialogTitle>
                <DialogDescription>
                  Configure pricing for infrastructure components
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Component Type</Label>
                  <Select value={componentType} onValueChange={setComponentType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {componentTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Price Per Unit (USD)</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="number"
                      step="0.0001"
                      placeholder="0.00"
                      value={pricePerUnit}
                      onChange={(e) => setPricePerUnit(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Effective From *</Label>
                    <Input
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Effective To</Label>
                    <Input
                      type="date"
                      value={effectiveTo}
                      onChange={(e) => setEffectiveTo(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingId ? 'Update' : 'Create'}
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
              Only administrators can modify pricing configurations. Contact your admin for changes.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Pricing Table
          </CardTitle>
          <CardDescription>
            All pricing configurations with their effective date ranges
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Component</TableHead>
                  <TableHead>Price/Unit</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead>Updated</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pricing.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                      No pricing configurations found
                    </TableCell>
                  </TableRow>
                ) : (
                  pricing.map((config) => {
                    const typeLabel = componentTypes.find(t => t.value === config.component_type)?.label || config.component_type;
                    const isActive = !config.effective_to || new Date(config.effective_to) >= new Date();
                    
                    return (
                      <TableRow key={config.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{typeLabel}</span>
                            {isActive && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
                                Active
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">
                          {formatCurrency(Number(config.price_per_unit))}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {format(new Date(config.effective_from), 'MMM d, yyyy')}
                          </div>
                        </TableCell>
                        <TableCell>
                          {config.effective_to ? (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {format(new Date(config.effective_to), 'MMM d, yyyy')}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(config.updated_at), 'MMM d, yyyy')}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(config)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(config.id)}
                                className="text-destructive hover:text-destructive"
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
