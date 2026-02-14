import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { 
  Users, 
  Shield, 
  ShieldCheck,
  Loader2,
  AlertCircle,
  Pencil,
  Eye,
  Edit3,
  Crown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import CreateUserDialog from './CreateUserDialog';
import EditUserDialog from './EditUserDialog';

interface UserWithRole {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_login_at: string | null;
  permission_level: 'read_only' | 'read_write';
  role: 'admin' | 'user' | 'superadmin';
  can_approve: boolean;
  approval_organizations: string[];
}

export default function UsersManagement() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('created_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

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

      const usersWithRoles = (profiles || []).map((profile) => {
        const userRole = roles?.find((r) => r.user_id === profile.user_id);
        return {
          ...profile,
          permission_level: profile.permission_level || 'read_write',
          role: (userRole?.role as 'admin' | 'user') || 'user',
          can_approve: (profile as any).can_approve ?? false,
          approval_organizations: (profile as any).approval_organizations ?? [],
        };
      });

      setUsers(usersWithRoles as UserWithRole[]);
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

  function handleEditUser(u: UserWithRole) {
    setEditingUser(u);
    setEditDialogOpen(true);
  }

  function handleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  }

  const sortedUsers = [...users].sort((a, b) => {
    let aVal: any;
    let bVal: any;
    switch (sortColumn) {
      case 'name':
        aVal = (a.full_name || a.email).toLowerCase();
        bVal = (b.full_name || b.email).toLowerCase();
        break;
      case 'role':
        const roleOrder = { superadmin: 0, admin: 1, user: 2 };
        aVal = roleOrder[a.role] ?? 3;
        bVal = roleOrder[b.role] ?? 3;
        break;
      case 'permission':
        aVal = a.permission_level;
        bVal = b.permission_level;
        break;
      case 'last_login':
        aVal = a.last_login_at ? new Date(a.last_login_at).getTime() : 0;
        bVal = b.last_login_at ? new Date(b.last_login_at).getTime() : 0;
        break;
      case 'created_at':
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Användarhantering</h1>
          <p className="text-muted-foreground mt-1">
            Hantera systemanvändare och deras roller
          </p>
        </div>
        <CreateUserDialog onUserCreated={loadUsers} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Totalt</p>
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
                <Edit3 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.permission_level === 'read_write').length}
                </p>
                <p className="text-sm text-muted-foreground">Läsa & skriva</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-muted">
                <Eye className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {users.filter(u => u.permission_level === 'read_only').length}
                </p>
                <p className="text-sm text-muted-foreground">Endast läsa</p>
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
            Visa och hantera användare, roller och behörigheter.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer hover:bg-muted select-none" onClick={() => handleSort('name')}>
                    <div className="flex items-center">Användare<SortIcon column="name" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted select-none" onClick={() => handleSort('role')}>
                    <div className="flex items-center">Roll<SortIcon column="role" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted select-none" onClick={() => handleSort('permission')}>
                    <div className="flex items-center">Behörighet<SortIcon column="permission" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted select-none" onClick={() => handleSort('last_login')}>
                    <div className="flex items-center">Senast inloggad<SortIcon column="last_login" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer hover:bg-muted select-none" onClick={() => handleSort('created_at')}>
                    <div className="flex items-center">Registrerad<SortIcon column="created_at" /></div>
                  </TableHead>
                  <TableHead className="text-right">Åtgärder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Inga användare hittades
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedUsers.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{u.full_name || 'Namnlös användare'}</p>
                          <p className="text-sm text-muted-foreground">{u.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={u.role === 'superadmin' ? 'default' : u.role === 'admin' ? 'default' : 'secondary'} 
                          className={u.role === 'superadmin' ? 'bg-amber-600 hover:bg-amber-700' : ''}>
                          {u.role === 'superadmin' ? (
                            <><Crown className="h-3 w-3 mr-1" /> Superadmin</>
                          ) : u.role === 'admin' ? (
                            <><ShieldCheck className="h-3 w-3 mr-1" /> Admin</>
                          ) : (
                            <><Shield className="h-3 w-3 mr-1" /> Användare</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {u.permission_level === 'read_write' ? (
                            <><Edit3 className="h-3 w-3" /> Läsa & skriva</>
                          ) : (
                            <><Eye className="h-3 w-3" /> Endast läsa</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.last_login_at 
                          ? format(new Date(u.last_login_at), 'd MMM yyyy HH:mm', { locale: sv })
                          : <span className="text-muted-foreground/50">Aldrig</span>
                        }
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(u.created_at), 'd MMM yyyy', { locale: sv })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditUser(u)}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Redigera
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

      <EditUserDialog
        user={editingUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onUserUpdated={loadUsers}
        currentUserId={user?.id || ''}
      />
    </div>
  );
}
