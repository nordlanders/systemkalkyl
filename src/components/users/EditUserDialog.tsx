import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

interface UserData {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  permission_level: 'read_only' | 'read_write';
}

interface EditUserDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
  currentUserId: string;
}

export default function EditUserDialog({ 
  user, 
  open, 
  onOpenChange, 
  onUserUpdated,
  currentUserId 
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<'user' | 'admin'>(user?.role || 'user');
  const [permissionLevel, setPermissionLevel] = useState<'read_only' | 'read_write'>(
    user?.permission_level || 'read_write'
  );

  const { toast } = useToast();

  // Update local state when user prop changes
  if (user && (role !== user.role || permissionLevel !== user.permission_level)) {
    if (role !== user.role) setRole(user.role);
    if (permissionLevel !== user.permission_level) setPermissionLevel(user.permission_level);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    setLoading(true);

    try {
      const response = await supabase.functions.invoke('update-user-settings', {
        body: {
          userId: user.user_id,
          role,
          permissionLevel,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast({
        title: 'Användare uppdaterad',
        description: `Inställningarna för ${user.email} har uppdaterats.`,
      });

      onOpenChange(false);
      onUserUpdated();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: 'Fel vid uppdatering',
        description: error instanceof Error ? error.message : 'Kunde inte uppdatera användaren.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  const isCurrentUser = user?.user_id === currentUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redigera användare</DialogTitle>
          <DialogDescription>
            {user?.email} - {user?.full_name || 'Inget namn'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Roll</Label>
            <Select 
              value={role} 
              onValueChange={(v) => setRole(v as 'user' | 'admin')}
              disabled={isCurrentUser}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Användare</SelectItem>
                <SelectItem value="admin">Administratör</SelectItem>
              </SelectContent>
            </Select>
            {isCurrentUser && (
              <p className="text-xs text-muted-foreground">
                Du kan inte ändra din egen roll.
              </p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="permissionLevel">Behörighetsnivå</Label>
            <Select 
              value={permissionLevel} 
              onValueChange={(v) => setPermissionLevel(v as 'read_only' | 'read_write')}
              disabled={isCurrentUser}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read_only">Endast läsa</SelectItem>
                <SelectItem value="read_write">Läsa och skriva</SelectItem>
              </SelectContent>
            </Select>
            {isCurrentUser && (
              <p className="text-xs text-muted-foreground">
                Du kan inte ändra dina egna behörigheter.
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading || isCurrentUser}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sparar...
                </>
              ) : (
                'Spara ändringar'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
