import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, type PricingConfig, type Calculation } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calculator,
  Save,
  Loader2,
  Coins,
  ArrowLeft,
  ArrowRight,
  FileText,
  Plus,
  Trash2,
  Pencil,
  Check,
  MessageSquare,
  User,
  Calendar
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const SERVICE_TYPES = [
  { value: 'Anpassad drift', label: 'Anpassad drift' },
  { value: 'Anpassad förvaltning', label: 'Anpassad förvaltning' },
  { value: 'Bastjänst Digital infrastruktur', label: 'Bastjänst Digital infrastruktur' },
  { value: 'Bastjänst IT infrastruktur', label: 'Bastjänst IT infrastruktur' },
];

interface CalculationRow {
  id: string;
  pricingConfigId: string;
  priceType: string;
  quantity: number;
  unitPrice: number;
  unit: string;
  comment: string;
}

interface CostCalculatorProps {
  editCalculation?: Calculation | null;
  onBack: () => void;
  onSaved: () => void;
}

export default function CostCalculator({ editCalculation, onBack, onSaved }: CostCalculatorProps) {
  const [calculationName, setCalculationName] = useState(editCalculation?.name ?? '');
  const [ciIdentity, setCiIdentity] = useState(editCalculation?.ci_identity ?? '');
  const [serviceType, setServiceType] = useState(editCalculation?.service_type ?? '');
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [rows, setRows] = useState<CalculationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(editCalculation ? 2 : 1);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  
  const { user, fullName } = useAuth();
  const { toast } = useToast();
  
  const isEditing = !!editCalculation;
  const canProceedToStep2 = calculationName.trim() !== '' && ciIdentity.trim() !== '' && serviceType !== '';
  const canProceedToStep3 = rows.length > 0 && rows.some(r => r.pricingConfigId);

  useEffect(() => {
    loadPricing();
  }, []);

  useEffect(() => {
    if (editCalculation && pricing.length > 0) {
      loadExistingItems();
    }
  }, [editCalculation, pricing]);

  async function loadPricing() {
    try {
      const { data, error } = await supabase
        .from('pricing_config')
        .select('*')
        .order('category')
        .order('price_type');

      if (error) throw error;
      setPricing(data as PricingConfig[]);
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

  async function loadExistingItems() {
    if (!editCalculation) return;
    
    try {
      const { data, error } = await supabase
        .from('calculation_items')
        .select('*')
        .eq('calculation_id', editCalculation.id);

      if (error) throw error;

      if (data && data.length > 0) {
        const loadedRows: CalculationRow[] = data.map(item => {
          const pricingConfig = pricing.find(p => p.id === item.pricing_config_id);
          return {
            id: item.id,
            pricingConfigId: item.pricing_config_id || '',
            priceType: item.price_type,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unit_price),
            unit: pricingConfig?.unit || '',
            comment: (item as any).comment || '',
          };
        });
        setRows(loadedRows);
      }
    } catch (error) {
      console.error('Error loading calculation items:', error);
    }
  }

  function addRow() {
    const newRow: CalculationRow = {
      id: crypto.randomUUID(),
      pricingConfigId: '',
      priceType: '',
      quantity: 1,
      unitPrice: 0,
      unit: '',
      comment: '',
    };
    setRows([...rows, newRow]);
    setEditingRowId(newRow.id);
  }

  function removeRow(id: string) {
    setRows(rows.filter(row => row.id !== id));
  }

  function updateRowPricing(rowId: string, pricingConfigId: string) {
    const pricingConfig = pricing.find(p => p.id === pricingConfigId);
    if (!pricingConfig) return;

    setRows(rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          pricingConfigId,
          priceType: pricingConfig.price_type,
          unitPrice: Number(pricingConfig.price_per_unit),
          unit: pricingConfig.unit || '',
        };
      }
      return row;
    }));
  }

  function updateRowQuantity(rowId: string, quantity: number) {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        return { ...row, quantity: Math.max(0, quantity) };
      }
      return row;
    }));
  }

  function updateRowComment(rowId: string, comment: string) {
    setRows(rows.map(row => {
      if (row.id === rowId) {
        return { ...row, comment };
      }
      return row;
    }));
  }

  function calculateRowTotal(row: CalculationRow): number {
    return row.quantity * row.unitPrice;
  }

  function calculateTotalCost(): number {
    return rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  }

  async function saveCalculation() {
    if (!user) return;

    if (!ciIdentity.trim()) {
      toast({
        title: 'CI-identitet krävs',
        description: 'Du måste ange en CI-identitet för systemet i CMDB.',
        variant: 'destructive',
      });
      return;
    }

    if (rows.length === 0) {
      toast({
        title: 'Inga rader',
        description: 'Lägg till minst en prisrad i kalkylen.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const totalCost = calculateTotalCost();
      const userName = fullName || user?.email || 'Okänd';
      const calculationData = {
        name: calculationName || `Beräkning ${new Date().toLocaleDateString('sv-SE')}`,
        ci_identity: ciIdentity.trim(),
        service_type: serviceType,
        total_cost: totalCost,
        updated_by_name: userName,
        // Keep legacy fields for backwards compatibility
        cpu_count: 0,
        storage_gb: 0,
        server_count: 0,
        operation_hours: 0,
        cpu_cost: 0,
        storage_cost: 0,
        server_cost: 0,
        operation_cost: 0,
      };

      let calculationId: string;

      if (isEditing && editCalculation) {
        // Update existing calculation
        const { error } = await supabase
          .from('calculations')
          .update(calculationData)
          .eq('id', editCalculation.id);

        if (error) throw error;
        calculationId = editCalculation.id;

        // Delete existing items
        await supabase
          .from('calculation_items')
          .delete()
          .eq('calculation_id', calculationId);

        await logAudit('update', 'calculations', calculationId, {
          name: editCalculation.name,
          total_cost: editCalculation.total_cost,
        }, {
          name: calculationData.name,
          total_cost: calculationData.total_cost,
        });

        toast({
          title: 'Kalkyl uppdaterad',
          description: 'Dina ändringar har sparats.',
        });
      } else {
        // Create new calculation
        const { data, error } = await supabase
          .from('calculations')
          .insert({
            user_id: user.id,
            created_by_name: userName,
            ...calculationData,
          })
          .select()
          .single();

        if (error) throw error;
        calculationId = data.id;

        await logAudit('create', 'calculations', data.id, undefined, {
          name: data.name,
          total_cost: data.total_cost,
        });

        toast({
          title: 'Kalkyl sparad',
          description: 'Din nya kalkyl har skapats.',
        });
      }

      // Insert calculation items
      const items = rows.map(row => ({
        calculation_id: calculationId,
        pricing_config_id: row.pricingConfigId || null,
        price_type: row.priceType,
        quantity: row.quantity,
        unit_price: row.unitPrice,
        total_price: calculateRowTotal(row),
        comment: row.comment || null,
      }));

      const { error: itemsError } = await supabase
        .from('calculation_items')
        .insert(items);

      if (itemsError) throw itemsError;

      onSaved();
    } catch (error) {
      console.error('Error saving calculation:', error);
      toast({
        title: 'Fel vid sparande',
        description: 'Kunde inte spara kalkylen.',
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

  // Group pricing by category for easier selection
  const pricingByCategory = pricing.reduce((acc, p) => {
    const category = p.category || 'Övrigt';
    if (!acc[category]) acc[category] = [];
    acc[category].push(p);
    return acc;
  }, {} as Record<string, PricingConfig[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Extract metadata from editCalculation
  const createdByName = editCalculation?.created_by_name;
  const createdAt = editCalculation?.created_at;
  const updatedByName = editCalculation?.updated_by_name;
  const updatedAt = editCalculation?.updated_at;

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button 
          variant="ghost" 
          onClick={() => {
            if (step === 1) onBack();
            else if (step === 2) setStep(1);
            else setStep(2);
          }} 
          className="gap-2 w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          {step === 1 ? 'Tillbaka till lista' : step === 2 ? 'Tillbaka till steg 1' : 'Tillbaka till steg 2'}
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-foreground">
            {isEditing ? 'Redigera kalkyl' : 'Ny kalkyl'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {step === 1 
              ? 'Steg 1: Ange namn, CI-identitet och tjänstetyp' 
              : step === 2 
                ? 'Steg 2: Välj pristyper och ange antal'
                : 'Steg 3: Granska och bekräfta'}
          </p>
        </div>
        {/* Step indicator */}
        <div className="flex items-center gap-2">
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium cursor-pointer transition-colors ${step === 1 ? 'bg-primary text-primary-foreground' : 'bg-primary/20 text-primary hover:bg-primary/30'}`}
            onClick={() => setStep(1)}
          >
            1
          </div>
          <div className="w-8 h-0.5 bg-border" />
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 2 
                ? 'bg-primary text-primary-foreground' 
                : step > 2 || canProceedToStep2
                  ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30' 
                  : 'bg-muted text-muted-foreground'
            }`}
            onClick={() => canProceedToStep2 && setStep(2)}
          >
            2
          </div>
          <div className="w-8 h-0.5 bg-border" />
          <div 
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step === 3 
                ? 'bg-primary text-primary-foreground' 
                : canProceedToStep3 
                  ? 'bg-primary/20 text-primary cursor-pointer hover:bg-primary/30' 
                  : 'bg-muted text-muted-foreground'
            }`}
            onClick={() => canProceedToStep3 && setStep(3)}
          >
            3
          </div>
        </div>
      </div>


      {step === 1 ? (
        /* Step 1: Name, CI Identity and Service Type */
        <div className="space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Grundläggande information
              </CardTitle>
              <CardDescription>
                Ange namn, CI-identitet och tjänstetyp för kalkylen
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="calcName">
                  Namn på kalkyl <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="calcName"
                  placeholder="T.ex. Produktionsmiljö Q1"
                  value={calculationName}
                  onChange={(e) => setCalculationName(e.target.value)}
                  autoFocus
                />
                <p className="text-sm text-muted-foreground">
                  Ett beskrivande namn som hjälper dig identifiera kalkylen
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ciIdentity">
                  CI-identitet (CMDB) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ciIdentity"
                  placeholder="T.ex. CI-12345"
                  value={ciIdentity}
                  onChange={(e) => setCiIdentity(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Systemets unika identifierare i Configuration Management Database
                </p>
              </div>
              <div className="space-y-3">
                <Label>
                  Tjänstetyp <span className="text-destructive">*</span>
                </Label>
                <RadioGroup value={serviceType} onValueChange={setServiceType} className="space-y-2">
                  {SERVICE_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-3">
                      <RadioGroupItem value={type.value} id={type.value} />
                      <Label htmlFor={type.value} className="font-normal cursor-pointer">
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              <div className="pt-4">
                <Button 
                  onClick={() => setStep(2)} 
                  disabled={!canProceedToStep2}
                  className="gap-2"
                >
                  Fortsätt till konfiguration
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : step === 2 ? (
        /* Step 2: Price type rows */
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Rows Section */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-primary" />
                  Prisrader
                </CardTitle>
                <CardDescription>
                  Lägg till pristyper och ange antal för varje rad
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {rows.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed rounded-lg">
                    <p className="text-muted-foreground mb-4">
                      Inga prisrader tillagda ännu
                    </p>
                    <Button onClick={addRow} variant="outline" className="gap-2">
                      <Plus className="h-4 w-4" />
                      Lägg till första raden
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rows.map((row, index) => {
                      const isRowEditing = !isEditing || editingRowId === row.id;
                      const isLocked = isEditing && editingRowId !== row.id;
                      
                      return (
                        <div 
                          key={row.id} 
                          className={`flex items-start gap-3 p-4 border rounded-lg transition-colors ${
                            isLocked 
                              ? 'bg-muted/50 opacity-75 cursor-pointer hover:opacity-100' 
                              : 'bg-muted/30'
                          }`}
                          onClick={() => isLocked && setEditingRowId(row.id)}
                        >
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-muted-foreground">
                                Rad {index + 1}
                              </span>
                              {isEditing && (
                                <div className="flex items-center gap-1">
                                  {isLocked ? (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingRowId(row.id);
                                      }}
                                      className="gap-1 text-xs h-7"
                                    >
                                      <Pencil className="h-3 w-3" />
                                      Redigera
                                    </Button>
                                  ) : (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingRowId(null);
                                      }}
                                      className="gap-1 text-xs h-7 text-primary"
                                    >
                                      <Check className="h-3 w-3" />
                                      Klar
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {isLocked ? (
                              // Locked view - show summary
                              (() => {
                                const pricingConfig = pricing.find(p => p.id === row.pricingConfigId);
                                const pricingComment = pricingConfig?.comment;
                                
                                return (
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      {pricingComment ? (
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <span className="text-sm font-medium cursor-help underline decoration-dotted underline-offset-2">
                                              {row.priceType || 'Ingen pristyp vald'}
                                            </span>
                                          </TooltipTrigger>
                                          <TooltipContent className="max-w-xs">
                                            <p>{pricingComment}</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      ) : (
                                        <span className="text-sm font-medium">{row.priceType || 'Ingen pristyp vald'}</span>
                                      )}
                                      <span className="font-mono text-sm">{row.quantity} {row.unit?.toLowerCase() === 'kr/timme' ? 'timmar' : row.unit}</span>
                                    </div>
                                    {row.pricingConfigId && (
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">
                                          {formatCurrency(row.unitPrice)}/timme × {row.quantity} {row.unit?.toLowerCase() === 'kr/timme' ? 'timmar' : row.unit}
                                        </span>
                                        <span className="font-mono font-medium text-primary">
                                          {formatCurrency(calculateRowTotal(row))}
                                        </span>
                                      </div>
                                    )}
                                    {row.comment && (
                                      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background/50 p-2 rounded">
                                        <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                                        <span className="line-clamp-2">{row.comment}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              // Editable view
                              <>
                                <div className="grid sm:grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Pristyp</Label>
                                    <Select 
                                      value={row.pricingConfigId} 
                                      onValueChange={(value) => updateRowPricing(row.id, value)}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Välj pristyp..." />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Object.entries(pricingByCategory).map(([category, items]) => (
                                          <div key={category}>
                                            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted">
                                              {category}
                                            </div>
                                            {items.map((p) => (
                                              <SelectItem key={p.id} value={p.id}>
                                                {p.price_type}
                                              </SelectItem>
                                            ))}
                                          </div>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      {row.unit?.toLowerCase() === 'kr/timme' ? 'Antal timmar' : `Antal${row.unit ? ` (${row.unit})` : ''}`}
                                    </Label>
                                    <Input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={row.quantity}
                                      onChange={(e) => updateRowQuantity(row.id, parseFloat(e.target.value) || 0)}
                                      className="font-mono"
                                      placeholder={row.unit?.toLowerCase() === 'kr/timme' ? 'Ange antal timmar' : undefined}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Kommentar</Label>
                                  <Textarea
                                    placeholder="Lägg till en kommentar för denna rad..."
                                    value={row.comment}
                                    onChange={(e) => updateRowComment(row.id, e.target.value)}
                                    className="min-h-[60px] text-sm"
                                  />
                                </div>
                                {row.pricingConfigId && (
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">
                                      {row.unit?.toLowerCase() === 'kr/timme' 
                                        ? `${formatCurrency(row.unitPrice)}/timme × ${row.quantity} timmar`
                                        : `${formatCurrency(row.unitPrice)} × ${row.quantity} ${row.unit}`
                                      }
                                    </span>
                                    <span className="font-mono font-medium text-primary">
                                      {formatCurrency(calculateRowTotal(row))}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {!isLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeRow(row.id)}
                              className="text-destructive hover:text-destructive shrink-0"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <Button onClick={addRow} variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Lägg till rad
                </Button>
              </CardContent>
            </Card>

            {/* Navigate to Step 3 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      <strong>{calculationName}</strong> • CI: {ciIdentity} • {serviceType}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {rows.length} prisrad{rows.length !== 1 ? 'er' : ''} • Total: {formatCurrency(calculateTotalCost())}
                    </p>
                  </div>
                  <Button 
                    onClick={() => setStep(3)} 
                    disabled={!canProceedToStep3} 
                    className="gap-2"
                  >
                    Granska och bekräfta
                    <ArrowRight className="h-4 w-4" />
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
                  <Coins className="h-5 w-5 text-primary" />
                  Kostnadssammanställning
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {rows.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    Lägg till prisrader för att se kostnadssammanställning
                  </p>
                ) : (
                  <div className="space-y-3">
                    {rows.filter(r => r.pricingConfigId).map((row, index) => (
                      <div key={row.id} className="flex justify-between items-center py-2 border-b border-border/50">
                        <span className="text-muted-foreground text-sm truncate max-w-[150px]" title={row.priceType}>
                          {row.priceType}
                        </span>
                        <span className="font-mono text-sm">{formatCurrency(calculateRowTotal(row))}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t-2 border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total kostnad</span>
                    <span className="text-2xl font-bold font-mono text-primary">
                      {formatCurrency(calculateTotalCost())}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Info about calculation */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Kalkylinfo</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Namn</span>
                  <span className="font-medium truncate max-w-[150px]">{calculationName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CI-identitet</span>
                  <span className="font-mono">{ciIdentity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tjänstetyp</span>
                  <span className="text-xs">{serviceType}</span>
                </div>
              </CardContent>
            </Card>

            {/* History card for existing calculations */}
            {isEditing && createdAt && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Historik
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-3">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Skapad</p>
                    <p className="font-medium">
                      {format(new Date(createdAt), 'd MMM yyyy, HH:mm', { locale: sv })}
                    </p>
                    {createdByName && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {createdByName}
                      </p>
                    )}
                  </div>
                  {updatedAt && (
                    <div className="space-y-1 pt-2 border-t">
                      <p className="text-muted-foreground">Senast ändrad</p>
                      <p className="font-medium">
                        {format(new Date(updatedAt), 'd MMM yyyy, HH:mm', { locale: sv })}
                      </p>
                      {updatedByName && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {updatedByName}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        /* Step 3: Summary and Confirmation */
        <div className="space-y-6 max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Grundläggande information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Namn</p>
                  <p className="font-medium">{calculationName}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">CI-identitet</p>
                  <p className="font-mono">{ciIdentity}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Tjänstetyp</p>
                  <p className="text-sm">{serviceType}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-2">
                  <Pencil className="h-3 w-3" />
                  Ändra grundläggande information
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Prisrader ({rows.filter(r => r.pricingConfigId).length} st)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rows.filter(r => r.pricingConfigId).map((row, index) => (
                  <div key={row.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                    <div className="flex-1">
                      <p className="font-medium">{row.priceType}</p>
                      <p className="text-sm text-muted-foreground">
                        {row.quantity} {row.unit} × {formatCurrency(row.unitPrice)}
                      </p>
                      {row.comment && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {row.comment}
                        </p>
                      )}
                    </div>
                    <span className="font-mono font-medium text-primary">
                      {formatCurrency(calculateRowTotal(row))}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t">
                <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-2">
                  <Pencil className="h-3 w-3" />
                  Ändra prisrader
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Metadata for existing calculations */}
          {isEditing && createdAt && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Calendar className="h-5 w-5 text-primary" />
                  Historik
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Skapad</p>
                    <p className="font-medium">
                      {format(new Date(createdAt), 'd MMMM yyyy, HH:mm', { locale: sv })}
                    </p>
                    {createdByName && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {createdByName}
                      </p>
                    )}
                  </div>
                  {updatedAt && (
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Senast ändrad</p>
                      <p className="font-medium">
                        {format(new Date(updatedAt), 'd MMMM yyyy, HH:mm', { locale: sv })}
                      </p>
                      {updatedByName && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {updatedByName}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-primary" />
                Total kostnad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <span className="text-4xl font-bold font-mono text-primary">
                  {formatCurrency(calculateTotalCost())}
                </span>
                <p className="text-muted-foreground mt-2">per månad</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  Granska informationen ovan. Klicka på bekräfta för att {isEditing ? 'uppdatera' : 'spara'} kalkylen.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Tillbaka
                  </Button>
                  <Button onClick={saveCalculation} disabled={saving} className="gap-2">
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    {isEditing ? 'Bekräfta och uppdatera' : 'Bekräfta och spara'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
