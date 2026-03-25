import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Loader2, Users, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

interface PortalUser {
  id: string;
  email: string;
  full_name: string | null;
  role: 'portal_admin' | 'portal_user' | 'portal_reader';
  is_active: boolean;
  created_at: string;
}

interface Customer {
  id: string;
  name: string;
  is_active: boolean;
}

interface Organization {
  id: string;
  name: string;
  customer_id: string | null;
  is_active: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  portal_admin: 'Kundadmin',
  portal_user: 'Användare',
  portal_reader: 'Läsare',
};

export default function PortalUsersManagement() {
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<string>('portal_user');
  const [isActive, setIsActive] = useState(true);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([]);

  const [existingCustomerIds, setExistingCustomerIds] = useState<string[]>([]);
  const [existingOrgIds, setExistingOrgIds] = useState<string[]>([]);

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [usersRes, customersRes, orgsRes] = await Promise.all([
        supabase.from('portal_users').select('*').order('email'),
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('organizations').select('*').eq('is_active', true).order('name'),
      ]);

      if (usersRes.error) throw usersRes.error;
      if (customersRes.error) throw customersRes.error;
      if (orgsRes.error) throw orgsRes.error;

      setPortalUsers(usersRes.data || []);
      setCustomers(customersRes.data || []);
      setOrganizations(orgsRes.data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({ title: 'Fel vid laddning', description: 'Kunde inte ladda data.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEmail('');
    setFullName('');
    setRole('portal_user');
    setIsActive(true);
    setSelectedCustomerIds([]);
    setSelectedOrgIds([]);
    setExistingCustomerIds([]);
    setExistingOrgIds([]);
    setEditingId(null);
  }

  async function openEditDialog(pu: PortalUser) {
    setEditingId(pu.id);
    setEmail(pu.email);
    setFullName(pu.full_name || '');
    setRole(pu.role);
    setIsActive(pu.is_active);

    const [custRes, orgRes] = await Promise.all([
      supabase.from('portal_user_customers').select('customer_id').eq('portal_user_id', pu.id),
      supabase.from('portal_user_organizations').select('organization_id').eq('portal_user_id', pu.id),
    ]);

    const custIds = (custRes.data || []).map(r => r.customer_id);
    const orgIds = (orgRes.data || []).map(r => r.organization_id);
    setSelectedCustomerIds(custIds);
    setSelectedOrgIds(orgIds);
    setExistingCustomerIds(custIds);
    setExistingOrgIds(orgIds);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user || !isAdmin) {
      toast({ title: 'Åtkomst nekad', variant: 'destructive' });
      return;
    }
    if (!email.trim()) {
      toast({ title: 'Valideringsfel', description: 'Ange e-postadress.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let portalUserId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from('portal_users')
          .update({ email: email.trim(), full_name: fullName.trim() || null, role, is_active: isActive })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('portal_users')
          .insert({ email: email.trim(), full_name: fullName.trim() || null, role, is_active: isActive, created_by: user.id })
          .select('id')
          .single();
        if (error) throw error;
        portalUserId = data.id;
      }

      if (editingId) {
        const toRemoveCust = existingCustomerIds.filter(id => !selectedCustomerIds.includes(id));
        const toAddCust = selectedCustomerIds.filter(id => !existingCustomerIds.includes(id));

        if (toRemoveCust.length > 0) {
          await supabase.from('portal_user_customers').delete()
            .eq('portal_user_id', portalUserId!)
            .in('customer_id', toRemoveCust);
        }
        if (toAddCust.length > 0) {
          await supabase.from('portal_user_customers').insert(
            toAddCust.map(cid => ({ portal_user_id: portalUserId!, customer_id: cid }))
          );
        }
      } else if (selectedCustomerIds.length > 0) {
        await supabase.from('portal_user_customers').insert(
          selectedCustomerIds.map(cid => ({ portal_user_id: portalUserId!, customer_id: cid }))
        );
      }

      if (editingId) {
        const toRemoveOrg = existingOrgIds.filter(id => !selectedOrgIds.includes(id));
        const toAddOrg = selectedOrgIds.filter(id => !existingOrgIds.includes(id));

        if (toRemoveOrg.length > 0) {
          await supabase.from('portal_user_organizations').delete()
            .eq('portal_user_id', portalUserId!)
            .in('organization_id', toRemoveOrg);
        }
        if (toAddOrg.length > 0) {
          await supabase.from('portal_user_organizations').insert(
            toAddOrg.map(oid => ({ portal_user_id: portalUserId!, organization_id: oid }))
          );
        }
      } else if (selectedOrgIds.length > 0) {
        await supabase.from('portal_user_organizations').insert(
          selectedOrgIds.map(oid => ({ portal_user_id: portalUserId!, organization_id: oid }))
        );
      }

      toast({ title: editingId ? 'Uppdaterad' : 'Skapad', description: `Kundportal-användare har ${editingId ? 'uppdaterats' : 'skapats'}.` });
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
      const { error } = await supabase.from('portal_users').delete().eq('id', id);
      if (error) throw error;
      toast({ title: 'Borttagen', description: 'Kundportal-användare har tagits bort.' });
      loadData();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'Fel vid borttagning', description: 'Kunde inte ta bort.', variant: 'destructive' });
    }
  }

  function toggleCustomer(customerId: string) {
    setSelectedCustomerIds(prev =>
      prev.includes(customerId) ? prev.filter(id => id !== customerId) : [...prev, customerId]
    );
  }

  function toggleOrganization(orgId: string) {
    setSelectedOrgIds(prev =>
      prev.includes(orgId) ? prev.filter(id => id !== orgId) : [...prev, orgId]
    );
  }

  const availableOrgs = organizations.filter(o =>
    selectedCustomerIds.length === 0 || (o.customer_id && selectedCustomerIds.includes(o.customer_id))
  );

  const getCustomerName = (customerId: string) => customers.find(c => c.id === customerId)?.name || '—';

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
          <h1 className="text-3xl font-bold text-foreground">Kundportal – Användare</h1>
          <p className="text-muted-foreground mt-1">
            Hantera användare för kundportalen med kund- och organisationstillhörighet
          </p>
        </div>

        {isAdmin && (
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Lägg till användare
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Redigera' : 'Lägg till ny kundportal-användare'}</DialogTitle>
                <DialogDescription>
                  Användare som skapas här kan logga in i kundportalen
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>E-post *</Label>
                    <Input placeholder="namn@foretag.se" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Namn</Label>
                    <Input placeholder="Förnamn Efternamn" value={fullName} onChange={e => setFullName(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Roll *</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="portal_admin">Kundadmin</SelectItem>
                        <SelectItem value="portal_user">Användare</SelectItem>
                        <SelectItem value="portal_reader">Läsare</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <Label>Aktiv</Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Kunder</Label>
                  <p className="text-sm text-muted-foreground">Välj vilka kunder användaren tillhör</p>
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {customers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Inga kunder tillgängliga</p>
                    ) : (
                      customers.map(c => (
                        <label key={c.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <Checkbox
                            checked={selectedCustomerIds.includes(c.id)}
                            onCheckedChange={() => toggleCustomer(c.id)}
                          />
                          <span className="text-sm">{c.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-base font-semibold">Förvaltningar & Bolag</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedCustomerIds.length === 0
                      ? 'Välj kund(er) ovan för att filtrera förvaltningar'
                      : 'Välj vilka förvaltningar/bolag användaren tillhör'}
                  </p>
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {availableOrgs.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {selectedCustomerIds.length === 0
                          ? 'Välj minst en kund först'
                          : 'Inga förvaltningar/bolag för valda kunder'}
                      </p>
                    ) : (
                      availableOrgs.map(o => (
                        <label key={o.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 p-1 rounded">
                          <Checkbox
                            checked={selectedOrgIds.includes(o.id)}
                            onCheckedChange={() => toggleOrganization(o.id)}
                          />
                          <span className="text-sm">{o.name}</span>
                          {o.customer_id && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {getCustomerName(o.customer_id)}
                            </span>
                          )}
                        </label>
                      ))
                    )}
                  </div>
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
            <p className="text-sm text-muted-foreground">Endast administratörer kan hantera kundportal-användare.</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Kundportal-användare
          </CardTitle>
          <CardDescription>Totalt {portalUsers.length} st</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>E-post</TableHead>
                  <TableHead>Namn</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Skapad</TableHead>
                  {isAdmin && <TableHead className="text-right">Åtgärder</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {portalUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center text-muted-foreground py-8">
                      Inga kundportal-användare hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  portalUsers.map(pu => (
                    <TableRow key={pu.id}>
                      <TableCell className="font-medium">{pu.email}</TableCell>
                      <TableCell>{pu.full_name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{ROLE_LABELS[pu.role] || pu.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${pu.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
                          {pu.is_active ? 'Aktiv' : 'Inaktiv'}
                        </span>
                      </TableCell>
                      <TableCell>{format(new Date(pu.created_at), 'd MMM yyyy', { locale: sv })}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => openEditDialog(pu)} title="Redigera">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(pu.id)} className="text-destructive hover:text-destructive" title="Ta bort">
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
