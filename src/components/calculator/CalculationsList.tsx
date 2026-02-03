import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, type Calculation } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { 
  Calculator, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  FileText,
  User,
  Calendar,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Search,
  X,
  Clock,
  CheckCircle2,
  FileEdit,
  History
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import jsPDF from 'jspdf';
import sundsvallsKommunLogo from '@/assets/sundsvalls-kommun-logo.png';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import VersionHistoryDialog from './VersionHistoryDialog';

interface CalculationsListProps {
  onEdit: (calculation: Calculation) => void;
  onCreateNew: () => void;
}

export default function CalculationsList({ onEdit, onCreateNew }: CalculationsListProps) {
  const currentYear = new Date().getFullYear();
  const [calculations, setCalculations] = useState<Calculation[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('all');
  const [selectedServiceType, setSelectedServiceType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [historyCalculation, setHistoryCalculation] = useState<Calculation | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const { user, isAdmin, canWrite } = useAuth();
  const { toast } = useToast();

  // Get unique values for filters
  const availableYears = [...new Set(calculations.map(c => c.calculation_year))].filter(Boolean).sort((a, b) => b - a);
  const availableMunicipalities = [...new Set(calculations.map(c => c.municipality))].filter(Boolean).sort();
  const availableServiceTypes = [...new Set(calculations.map(c => c.service_type))].filter(Boolean).sort();

  // Filter calculations
  const filteredByFilters = calculations.filter(c => {
    const matchesYear = selectedYear === 'all' || c.calculation_year === selectedYear;
    const matchesMunicipality = selectedMunicipality === 'all' || c.municipality === selectedMunicipality;
    const matchesServiceType = selectedServiceType === 'all' || c.service_type === selectedServiceType;
    const matchesStatus = selectedStatus === 'all' || c.status === selectedStatus;
    
    // Search in name, CI-identity, municipality, and service type
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = !searchLower || 
      (c.name || '').toLowerCase().includes(searchLower) ||
      (c.ci_identity || '').toLowerCase().includes(searchLower) ||
      (c.municipality || '').toLowerCase().includes(searchLower) ||
      (c.service_type || '').toLowerCase().includes(searchLower) ||
      (c.owning_organization || '').toLowerCase().includes(searchLower);
    
    return matchesYear && matchesMunicipality && matchesServiceType && matchesStatus && matchesSearch;
  });

  // Sort calculations
  const filteredCalculations = [...filteredByFilters].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortColumn) {
      case 'name':
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
        break;
      case 'service_type':
        aValue = (a.service_type || '').toLowerCase();
        bValue = (b.service_type || '').toLowerCase();
        break;
      case 'municipality':
        aValue = (a.municipality || '').toLowerCase();
        bValue = (b.municipality || '').toLowerCase();
        break;
      case 'calculation_year':
        aValue = a.calculation_year || 0;
        bValue = b.calculation_year || 0;
        break;
      case 'total_cost':
        aValue = Number(a.total_cost) || 0;
        bValue = Number(b.total_cost) || 0;
        break;
      case 'created_at':
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      case 'updated_at':
        aValue = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        bValue = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-4 w-4 ml-1" /> 
      : <ArrowDown className="h-4 w-4 ml-1" />;
  }

  function clearAllFilters() {
    setSelectedYear(currentYear);
    setSelectedMunicipality('all');
    setSelectedServiceType('all');
    setSelectedStatus('all');
    setSearchQuery('');
  }

  const hasActiveFilters = selectedYear !== currentYear || selectedMunicipality !== 'all' || selectedServiceType !== 'all' || selectedStatus !== 'all' || searchQuery !== '';

  useEffect(() => {
    loadCalculations();
  }, [isAdmin, user?.id]);

  async function loadCalculations() {
    try {
      let query = supabase
        .from('calculations')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isAdmin) {
        query = query.eq('user_id', user?.id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCalculations(data as Calculation[]);
    } catch (error) {
      console.error('Error loading calculations:', error);
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda kalkyler.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;

    setDeleting(true);
    try {
      const calcToDelete = calculations.find(c => c.id === deleteId);
      
      const { error } = await supabase
        .from('calculations')
        .delete()
        .eq('id', deleteId);

      if (error) throw error;

      await logAudit('delete', 'calculations', deleteId, {
        name: calcToDelete?.name,
        total_cost: calcToDelete?.total_cost,
      });

      setCalculations(calculations.filter(c => c.id !== deleteId));
      toast({
        title: 'Kalkyl borttagen',
        description: 'Kalkylen har tagits bort.',
      });
    } catch (error) {
      console.error('Error deleting calculation:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort kalkylen.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
      setDeleteId(null);
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

  async function generatePdf(calc: Calculation) {
    // Load calculation items for this calculation
    const { data: items, error } = await supabase
      .from('calculation_items')
      .select('*')
      .eq('calculation_id', calc.id);

    if (error) {
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda kalkylrader för PDF.',
        variant: 'destructive',
      });
      return;
    }

    // Helper function to load image as base64
    const loadImageAsBase64 = (src: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = src;
      });
    };

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let yPos = 15;
    const calculationYear = (calc as any).calculation_year;

    // Add logo at the top
    try {
      const sundsvallsBase64 = await loadImageAsBase64(sundsvallsKommunLogo);
      
      // Sundsvalls kommun logo on the left
      doc.addImage(sundsvallsBase64, 'PNG', 14, yPos, 40, 16);
    } catch (e) {
      console.error('Could not load logo:', e);
    }
    
    yPos += 25;

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
    doc.text(`Namn: ${calc.name || 'Ej angivet'}`, 14, yPos);
    yPos += 6;
    doc.text(`CI-identitet: ${calc.ci_identity}`, 14, yPos);
    yPos += 6;
    doc.text(`Tjanstetyp: ${calc.service_type}`, 14, yPos);
    yPos += 6;
    doc.text(`Kalkyl ar: ${calculationYear || '-'}`, 14, yPos);
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
    
    if (items && items.length > 0) {
      items.forEach((item: any) => {
        // Check if we need a new page
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }

        doc.text((item.price_type || '').substring(0, 40), 14, yPos);
        doc.text(`${item.quantity}`, 100, yPos);
        doc.text(formatCurrencyForPdf(Number(item.unit_price)), 130, yPos);
        doc.text(formatCurrencyForPdf(Number(item.total_price)), 170, yPos);
        yPos += 7;

        // Add comment if exists
        if (item.comment) {
          doc.setFontSize(8);
          doc.setTextColor(100);
          doc.text(`  Kommentar: ${item.comment.substring(0, 60)}`, 14, yPos);
          doc.setTextColor(0);
          doc.setFontSize(9);
          yPos += 6;
        }
      });
    }

    yPos += 5;
    doc.line(14, yPos, pageWidth - 14, yPos);
    yPos += 10;

    // Total
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Total kostnad:', 14, yPos);
    doc.text(formatCurrencyForPdf(Number(calc.total_cost)), 170, yPos);
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
    const fileName = `kalkyl-${calc.ci_identity || 'utan-ci'}-${calculationYear || 'utan-ar'}.pdf`;
    doc.save(fileName);

    toast({
      title: 'PDF skapad',
      description: `Filen ${fileName} har laddats ner.`,
    });
  }

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
          <h1 className="text-3xl font-bold text-foreground">Mina kalkyler</h1>
          <p className="text-muted-foreground mt-1">
            Hantera dina sparade kostnadskalkyler
          </p>
        </div>
        {canWrite && (
          <Button onClick={onCreateNew} className="gap-2">
            <Plus className="h-4 w-4" />
            Skapa ny kalkyl
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Sparade kalkyler
              </CardTitle>
              <CardDescription>
                Klicka på en kalkyl för att redigera den
              </CardDescription>
            </div>
          </div>
          
          {/* Search and Filters */}
          <div className="flex flex-col gap-3 mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Sök på namn, CI, kund, organisation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(val) => setSelectedYear(val === 'all' ? 'all' : parseInt(val, 10))}
              >
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Kalkylår" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla år</SelectItem>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedMunicipality} 
                onValueChange={setSelectedMunicipality}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Kund" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla kunder</SelectItem>
                  {availableMunicipalities.map((mun) => (
                    <SelectItem key={mun} value={mun}>
                      {mun}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedStatus} 
                onValueChange={setSelectedStatus}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla statusar</SelectItem>
                  <SelectItem value="draft">Ej klar</SelectItem>
                  <SelectItem value="pending_approval">Väntar godkännande</SelectItem>
                  <SelectItem value="approved">Godkänd</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={selectedServiceType} 
                onValueChange={setSelectedServiceType}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tjänstetyp" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alla tjänstetyper</SelectItem>
                  {availableServiceTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAllFilters}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4 mr-1" />
                  Rensa filter
                </Button>
              )}
            </div>
            
            {filteredCalculations.length > 0 && (
              <p className="text-sm text-muted-foreground">
                Visar {filteredCalculations.length} av {calculations.length} kalkyler
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {calculations.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Inga kalkyler ännu
              </h3>
              <p className="text-muted-foreground mb-4">
                {canWrite ? 'Skapa din första kalkyl för att komma igång.' : 'Det finns inga kalkyler att visa.'}
              </p>
              {canWrite && (
                <Button onClick={onCreateNew} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Skapa ny kalkyl
                </Button>
              )}
            </div>
          ) : filteredCalculations.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">
                Inga kalkyler för {selectedYear}
              </h3>
              <p className="text-muted-foreground mb-4">
                Välj ett annat år eller skapa en ny kalkyl.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead 
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center">
                        Namn
                        <SortIcon column="name" />
                      </div>
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('municipality')}
                    >
                      <div className="flex items-center">
                        Kund
                        <SortIcon column="municipality" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('service_type')}
                    >
                      <div className="flex items-center">
                        Tjänstetyp
                        <SortIcon column="service_type" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('calculation_year')}
                    >
                      <div className="flex items-center">
                        Kalkylår
                        <SortIcon column="calculation_year" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('total_cost')}
                    >
                      <div className="flex items-center">
                        Total kostnad
                        <SortIcon column="total_cost" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('created_at')}
                    >
                      <div className="flex items-center">
                        Skapad
                        <SortIcon column="created_at" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted select-none"
                      onClick={() => handleSort('updated_at')}
                    >
                      <div className="flex items-center">
                        Senast ändrad
                        <SortIcon column="updated_at" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Åtgärder</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredCalculations.map((calc) => {
                  const createdByName = calc.created_by_name;
                  const updatedByName = calc.updated_by_name;
                  const updatedAt = calc.updated_at;
                  const calculationYear = calc.calculation_year;
                  const municipality = calc.municipality;
                  const status = calc.status;
                  
                  const statusConfig = {
                    draft: { label: 'Ej klar', icon: FileEdit, variant: 'secondary' as const, className: '' },
                    pending_approval: { label: 'Väntar godkännande', icon: Clock, variant: 'outline' as const, className: 'border-amber-500 text-amber-600' },
                    approved: { label: 'Godkänd', icon: CheckCircle2, variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700' },
                  };
                  const currentStatus = statusConfig[status || 'draft'];
                  const StatusIcon = currentStatus.icon;
                  
                  return (
                    <TableRow 
                      key={calc.id} 
                      className={canWrite ? "cursor-pointer hover:bg-muted/50" : ""}
                      onClick={() => canWrite && onEdit(calc)}
                    >
                      <TableCell className="font-medium">
                        {calc.name || 'Namnlös'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={currentStatus.variant} className={`gap-1 ${currentStatus.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {currentStatus.label}
                          </Badge>
                          {status === 'approved' && calc.version > 1 && (
                            <span className="text-xs text-muted-foreground">
                              v{calc.version}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary">
                          {municipality || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-1 rounded bg-muted">
                          {calc.service_type || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">
                        {calculationYear || '-'}
                      </TableCell>
                      <TableCell className="font-mono font-medium text-primary">
                        {formatCurrency(Number(calc.total_cost))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex flex-col">
                              <span>{format(new Date(calc.created_at), 'd MMM yyyy', { locale: sv })}</span>
                              {createdByName && (
                                <span className="text-xs flex items-center gap-1">
                                  <User className="h-3 w-3" />
                                  {createdByName}
                                </span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Skapad {format(new Date(calc.created_at), 'd MMMM yyyy HH:mm', { locale: sv })}</p>
                            {createdByName && <p>Av: {createdByName}</p>}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {updatedAt ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex flex-col">
                                <span>{format(new Date(updatedAt), 'd MMM yyyy', { locale: sv })}</span>
                                {updatedByName && (
                                  <span className="text-xs flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {updatedByName}
                                  </span>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Ändrad {format(new Date(updatedAt), 'd MMMM yyyy HH:mm', { locale: sv })}</p>
                              {updatedByName && <p>Av: {updatedByName}</p>}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {status === 'approved' && calc.version > 1 && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setHistoryCalculation(calc)}
                                title="Visa versionshistorik"
                              >
                                <History className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => generatePdf(calc)}
                              title="Ladda ner PDF"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onEdit(calc)}
                                title={status === 'approved' ? 'Skapa ny version' : 'Redigera'}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(calc.id)}
                                title="Ta bort"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                    </TableRow>
                  );
                })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ta bort kalkyl</AlertDialogTitle>
            <AlertDialogDescription>
              Är du säker på att du vill ta bort denna kalkyl? 
              Denna åtgärd kan inte ångras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Avbryt</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Ta bort
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <VersionHistoryDialog
        calculation={historyCalculation}
        open={!!historyCalculation}
        onOpenChange={(open) => !open && setHistoryCalculation(null)}
      />
    </div>
  );
}
