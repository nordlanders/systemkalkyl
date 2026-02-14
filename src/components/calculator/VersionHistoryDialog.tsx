import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { type Calculation, type CalculationVersion } from '@/lib/supabase';
import { Loader2, History, Eye, ArrowLeft, Clock, CheckCircle2, FileEdit, User, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface VersionHistoryDialogProps {
  calculation: Calculation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface VersionItem {
  price_type: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  comment?: string;
}

export default function VersionHistoryDialog({
  calculation,
  open,
  onOpenChange,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<CalculationVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<CalculationVersion | null>(null);

  useEffect(() => {
    if (open && calculation) {
      loadVersions();
    }
  }, [open, calculation]);

  async function loadVersions() {
    if (!calculation) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calculation_versions')
        .select('*')
        .eq('calculation_id', calculation.id)
        .order('version', { ascending: false });

      if (error) throw error;
      setVersions((data || []) as CalculationVersion[]);
    } catch (error) {
      console.error('Error loading versions:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('sv-SE', {
      style: 'currency',
      currency: 'SEK',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusConfig = (status: string) => {
    const configs = {
      draft: { label: 'Ej klar', icon: FileEdit, variant: 'secondary' as const, className: '' },
      pending_approval: { label: 'Väntar godkännande', icon: Clock, variant: 'outline' as const, className: 'border-amber-500 text-amber-600' },
      approved: { label: 'Godkänd', icon: CheckCircle2, variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700' },
      closed: { label: 'Avslutad', icon: Archive, variant: 'outline' as const, className: 'border-muted-foreground text-muted-foreground' },
    };
    return configs[status as keyof typeof configs] || configs.draft;
  };

  const handleClose = () => {
    setSelectedVersion(null);
    onOpenChange(false);
  };

  if (selectedVersion) {
    const statusConfig = getStatusConfig(selectedVersion.status);
    const StatusIcon = statusConfig.icon;
    const items = (selectedVersion.items as VersionItem[]) || [];

    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedVersion(null)}
                className="h-8 w-8"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <DialogTitle className="flex items-center gap-2">
                  Version {selectedVersion.version}
                  <Badge variant={statusConfig.variant} className={`gap-1 ${statusConfig.className}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  Sparad {format(new Date(selectedVersion.created_at), 'd MMMM yyyy HH:mm', { locale: sv })}
                  {selectedVersion.created_by_name && ` av ${selectedVersion.created_by_name}`}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Namn</p>
                <p className="font-medium">{selectedVersion.name || 'Ej angivet'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">CI-identitet</p>
                <p className="font-medium">{selectedVersion.ci_identity}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kund</p>
                <p className="font-medium">{selectedVersion.municipality}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tjänstetyp</p>
                <p className="font-medium">{selectedVersion.service_type}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ägande organisation</p>
                <p className="font-medium">{selectedVersion.owning_organization || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Kalkylår</p>
                <p className="font-medium">{selectedVersion.calculation_year}</p>
              </div>
            </div>

            {/* Items table */}
            <div>
              <h4 className="font-medium mb-2">Prisrader</h4>
              <ScrollArea className="h-[300px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Pristyp</TableHead>
                      <TableHead className="text-right">Antal</TableHead>
                      <TableHead className="text-right">Enhetspris</TableHead>
                      <TableHead className="text-right">Summa</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Inga prisrader sparade
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div>
                              {item.price_type}
                              {item.comment && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {item.comment}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(Number(item.unit_price))}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {formatCurrency(Number(item.total_price))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center p-4 bg-primary/10 rounded-lg">
              <span className="font-medium">Total kostnad</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(Number(selectedVersion.total_cost))}
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Versionshistorik
          </DialogTitle>
          <DialogDescription>
            {calculation?.name || 'Kalkyl'} - {calculation?.ci_identity}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {/* Current version - shown even with no history */}
              {calculation && (() => {
                const statusConfig = getStatusConfig(calculation.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div className="flex items-center justify-between p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {calculation.version}</span>
                          <Badge variant="outline" className="text-xs border-primary text-primary">Aktuell</Badge>
                          <Badge variant={statusConfig.variant} className={`gap-1 text-xs ${statusConfig.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <span>
                            {calculation.updated_at 
                              ? format(new Date(calculation.updated_at), 'd MMM yyyy HH:mm', { locale: sv })
                              : format(new Date(calculation.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                          </span>
                          {(calculation.updated_by_name || calculation.created_by_name) && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {calculation.updated_by_name || calculation.created_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm font-medium text-primary">
                        {formatCurrency(Number(calculation.total_cost))}
                      </span>
                    </div>
                  </div>
                );
              })()}
              <p className="text-center text-sm text-muted-foreground pt-2">
                Ingen äldre versionshistorik finns.
              </p>
            </div>
          </ScrollArea>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-2">
              {/* Current version */}
              {calculation && (() => {
                const statusConfig = getStatusConfig(calculation.status);
                const StatusIcon = statusConfig.icon;
                return (
                  <div className="flex items-center justify-between p-4 border-2 border-primary/30 rounded-lg bg-primary/5">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {calculation.version}</span>
                          <Badge variant="outline" className="text-xs border-primary text-primary">Aktuell</Badge>
                          <Badge variant={statusConfig.variant} className={`gap-1 text-xs ${statusConfig.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <span>
                            {calculation.updated_at 
                              ? format(new Date(calculation.updated_at), 'd MMM yyyy HH:mm', { locale: sv })
                              : format(new Date(calculation.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                          </span>
                          {(calculation.updated_by_name || calculation.created_by_name) && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {calculation.updated_by_name || calculation.created_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm font-medium text-primary">
                        {formatCurrency(Number(calculation.total_cost))}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Previous versions */}
              {versions.map((version) => {
                const statusConfig = getStatusConfig(version.status);
                const StatusIcon = statusConfig.icon;

                return (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Version {version.version}</span>
                          <Badge variant={statusConfig.variant} className={`gap-1 text-xs ${statusConfig.className}`}>
                            <StatusIcon className="h-3 w-3" />
                            {statusConfig.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                          <span>
                            {format(new Date(version.created_at), 'd MMM yyyy HH:mm', { locale: sv })}
                          </span>
                          {version.created_by_name && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {version.created_by_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm">
                        {formatCurrency(Number(version.total_cost))}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedVersion(version)}
                        className="gap-1"
                      >
                        <Eye className="h-4 w-4" />
                        Visa
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
