import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Loader2, Building2, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  is_active: boolean;
}

export default function OrganizationsManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [filterCustomerId, setFilterCustomerId] = useState<string>('all');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isActive, setIsActive] = useState(true);

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [orgsResult, customersResult] = await Promise.all([
        supabase.from('organizations').select('*').order('name'),
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
      ]);

      if (orgsResult.error) throw orgsResult.error;
      if (customersResult.error) throw customersResult.error;

      setOrganizations(orgsResult.data || []);
      setCustomers(customersResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Fel vid laddning', description: 'Kunde inte ladda data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setDescription('');
    setSelectedCustomerId('');
    setIsActive(true);
    setEditingId(null);
  }

  function openEditDialog(org: Organization) {
    setEditingId(org.id);
    setName(org.name);
    setDescription(org.description || '');
    setSelectedCustomerId(org.customer_id || '');
    setIsActive(org.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user || !isAdmin) {
      toast({ title: 'Åtkomst nekad', description: 'Endast administratörer kan hantera förvaltningar/bolag.', variant: 'destructive' });
      return;
    }
    if (!name.trim() || !selectedCustomerId) {
      toast({ title: 'Valideringsfel', description: 'Ange namn och välj kund.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from('organizations')
          .update({ name: name.trim(), description: description.trim() || null, customer_id: selectedCustomerId, is_active: isActive })
          .eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Uppdaterad', description: 'Förvaltning/bolag har uppdaterats.' });
      } else {
        const { error } = await supabase
          .from('organizations')
          .insert({ name: name.trim(), description: description.trim() || null, customer_id: selectedCustomerId, is_active: isActive, created_by: user.id });
        if (error) throw error;
        toast({ title: 'Skapad', description: 'Ny förvaltning/bolag har lagts till.' });
      }
      resetForm();
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving:', error);
      toast({ title: 'Fel vid sparande', description: error.message || 'Kunde inte spara.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;
    try {
      const { error } = await supabase.from('organizations').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Borttagen', description: 'Förvaltning/bolag har tagits bort.' });
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'Fel vid borttagning', description: 'Kunde inte ta bort.', variant: 'destructive' });
    }
  }

  const filteredOrganizations = filterCustomerId === 'all'
    ? organizations
    : organizations.filter(o => o.customer_id === filterCustomerId);

  const getCustomerName = (customerId: string | null) => {
    if (!customerId) return '—';
    return customers.find(c => c.id === customerId)?.name || '—';
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
          <h1 className="text-3xl font-bold text-foreground">Förvaltningar & Bolag</h1>
          <p className="text-muted-foreground mt-1">
            Hantera förvaltningar och bolag per kund
          </p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Lägg till
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Redigera' : 'Lägg till ny förvaltning/bolag'}</DialogTitle>
                <DialogDescription>
                  Förvaltningar och bolag kopplas till en kund och kan väljas i kalkyler
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Kund *</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Välj kund" /></SelectTrigger>
                    <SelectContent>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Namn *</Label>
                  <Input placeholder="T.ex. Barn- och utbildningsförvaltningen" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Beskrivning</Label>
                  <Input placeholder="Valfri beskrivning" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Aktiv</Label>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
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
            <p className="text-sm text-muted-foreground">Endast administratörer kan hantera förvaltningar och bolag.</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4">
        <Label>Filtrera per kund:</Label>
        <Select value={filterCustomerId} onValueChange={setFilterCustomerId}>
          <SelectTrigger className="w-[250px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla kunder</SelectItem>
            {customers.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Förvaltningar & Bolag
          </CardTitle>
          <CardDescription>
            Totalt {filteredOrganizations.length} st
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Namn</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Skapad</TableHead>
                  {isAdmin && <TableHead className="text-right">Åtgärder</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrganizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                      Inga förvaltningar/bolag hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredOrganizations.map(org => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell>{getCustomerName(org.customer_id)}</TableCell>
                      <TableCell className="text-muted-foreground">{org.description || '—'}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${org.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {org.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(org.created_at), 'd MMM yyyy', { locale: sv })}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(org)} title="Redigera">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(org.id)} className="text-destructive hover:text-destructive" title="Ta bort">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
