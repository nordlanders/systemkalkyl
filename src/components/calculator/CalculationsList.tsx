import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, type Calculation } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Calculator, 
  Plus, 
  Pencil, 
  Trash2, 
  Loader2,
  FileText,
  User,
  Calendar,
  Filter
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
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

  const { user, isAdmin, canWrite } = useAuth();
  const { toast } = useToast();

  // Get unique years from calculations for the filter
  const availableYears = [...new Set(calculations.map(c => (c as any).calculation_year as number))].filter(Boolean).sort((a, b) => b - a);

  // Filter calculations by selected year
  const filteredCalculations = selectedYear === 'all' 
    ? calculations 
    : calculations.filter(c => (c as any).calculation_year === selectedYear);

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
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select 
                value={selectedYear.toString()} 
                onValueChange={(val) => setSelectedYear(val === 'all' ? 'all' : parseInt(val, 10))}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Välj år" />
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
            </div>
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
                    <TableHead>Namn</TableHead>
                    <TableHead>Tjänstetyp</TableHead>
                    <TableHead>Kalkylår</TableHead>
                    <TableHead>Total kostnad</TableHead>
                    <TableHead>Skapad</TableHead>
                    <TableHead>Senast ändrad</TableHead>
                    {canWrite && <TableHead className="text-right">Åtgärder</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredCalculations.map((calc) => {
                  const createdByName = calc.created_by_name;
                  const updatedByName = calc.updated_by_name;
                  const updatedAt = calc.updated_at;
                  const calculationYear = (calc as any).calculation_year;
                  
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
                      {canWrite && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(calc)}
                              title="Redigera"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(calc.id)}
                              title="Ta bort"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
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
    </div>
  );
}
