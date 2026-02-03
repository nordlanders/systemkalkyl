import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Loader2, Network, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface Customer {
  id: string;
  name: string;
  description: string | null;
}

interface Organization {
  id: string;
  name: string;
  description: string | null;
  customer_id: string | null;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function OrganizationsManagement() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
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
        supabase.from('customers').select('id, name, description').eq('is_active', true).order('name'),
      ]);

      if (orgsResult.error) throw orgsResult.error;
      if (customersResult.error) throw customersResult.error;

      setOrganizations(orgsResult.data || []);
      setCustomers(customersResult.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda data.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setDescription('');
    setCustomerId(null);
    setParentId(null);
    setIsActive(true);
    setEditingId(null);
  }

  function openEditDialog(org: Organization) {
    setEditingId(org.id);
    setName(org.name);
    setDescription(org.description || '');
    setCustomerId(org.customer_id);
    setParentId(org.parent_id);
    setIsActive(org.is_active);
    setDialogOpen(true);
  }

  function getCustomerName(customerId: string | null): string {
    if (!customerId) return '—';
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || '—';
  }

  function getParentName(parentId: string | null): string {
    if (!parentId) return '—';
    const parent = organizations.find(o => o.id === parentId);
    return parent?.name || '—';
  }

  async function handleSave() {
    if (!user || !isAdmin) {
      toast({
        title: 'Åtkomst nekad',
        description: 'Endast administratörer kan hantera organisationer.',
        variant: 'destructive',
      });
      return;
    }

    if (!name.trim()) {
      toast({
        title: 'Valideringsfel',
        description: 'Ange ett namn.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const orgData = {
        name: name.trim(),
        description: description.trim() || null,
        customer_id: customerId,
        parent_id: parentId,
        is_active: isActive,
        created_by: user.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from('organizations')
          .update({ name: name.trim(), description: description.trim() || null, customer_id: customerId, parent_id: parentId, is_active: isActive })
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: 'Organisation uppdaterad', description: 'Organisationen har uppdaterats.' });
      } else {
        const { error } = await supabase
          .from('organizations')
          .insert(orgData);

        if (error) throw error;
        toast({ title: 'Organisation skapad', description: 'Ny organisation har lagts till.' });
      }

      resetForm();
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Fel vid sparande',
        description: error.message?.includes('unique') 
          ? 'En organisation med detta namn finns redan.' 
          : 'Kunde inte spara organisation.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!isAdmin) return;

    // Check if organization has children
    const hasChildren = organizations.some(o => o.parent_id === id);
    if (hasChildren) {
      toast({
        title: 'Kan inte ta bort',
        description: 'Organisationen har underorganisationer som måste tas bort först.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Organisation borttagen', description: 'Organisationen har tagits bort.' });
      loadData();
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort organisation.',
        variant: 'destructive',
      });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter out current organization from parent options to avoid self-reference
  // Also filter to show only organizations from the same customer
  const parentOptions = organizations.filter(o => o.id !== editingId && (customerId ? o.customer_id === customerId : true));

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Kundens organisation</h1>
          <p className="text-muted-foreground mt-1">
            Hantera organisationer kopplade till kunder som kan väljas i kalkyler
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
                Lägg till organisation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Redigera organisation' : 'Lägg till ny organisation'}</DialogTitle>
                <DialogDescription>
                  Organisationer kan väljas som ägande organisation i kalkyler
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Namn *</Label>
                  <Input
                    placeholder="T.ex. Produktion"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Beskrivning</Label>
                  <Textarea
                    placeholder="Valfri beskrivning av organisationen..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Kund *</Label>
                  <Select value={customerId || 'none'} onValueChange={(v) => {
                    setCustomerId(v === 'none' ? null : v);
                    setParentId(null); // Reset parent when customer changes
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj kund..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen kund vald</SelectItem>
                      {customers.map((customer) => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Överordnad organisation</Label>
                  <Select value={parentId || 'none'} onValueChange={(v) => setParentId(v === 'none' ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen (toppnivå)</SelectItem>
                      {parentOptions.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label>Aktiv</Label>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
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
              Endast administratörer kan hantera organisationer.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-primary" />
            Kundernas organisationer
          </CardTitle>
          <CardDescription>
            Alla organisationer kopplade till kunder ({organizations.length} st)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Namn</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Kund</TableHead>
                  <TableHead>Överordnad</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Skapad</TableHead>
                  {isAdmin && <TableHead className="text-right">Åtgärder</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 7 : 6} className="text-center text-muted-foreground py-8">
                      Inga organisationer hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="max-w-xs truncate text-muted-foreground">
                        {org.description || '—'}
                      </TableCell>
                      <TableCell>{getCustomerName(org.customer_id)}</TableCell>
                      <TableCell>{getParentName(org.parent_id)}</TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          org.is_active 
                            ? 'bg-success/10 text-success' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {org.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {format(new Date(org.created_at), 'd MMM yyyy', { locale: sv })}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(org)}
                              title="Redigera"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(org.id)}
                              className="text-destructive hover:text-destructive"
                              title="Ta bort"
                            >
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
