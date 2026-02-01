import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Loader2 } from 'lucide-react';

interface CreateUserDialogProps {
  onUserCreated: () => void;
}

export default function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [permissionLevel, setPermissionLevel] = useState<'read_only' | 'read_write'>('read_write');

  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          fullName,
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
        title: 'Användare skapad',
        description: `Användaren ${email} har skapats.`,
      });

      setOpen(false);
      resetForm();
      onUserCreated();
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: 'Fel vid skapande av användare',
        description: error instanceof Error ? error.message : 'Kunde inte skapa användaren.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEmail('');
    setPassword('');
    setFullName('');
    setRole('user');
    setPermissionLevel('read_write');
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <UserPlus className="h-4 w-4" />
          Skapa användare
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skapa ny användare</DialogTitle>
          <DialogDescription>
            Fyll i uppgifterna för den nya användaren.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Fullständigt namn</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Anna Andersson"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-postadress *</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="anna@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Lösenord *</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 6 tecken"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Roll</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'user' | 'admin')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Användare</SelectItem>
                <SelectItem value="admin">Administratör</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="permissionLevel">Behörighetsnivå</Label>
            <Select value={permissionLevel} onValueChange={(v) => setPermissionLevel(v as 'read_only' | 'read_write')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="read_only">Endast läsa</SelectItem>
                <SelectItem value="read_write">Läsa och skriva</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Skapar...
                </>
              ) : (
                'Skapa användare'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
