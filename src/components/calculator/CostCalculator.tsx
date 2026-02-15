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
import CISelector, { type ConfigurationItem } from './CISelector';
import BudgetOutcomeInfo from './BudgetOutcomeInfo';
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
  Calendar,
  Download,
  Clock,
  CheckCircle2,
  FileEdit,
  Server,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import jsPDF from 'jspdf';

const SERVICE_TYPES = [
  { value: 'Anpassad drift', label: 'Anpassad drift' },
  { value: 'Anpassad förvaltning', label: 'Anpassad förvaltning' },
  { value: 'Bastjänst Digital infrastruktur', label: 'Bastjänst Digital infrastruktur' },
  { value: 'Bastjänst IT infrastruktur', label: 'Bastjänst IT infrastruktur' },
];


interface Organization {
  id: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  is_active: boolean;
}

interface OwningOrganization {
  id: string;
  name: string;
  is_active: boolean;
}

interface Customer {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

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
  readOnly?: boolean;
  onCreateNewVersion?: () => void;
}

export default function CostCalculator({ editCalculation, onBack, onSaved, readOnly = false, onCreateNewVersion }: CostCalculatorProps) {
  const currentYear = new Date().getFullYear();
  const [calculationName, setCalculationName] = useState(editCalculation?.name ?? '');
  const [ciIdentity, setCiIdentity] = useState(editCalculation?.ci_identity ?? '');
  const [serviceType, setServiceType] = useState(editCalculation?.service_type ?? '');
  const [customerId, setCustomerId] = useState<string | null>(editCalculation?.customer_id ?? null);
  
  const [owningOrganizationId, setOwningOrganizationId] = useState<string | null>(editCalculation?.owning_organization_id ?? null);
  const [calculationYear, setCalculationYear] = useState<number>(editCalculation?.calculation_year ?? currentYear);
  const [pricing, setPricing] = useState<PricingConfig[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [owningOrganizations, setOwningOrganizations] = useState<OwningOrganization[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rows, setRows] = useState<CalculationRow[]>([]);
  const [approvedVersionItems, setApprovedVersionItems] = useState<Array<{price_type: string; quantity: number; unit_price: number; total_price: number; comment?: string}>>([]);
  const [selectedCI, setSelectedCI] = useState<ConfigurationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(readOnly ? 3 : editCalculation ? 2 : 1);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<'draft' | 'pending_approval'>(editCalculation?.status === 'approved' || editCalculation?.status === 'closed' ? 'pending_approval' : (editCalculation?.status as 'draft' | 'pending_approval') ?? 'draft');
  
  const { user, fullName } = useAuth();
  const { toast } = useToast();
  
  const isEditing = !!editCalculation;
  const currentStatus = editCalculation?.status as 'draft' | 'pending_approval' | 'approved' | 'closed' | undefined;
  const isApproved = currentStatus === 'approved' || currentStatus === 'closed';
  const canProceedToStep2 = calculationName.trim() !== '' && ciIdentity.trim() !== '' && serviceType !== '' && customerId !== null && owningOrganizationId !== null;
  const canProceedToStep3 = rows.length > 0 && rows.some(r => r.pricingConfigId);

  useEffect(() => {
    if (!readOnly) {
      setStep(1);
    }
  }, [readOnly]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (editCalculation && pricing.length > 0) {
      loadExistingItems();
      loadLastApprovedVersion();
    }
  }, [editCalculation, pricing]);

  async function loadData() {
    try {
      const [pricingResult, organizationsResult, owningOrgsResult, customersResult] = await Promise.all([
        supabase
          .from('pricing_config')
          .select('*')
          .order('category')
          .order('price_type'),
        supabase
          .from('organizations')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('owning_organizations')
          .select('*')
          .eq('is_active', true)
          .order('name'),
        supabase
          .from('customers')
          .select('*')
          .eq('is_active', true)
          .order('name'),
      ]);

      if (pricingResult.error) throw pricingResult.error;
      if (organizationsResult.error) throw organizationsResult.error;
      if (owningOrgsResult.error) throw owningOrgsResult.error;
      if (customersResult.error) throw customersResult.error;

      setPricing(pricingResult.data as PricingConfig[]);
      setOrganizations(organizationsResult.data as Organization[]);
      setOwningOrganizations(owningOrgsResult.data as OwningOrganization[]);
      setCustomers(customersResult.data as Customer[]);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda nödvändig data.',
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

  async function loadLastApprovedVersion() {
    if (!editCalculation) return;
    
    try {
      const { data, error } = await supabase
        .from('calculation_versions')
        .select('*')
        .eq('calculation_id', editCalculation.id)
        .eq('status', 'approved')
        .order('version', { ascending: false })
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        const items = (data[0].items as any[]) || [];
        setApprovedVersionItems(items);
      } else {
        setApprovedVersionItems([]);
      }
    } catch (error) {
      console.error('Error loading approved version:', error);
    }
  }

  function populateDefaultRows() {
    // Filter pricing that has the selected serviceType in their service_types array
    // and is NOT in disallowed_service_types
    const defaultPricing = pricing.filter(p => {
      const isDisallowed = (p as any).disallowed_service_types?.includes(serviceType);
      if (isDisallowed) return false;
      return p.service_types && p.service_types.length > 0 && p.service_types.includes(serviceType);
    });
    
    const newRows: CalculationRow[] = defaultPricing.map(p => ({
      id: crypto.randomUUID(),
      pricingConfigId: p.id,
      priceType: p.price_type,
      quantity: 1,
      unitPrice: Number(p.price_per_unit),
      unit: p.unit || '',
      comment: '',
    }));
    
    setRows(newRows);
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
      const currentVersion = editCalculation?.version ?? 1;
      const newVersion = isEditing ? currentVersion + 1 : 1;
      
      // Get names for display/backwards compatibility
      const selectedCustomer = customers.find(c => c.id === customerId);
      const selectedOwningOrg = owningOrganizations.find(o => o.id === owningOrganizationId);
      
      const calculationData = {
        name: calculationName || `Beräkning ${new Date().toLocaleDateString('sv-SE')}`,
        ci_identity: ciIdentity.trim(),
        service_type: serviceType,
        customer_id: customerId,
        organization_id: null,
        owning_organization_id: owningOrganizationId,
        // Keep text fields for backwards compatibility
        municipality: selectedCustomer?.name || '',
        owning_organization: selectedOwningOrg?.name || null,
        calculation_year: calculationYear,
        total_cost: totalCost,
        updated_by_name: userName,
        // When editing an approved calculation, reset to draft status
        status: isApproved ? 'draft' : selectedStatus,
        version: newVersion,
        // Clear approval fields when creating new version from approved
        approved_by: isApproved ? null : undefined,
        approved_by_name: isApproved ? null : undefined,
        approved_at: isApproved ? null : undefined,
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
        // Save current version to history before updating
        const { data: currentItems } = await supabase
          .from('calculation_items')
          .select('*')
          .eq('calculation_id', editCalculation.id);

        await supabase.from('calculation_versions').insert({
          calculation_id: editCalculation.id,
          version: currentVersion,
          name: editCalculation.name,
          ci_identity: editCalculation.ci_identity,
          service_type: editCalculation.service_type,
          municipality: editCalculation.municipality,
          owning_organization: editCalculation.owning_organization,
          customer_id: editCalculation.customer_id,
          organization_id: editCalculation.organization_id,
          calculation_year: editCalculation.calculation_year,
          total_cost: editCalculation.total_cost,
          status: currentStatus || 'draft',
          items: currentItems || [],
          created_by: user.id,
          created_by_name: userName,
        });

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
          status: currentStatus,
          version: currentVersion,
        }, {
          name: calculationData.name,
          total_cost: calculationData.total_cost,
          status: selectedStatus,
          version: newVersion,
        });

        toast({
          title: isApproved ? 'Ny version skapad' : 'Kalkyl uppdaterad',
          description: isApproved 
            ? `En ny version (v${newVersion}) har skapats som utkast.`
            : `Kalkylen har sparats som version ${newVersion}.`,
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
          status: selectedStatus,
        });

        toast({
          title: 'Kalkyl sparad',
          description: selectedStatus === 'pending_approval' 
            ? 'Kalkylen har sparats och väntar på godkännande.'
            : 'Din nya kalkyl har skapats.',
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

  const formatCurrencyForPdf = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value) + ' kr';
  };

  function generatePdf() {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Kostnadskalkyl', pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Basic info section
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Grundlaggande information', 14, yPos);
    yPos += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Namn: ${calculationName || 'Ej angivet'}`, 14, yPos);
    yPos += 6;
    doc.text(`CI-identitet: ${ciIdentity}`, 14, yPos);
    yPos += 6;
    doc.text(`Tjanstetyp: ${serviceType}`, 14, yPos);
    yPos += 6;
    doc.text(`Kalkyl ar: ${calculationYear}`, 14, yPos);
    yPos += 6;
    doc.text(`Datum: ${format(new Date(), 'd MMMM yyyy', { locale: sv })}`, 14, yPos);
    yPos += 15;

    // Price rows header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Prisrader', 14, yPos);
    yPos += 10;

    // Table header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Pristyp', 14, yPos);
    doc.text('Antal', 100, yPos);
    doc.text('Enhetspris', 130, yPos);
    doc.text('Summa', 170, yPos);
    yPos += 2;
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 6;

    // Table rows
    doc.setFont('helvetica', 'normal');
    const validRows = rows.filter(r => r.pricingConfigId);
    
    validRows.forEach((row) => {
      // Check if we need a new page
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      const displayUnit = row.unit?.toLowerCase() === 'kr/timme' ? 'timmar' : row.unit;
      
      doc.text(row.priceType.substring(0, 40), 14, yPos);
      doc.text(`${row.quantity} ${displayUnit || ''}`, 100, yPos);
      doc.text(formatCurrencyForPdf(row.unitPrice), 130, yPos);
      doc.text(formatCurrencyForPdf(calculateRowTotal(row)), 170, yPos);
      yPos += 7;

      // Add comment if exists
      if (row.comment) {
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(`  Kommentar: ${row.comment.substring(0, 60)}`, 14, yPos);
        doc.setTextColor(0);
        doc.setFontSize(9);
        yPos += 6;
      }
    });

    yPos += 5;
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;

    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total kostnad:', 14, yPos);
    doc.text(formatCurrencyForPdf(calculateTotalCost()), 170, yPos);
    yPos += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('per manad', 170, yPos);

    // Footer
    yPos = doc.internal.pageSize.getHeight() - 20;
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(`Genererad: ${format(new Date(), 'd MMMM yyyy HH:mm', { locale: sv })}`, 14, yPos);

    // Download
    const fileName = `kalkyl-${ciIdentity || 'utan-ci'}-${calculationYear}.pdf`;
    doc.save(fileName);

    toast({
      title: 'PDF skapad',
      description: `Filen ${fileName} har laddats ner.`,
    });
  }

  // Separate pricing into default (has serviceType in service_types) and others (no service_types)
  // Exclude any pricing where serviceType is in disallowed_service_types
  const defaultPricing = pricing.filter(p => {
    const isDisallowed = (p as any).disallowed_service_types?.includes(serviceType);
    if (isDisallowed) return false;
    return p.service_types && p.service_types.length > 0 && p.service_types.includes(serviceType);
  });
  
  const otherPricing = pricing.filter(p => {
    const isDisallowed = (p as any).disallowed_service_types?.includes(serviceType);
    if (isDisallowed) return false;
    return !p.service_types || p.service_types.length === 0;
  });

  // Group default pricing by category
  const defaultPricingByCategory = defaultPricing.reduce((acc, p) => {
    const category = p.category || 'Övrigt';
    if (!acc[category]) acc[category] = [];
    acc[category].push(p);
    return acc;
  }, {} as Record<string, PricingConfig[]>);

  // Group other pricing by category
  const otherPricingByCategory = otherPricing.reduce((acc, p) => {
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
            {readOnly ? 'Visa kalkyl' : isEditing ? 'Redigera kalkyl' : 'Ny kalkyl'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {readOnly
              ? 'Denna kalkyl är godkänd och kan inte ändras'
              : step === 1 
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
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
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
                  disabled={readOnly}
                />
                <p className="text-sm text-muted-foreground">
                  Ett beskrivande namn som hjälper dig identifiera kalkylen
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ciIdentity">
                  Objekt / CI-identitet <span className="text-destructive">*</span>
                </Label>
                <CISelector
                  value={ciIdentity}
                  onChange={setCiIdentity}
                  onItemChange={setSelectedCI}
                  placeholder="Sök på CI nummer eller systemnamn..."
                  disabled={readOnly}
                />
                <p className="text-sm text-muted-foreground">
                  Välj objekt eller CI-identitet från registret, eller ange manuellt
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">
                  Kund <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={customerId || ''} 
                  onValueChange={(val) => setCustomerId(val || null)}
                  disabled={readOnly}
                >
                  <SelectTrigger id="customer" className="w-full">
                    <SelectValue placeholder="Välj kund" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Välj vilken kund kalkylen avser
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="owningOrganization">
                  Ägande organisation <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={owningOrganizationId || ''} 
                  onValueChange={(val) => setOwningOrganizationId(val || null)}
                  disabled={readOnly}
                >
                  <SelectTrigger id="owningOrganization" className="w-full">
                    <SelectValue placeholder="Välj ägande organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {owningOrganizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Vilken intern organisation som äger kalkylen
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="calculationYear">
                  Kalkylår <span className="text-destructive">*</span>
                </Label>
                <Select 
                  value={calculationYear.toString()} 
                  onValueChange={(val) => setCalculationYear(parseInt(val, 10))}
                  disabled={readOnly}
                >
                  <SelectTrigger id="calculationYear" className="w-full">
                    <SelectValue placeholder="Välj kalkylår" />
                  </SelectTrigger>
                  <SelectContent>
                    {[currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Vilket år kalkylen avser
                </p>
              </div>
              <div className="space-y-3">
                <Label>
                  Tjänstetyp <span className="text-destructive">*</span>
                </Label>
                <RadioGroup value={serviceType} onValueChange={setServiceType} className="space-y-2" disabled={readOnly}>
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
                  onClick={() => {
                    if (!isEditing && rows.length === 0) {
                      populateDefaultRows();
                    }
                    setStep(2);
                  }} 
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

          {/* CI Information Panel */}
          <div className="lg:col-span-1">
            {selectedCI ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Server className="h-5 w-5 text-primary" />
                      Objekt och CI-information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">CI nummer</p>
                      <p className="font-medium">{selectedCI.ci_number}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Systemnamn</p>
                      <p className="font-medium">{selectedCI.system_name}</p>
                    </div>
                    {selectedCI.system_owner && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Systemägare</p>
                        <p className="font-medium">{selectedCI.system_owner}</p>
                      </div>
                    )}
                    {selectedCI.system_administrator && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Systemförvaltare</p>
                        <p className="font-medium">{selectedCI.system_administrator}</p>
                      </div>
                    )}
                    {selectedCI.organization && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Organisation</p>
                        <p className="font-medium">{selectedCI.organization}</p>
                      </div>
                    )}
                    {selectedCI.object_number && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Objektnummer</p>
                        <p className="font-medium">{selectedCI.object_number}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <BudgetOutcomeInfo objectNumber={selectedCI.object_number || null} />
              </>
            ) : (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Server className="h-12 w-12 text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">
                    Välj en CI-identitet för att visa information om systemet
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
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
                      const isRowEditing = !readOnly && (!isEditing || editingRowId === row.id);
                      const isLocked = readOnly || (isEditing && editingRowId !== row.id);
                      
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
                              {isEditing && !readOnly && (
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
                                        {Object.keys(defaultPricingByCategory).length > 0 && (
                                          <>
                                            <div className="px-2 py-1.5 text-xs font-bold text-primary bg-primary/10">
                                              Default för {serviceType}
                                            </div>
                                            {Object.entries(defaultPricingByCategory).map(([category, items]) => (
                                              <div key={`default-${category}`}>
                                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                                                  {category}
                                                </div>
                                                {items.map((p) => (
                                                  <SelectItem key={p.id} value={p.id}>
                                                    {p.price_type}
                                                  </SelectItem>
                                                ))}
                                              </div>
                                            ))}
                                          </>
                                        )}
                                        {Object.keys(otherPricingByCategory).length > 0 && (
                                          <>
                                            <div className="px-2 py-1.5 text-xs font-bold text-muted-foreground bg-muted/50 mt-2">
                                              Övriga pristyper
                                            </div>
                                            {Object.entries(otherPricingByCategory).map(([category, items]) => (
                                              <div key={`other-${category}`}>
                                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground bg-muted">
                                                  {category}
                                                </div>
                                                {items.map((p) => (
                                                  <SelectItem key={p.id} value={p.id}>
                                                    {p.price_type}
                                                  </SelectItem>
                                                ))}
                                              </div>
                                            ))}
                                          </>
                                        )}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">
                                      {row.unit?.toLowerCase() === 'kr/timme' ? 'Antal timmar' : `Antal${row.unit ? ` (${row.unit})` : ''}`}
                                    </Label>
                                    <Input
                                      type="text"
                                      inputMode="decimal"
                                      value={row.quantity === 0 ? '' : row.quantity.toString()}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        if (val === '' || /^[0-9]*[.,]?[0-9]*$/.test(val)) {
                                          const numVal = val === '' ? 0 : parseFloat(val.replace(',', '.')) || 0;
                                          updateRowQuantity(row.id, numVal);
                                        }
                                      }}
                                      onBlur={(e) => {
                                        const val = e.target.value;
                                        const numVal = val === '' ? 0 : parseFloat(val.replace(',', '.')) || 0;
                                        updateRowQuantity(row.id, Math.max(0, numVal));
                                      }}
                                      className="font-mono"
                                      placeholder={row.unit?.toLowerCase() === 'kr/timme' ? 'Ange antal timmar' : '0'}
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
                
                {!readOnly && (
                  <Button onClick={addRow} variant="outline" className="w-full gap-2">
                    <Plus className="h-4 w-4" />
                    Lägg till rad
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Navigate to Step 3 */}
            <Card>
              <CardContent className="pt-6 flex justify-end">
                  <Button 
                    onClick={() => setStep(3)} 
                    disabled={!canProceedToStep3} 
                    className="gap-2"
                  >
                    Granska och bekräfta
                    <ArrowRight className="h-4 w-4" />
                  </Button>
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
                    {rows.filter(r => r.pricingConfigId).map((row) => {
                      const pricingConfig = pricing.find(p => p.id === row.pricingConfigId);
                      const ukonto = (pricingConfig as any)?.ukonto || '';
                      const approvedItem = approvedVersionItems.find(i => i.price_type === row.priceType);
                      const currentTotal = calculateRowTotal(row);
                      const diff = approvedItem ? currentTotal - Number(approvedItem.total_price) : null;
                      
                      return (
                        <div key={row.id} className="py-2 border-b border-border/50">
                          <div className="flex justify-between items-center">
                            <div className="truncate max-w-[150px]">
                              <span className="text-muted-foreground text-sm" title={row.priceType}>
                                {row.priceType}
                              </span>
                              {ukonto && (
                                <span className="text-xs text-muted-foreground ml-1">({ukonto})</span>
                              )}
                            </div>
                            <span className="font-mono text-sm">{formatCurrency(currentTotal)}</span>
                          </div>
                          {approvedItem && (
                            <div className="flex justify-between items-center mt-1">
                              <span className="text-xs text-muted-foreground">Godkänd version</span>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">{formatCurrency(Number(approvedItem.total_price))}</span>
                                {diff !== null && diff !== 0 && (
                                  <span className={`font-mono text-xs ${diff > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                    {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="pt-4 border-t-2 border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold">Total kostnad</span>
                    <span className="text-2xl font-bold font-mono text-primary">
                      {formatCurrency(calculateTotalCost())}
                    </span>
                  </div>
                  {approvedVersionItems.length > 0 && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-xs text-muted-foreground">Godkänd version</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatCurrency(approvedVersionItems.reduce((sum, i) => sum + Number(i.total_price), 0))}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Budget & Utfall popup button */}
            {selectedCI?.object_number && (
              <Button
                className="w-full gap-2"
                onClick={() => {
                  const objNr = selectedCI.object_number;
                  const popup = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
                  if (!popup) return;
                  popup.document.write('<html><head><title>Budget & Utfall – Objekt ' + objNr + '</title><style>body{font-family:system-ui,sans-serif;margin:20px;color:#333}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{padding:8px 12px;text-align:left;border-bottom:1px solid #e5e7eb;font-size:14px}th{background:#f3f4f6;font-weight:600;font-size:13px}.right{text-align:right}.section{background:#f9fafb;font-weight:600;padding:6px 12px;font-size:13px}.subtotal{font-weight:600;border-top:2px solid #d1d5db}.grand{font-weight:700;border-top:3px solid #6b7280;font-size:15px}.indent{padding-left:24px}.loading{text-align:center;padding:40px;color:#999}</style></head><body>');
                  popup.document.write('<h2>Budget & Utfall – Objekt ' + objNr + '</h2>');
                  popup.document.write('<p class="loading">Laddar data...</p>');
                  popup.document.write('</body></html>');
                  popup.document.close();
                  supabase
                    .from('budget_outcomes')
                    .select('vht, ansvar, budget_2025, budget_2026, utfall_ack, mot')
                    .not('mot', 'is', null)
                    .then(({ data, error }) => {
                      if (!popup || popup.closed) return;
                      if (error || !data) {
                        popup.document.body.innerHTML = '<h2>Fel vid laddning</h2><p>' + (error?.message || 'Ingen data') + '</p>';
                        return;
                      }
                      const matched = data.filter((row: any) => {
                        if (!row.mot) return false;
                        return row.mot.split(' ')[0].trim() === objNr;
                      });
                      if (matched.length === 0) {
                        popup.document.body.innerHTML = '<h2>Budget & Utfall – Objekt ' + objNr + '</h2><p>Ingen data hittades.</p>';
                        return;
                      }
                      
                      // Build data with ansvar info
                      const rowsWithAnsvar = matched.map((row: any) => ({
                        vht: row.vht || '(tomt)',
                        ansvar: row.ansvar || '(tomt)',
                        utfall_ack: row.utfall_ack || 0,
                        budget_2025: row.budget_2025 || 0,
                        budget_2026: row.budget_2026 || 0,
                      }));
                      
                      const uniqueAnsvar = Array.from(new Set(rowsWithAnsvar.map((r: any) => r.ansvar))).sort((a: string, b: string) => a.localeCompare(b, 'sv'));
                      
                      let html = '<style>.filter-box{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:16px}.filter-box h3{margin:0 0 8px;font-size:14px;color:#555}.filter-items{display:flex;flex-wrap:wrap;gap:8px}.filter-item{display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer}.filter-item input{cursor:pointer}.filter-actions{margin-top:8px;display:flex;gap:8px}.filter-btn{background:#e5e7eb;border:none;padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer}.filter-btn:hover{background:#d1d5db}</style>';
                      html += '<h2>Budget & Utfall – Objekt ' + objNr + '</h2>';
                      
                      // Ansvar filter
                      html += '<div class="filter-box"><h3>Inkluderade ansvar</h3><div class="filter-items">';
                      uniqueAnsvar.forEach((a: string) => {
                        html += '<label class="filter-item"><input type="checkbox" checked data-ansvar="' + a.replace(/"/g, '&quot;') + '" onchange="filterRows()"> ' + a + '</label>';
                      });
                      html += '</div><div class="filter-actions"><button class="filter-btn" onclick="toggleAll(true)">Markera alla</button><button class="filter-btn" onclick="toggleAll(false)">Avmarkera alla</button></div></div>';
                      html += '<div id="table-container"></div>';
                      
                      html += '<script>';
                      html += 'var allRows = ' + JSON.stringify(rowsWithAnsvar) + ';';
                      html += 'function fmt(n) { return new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 }).format(n); }';
                      html += 'function toggleAll(state) { document.querySelectorAll("[data-ansvar]").forEach(function(cb) { cb.checked = state; }); filterRows(); }';
                      html += 'function filterRows() {';
                      html += '  var checked = []; document.querySelectorAll("[data-ansvar]:checked").forEach(function(cb) { checked.push(cb.getAttribute("data-ansvar")); });';
                      html += '  var filtered = allRows.filter(function(r) { return checked.indexOf(r.ansvar) >= 0; });';
                      html += '  var map = {};';
                      html += '  filtered.forEach(function(r) { var k = r.vht; if (!map[k]) map[k] = { vht: k, utfall_ack: 0, budget_2025: 0, budget_2026: 0 }; map[k].utfall_ack += r.utfall_ack; map[k].budget_2025 += r.budget_2025; map[k].budget_2026 += r.budget_2026; });';
                      html += '  var grouped = Object.values(map).sort(function(a, b) { return a.vht.localeCompare(b.vht, "sv"); });';
                      html += '  var incomeRows = grouped.filter(function(r) { return r.budget_2026 >= 0; });';
                      html += '  var costRows = grouped.filter(function(r) { return r.budget_2026 < 0; });';
                      html += '  var h = "<table><thead><tr><th>Konto</th><th class=\\"right\\">Utfall ack.</th><th class=\\"right\\">Budget 2025</th><th class=\\"right\\">Budget 2026</th></tr></thead><tbody>";';
                      html += '  function sumArr(arr) { return arr.reduce(function(a,r) { return { utfall_ack: a.utfall_ack+r.utfall_ack, budget_2025: a.budget_2025+r.budget_2025, budget_2026: a.budget_2026+r.budget_2026 }; }, { utfall_ack:0, budget_2025:0, budget_2026:0 }); }';
                      html += '  function renderSection(title, sRows) {';
                      html += '    var t = sumArr(sRows);';
                      html += '    h += "<tr><td colspan=\\"4\\" class=\\"section\\">" + title + "</td></tr>";';
                      html += '    sRows.forEach(function(r) { h += "<tr><td class=\\"indent\\">" + r.vht + "</td><td class=\\"right\\">" + fmt(r.utfall_ack) + "</td><td class=\\"right\\">" + fmt(r.budget_2025) + "</td><td class=\\"right\\">" + fmt(r.budget_2026) + "</td></tr>"; });';
                      html += '    h += "<tr class=\\"subtotal\\"><td class=\\"indent\\">Summa " + title.toLowerCase() + "</td><td class=\\"right\\">" + fmt(t.utfall_ack) + "</td><td class=\\"right\\">" + fmt(t.budget_2025) + "</td><td class=\\"right\\">" + fmt(t.budget_2026) + "</td></tr>";';
                      html += '  }';
                      html += '  if (incomeRows.length > 0) renderSection("Intäkter", incomeRows);';
                      html += '  if (costRows.length > 0) renderSection("Kostnader", costRows);';
                      html += '  var grand = sumArr(grouped);';
                      html += '  h += "<tr class=\\"grand\\"><td>Netto</td><td class=\\"right\\">" + fmt(grand.utfall_ack) + "</td><td class=\\"right\\">" + fmt(grand.budget_2025) + "</td><td class=\\"right\\">" + fmt(grand.budget_2026) + "</td></tr>";';
                      html += '  h += "</tbody></table>";';
                      html += '  document.getElementById("table-container").innerHTML = h;';
                      html += '}';
                      html += 'filterRows();';
                      html += '<\/script>';
                      
                      popup.document.body.innerHTML = html;
                      // Re-execute scripts since innerHTML doesn't run them
                      var scripts = popup.document.querySelectorAll('script');
                      scripts.forEach(function(s: any) {
                        var ns = popup!.document.createElement('script');
                        ns.textContent = s.textContent;
                        s.parentNode!.replaceChild(ns, s);
                      });
                    });
                }}
              >
                <ExternalLink className="h-4 w-4" />
                Visa budget och utfall (öppnas i eget fönster)
              </Button>
            )}

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
                  <span className="text-muted-foreground">Objektnummer</span>
                  <span className="font-mono">{selectedCI?.object_number || ''}</span>
                </div>
                {selectedCI?.ci_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">CI-identitet</span>
                    <span className="font-mono">{selectedCI.ci_number}</span>
                  </div>
                )}
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
              {!readOnly && (
                <div className="mt-4 pt-4 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setStep(1)} className="gap-2">
                    <Pencil className="h-3 w-3" />
                    Ändra grundläggande information
                  </Button>
                </div>
              )}
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
                {rows.filter(r => r.pricingConfigId).map((row) => {
                  const pricingConfig = pricing.find(p => p.id === row.pricingConfigId);
                  const ukonto = (pricingConfig as any)?.ukonto || '';
                  const approvedItem = approvedVersionItems.find(i => i.price_type === row.priceType);
                  const currentTotal = calculateRowTotal(row);
                  const diff = approvedItem ? currentTotal - Number(approvedItem.total_price) : null;
                  
                  return (
                    <div key={row.id} className="py-3 border-b border-border/50 last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{row.priceType}</p>
                            {ukonto && (
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                Ukonto: {ukonto}
                              </span>
                            )}
                          </div>
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
                        <div className="text-right">
                          <span className="font-mono font-medium text-primary">
                            {formatCurrency(currentTotal)}
                          </span>
                          {approvedItem && (
                            <div className="mt-0.5">
                              <span className="font-mono text-xs text-muted-foreground">
                                Godkänd: {formatCurrency(Number(approvedItem.total_price))}
                              </span>
                              {diff !== null && diff !== 0 && (
                                <span className={`font-mono text-xs ml-1 ${diff > 0 ? 'text-destructive' : 'text-green-600'}`}>
                                  ({diff > 0 ? '+' : ''}{formatCurrency(diff)})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!readOnly && (
                <div className="mt-4 pt-4 border-t">
                  <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="gap-2">
                    <Pencil className="h-3 w-3" />
                    Ändra prisrader
                  </Button>
                </div>
              )}
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
                {approvedVersionItems.length > 0 && (() => {
                  const approvedTotal = approvedVersionItems.reduce((sum, i) => sum + Number(i.total_price), 0);
                  const totalDiff = calculateTotalCost() - approvedTotal;
                  return (
                    <div className="mt-3 pt-3 border-t border-primary/20">
                      <p className="text-sm text-muted-foreground">
                        Godkänd version: <span className="font-mono">{formatCurrency(approvedTotal)}</span>
                      </p>
                      {totalDiff !== 0 && (
                        <p className={`text-sm font-mono font-medium ${totalDiff > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          Differens: {totalDiff > 0 ? '+' : ''}{formatCurrency(totalDiff)}
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Status Selection */}
          {readOnly ? (
            <Card className="border-green-500/50 bg-green-500/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-green-600 font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Denna kalkyl är godkänd (v{editCalculation?.version})
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Godkända kalkyler kan inte ändras. Du kan skapa en ny version baserad på denna kalkyl.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className={isApproved ? 'border-green-500/50 bg-green-500/5' : ''}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  {isApproved ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <FileText className="h-5 w-5 text-primary" />
                  )}
                  Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isApproved ? (
                  <div className="space-y-2">
                    <p className="text-green-600 font-medium flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Denna kalkyl är godkänd (v{editCalculation?.version})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      När du sparar ändringar skapas en ny version (v{(editCalculation?.version || 0) + 1}) med status "Ej klar".
                      Den tidigare godkända versionen sparas i historiken och kan visas i kalkyllistan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Välj status för kalkylen vid sparning:
                    </p>
                    <RadioGroup 
                      value={selectedStatus} 
                      onValueChange={(v) => setSelectedStatus(v as 'draft' | 'pending_approval')}
                      className="space-y-3"
                    >
                      <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="draft" id="status-draft" className="mt-0.5" />
                        <Label htmlFor="status-draft" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <FileEdit className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">Ej klar</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Kalkylen är under arbete och inte redo för godkännande
                          </p>
                        </Label>
                      </div>
                      <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                        <RadioGroupItem value="pending_approval" id="status-pending" className="mt-0.5" />
                        <Label htmlFor="status-pending" className="flex-1 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-500" />
                            <span className="font-medium">Klar (men ej godkänd)</span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            Kalkylen är klar och väntar på godkännande
                          </p>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {readOnly ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Vill du göra ändringar? Skapa en ny version baserad på denna godkända kalkyl.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={onBack} className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Tillbaka till lista
                      </Button>
                      <Button onClick={onCreateNewVersion} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Skapa ny version
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
