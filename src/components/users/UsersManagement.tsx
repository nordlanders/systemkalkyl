import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { logAudit, type Profile } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { 
  Users, 
  Shield, 
  ShieldCheck,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface UserWithRole extends Profile {
  role: 'admin' | 'user';
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  async function loadUsers() {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      const usersWithRoles = (profiles as Profile[]).map((profile) => {
        const userRole = roles.find((r: { user_id: string; role: string }) => r.user_id === profile.user_id);
        return {
          ...profile,
          role: (userRole?.role as 'admin' | 'user') || 'user',
        };
      });

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: 'Fel vid laddning av användare',
        description: 'Kunde inte ladda användarlistan.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  async function toggleAdminRole(userId: string, currentRole: 'admin' | 'user') {
    if (!isAdmin) return;

    setUpdating(userId);
    try {
      const newRole = currentRole === 'admin' ? 'user' : 'admin';

      // First delete existing role
      await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      // Then insert new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: newRole });

      if (error) throw error;

      await logAudit('update', 'user_roles', userId, 
        { role: currentRole },
        { role: newRole }
      );

      toast({
        title: 'Roll uppdaterad',
        description: `Användarens roll ändrad till ${newRole === 'admin' ? 'administratör' : 'användare'}.`,
      });

      loadUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Fel vid uppdatering av roll',
        description: 'Kunde inte uppdatera användarens roll.',
        variant: 'destructive',
      });
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-8 fade-in">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Användarhantering</h1>
          <p className="text-muted-foreground mt-1">Hantera systemanvändare och roller</p>
        </div>

        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="h-5 w-5 text-warning" />
            <p className="text-muted-foreground">
              Du har inte behörighet att visa denna sida. Endast administratörer kan hantera användare.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 fade-in">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Användarhantering</h1>
        <p className="text-muted-foreground mt-1">
          Hantera systemanvändare och deras roller
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Totalt antal användare</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-accent/10">
                <ShieldCheck className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'admin').length}
                </p>
                <p className="text-sm text-muted-foreground">Administratörer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.role === 'user').length}
                </p>
                <p className="text-sm text-muted-foreground">Standardanvändare</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Alla användare
          </CardTitle>
          <CardDescription>
            Visa och hantera användarroller. Klicka för att växla administratörsbehörighet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Användare</TableHead>
                  <TableHead>Roll</TableHead>
                  <TableHead>Registrerad</TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Inga användare hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.full_name || 'Namnlös användare'}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>
                          {u.role === 'admin' ? (
                            <><ShieldCheck className="h-3 w-3 mr-1" /> Admin</>
                          ) : (
                            <><Shield className="h-3 w-3 mr-1" /> Användare</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(u.created_at), 'd MMM yyyy', { locale: sv })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleAdminRole(u.user_id, u.role)}
                          disabled={updating === u.user_id || u.user_id === user?.id}
                        >
                          {updating === u.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : u.role === 'admin' ? (
                            'Ta bort admin'
                          ) : (
                            'Gör till admin'
                          )}
                        </Button>
                      </TableCell>
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
