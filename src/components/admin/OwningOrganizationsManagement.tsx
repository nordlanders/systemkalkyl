import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Loader2, Building, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface OwningOrganization {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function OwningOrganizationsManagement() {
  const [organizations, setOrganizations] = useState<OwningOrganization[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const { data, error } = await supabase
        .from('owning_organizations')
        .select('*')
        .order('name');

      if (error) throw error;
      setOrganizations(data || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Fel vid laddning',
        description: 'Kunde inte ladda ägande organisationer.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setDescription('');
    setIsActive(true);
    setEditingId(null);
  }

  function openEditDialog(org: OwningOrganization) {
    setEditingId(org.id);
    setName(org.name);
    setDescription(org.description || '');
    setIsActive(org.is_active);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!user || !isAdmin) {
      toast({
        title: 'Åtkomst nekad',
        description: 'Endast administratörer kan hantera ägande organisationer.',
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
      if (editingId) {
        const { error } = await supabase
          .from('owning_organizations')
          .update({ 
            name: name.trim(), 
            description: description.trim() || null,
            is_active: isActive 
          })
          .eq('id', editingId);

        if (error) throw error;
        toast({ title: 'Organisation uppdaterad', description: 'Ägande organisation har uppdaterats.' });
      } else {
        const { error } = await supabase
          .from('owning_organizations')
          .insert({
            name: name.trim(),
            description: description.trim() || null,
            is_active: isActive,
            created_by: user.id,
          });

        if (error) throw error;
        toast({ title: 'Organisation skapad', description: 'Ny ägande organisation har lagts till.' });
      }

      resetForm();
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Fel vid sparande',
        description: error.message?.includes('unique') 
          ? 'En ägande organisation med detta namn finns redan.' 
          : 'Kunde inte spara ägande organisation.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, orgName: string) {
    if (!isAdmin) return;

    // Check if organization is used in calculations
    const { data: calculations } = await supabase
      .from('calculations')
      .select('id')
      .eq('owning_organization', orgName)
      .limit(1);

    if (calculations && calculations.length > 0) {
      toast({
        title: 'Kan inte ta bort',
        description: 'Organisationen används i befintliga kalkyler.',
        variant: 'destructive',
      });
      return;
    }

    // Check if organization is used in approval_organizations
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, approval_organizations')
      .not('approval_organizations', 'is', null);

    const isUsedInProfiles = profiles?.some(p => 
      p.approval_organizations?.includes(orgName)
    );

    if (isUsedInProfiles) {
      toast({
        title: 'Kan inte ta bort',
        description: 'Organisationen används för godkännandebehörighet hos användare.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('owning_organizations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Organisation borttagen', description: 'Ägande organisation har tagits bort.' });
      loadData();
    } catch (error) {
      console.error('Error deleting organization:', error);
      toast({
        title: 'Fel vid borttagning',
        description: 'Kunde inte ta bort ägande organisation.',
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

  return (
    <div className="space-y-8 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ägande organisation</h1>
          <p className="text-muted-foreground mt-1">
            Hantera interna organisationer som kan äga kalkyler och tilldelas för godkännandebehörighet
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
                <DialogTitle>{editingId ? 'Redigera ägande organisation' : 'Lägg till ny ägande organisation'}</DialogTitle>
                <DialogDescription>
                  Dessa organisationer kan väljas som ägare i kalkyler och för godkännandebehörighet
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Namn *</Label>
                  <Input
                    placeholder="T.ex. IT-avdelningen"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Beskrivning</Label>
                  <Textarea
                    placeholder="Valfri beskrivning..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
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
              Endast administratörer kan hantera ägande organisationer.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-primary" />
            Ägande organisationer
          </CardTitle>
          <CardDescription>
            Organisationer som kan äga kalkyler ({organizations.length} st)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Namn</TableHead>
                  <TableHead>Beskrivning</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Skapad</TableHead>
                  {isAdmin && <TableHead className="text-right">Åtgärder</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 5 : 4} className="text-center text-muted-foreground py-8">
                      Inga ägande organisationer hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((org) => (
                    <TableRow key={org.id}>
                      <TableCell className="font-medium">{org.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {org.description || '—'}
                      </TableCell>
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
                              onClick={() => handleDelete(org.id, org.name)}
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
