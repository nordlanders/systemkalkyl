import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, Loader2, Check, X } from 'lucide-react';

interface CreateUserDialogProps {
  onUserCreated: () => void;
}

const PASSWORD_MIN_LENGTH = 12;

export default function CreateUserDialog({ onUserCreated }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [permissionLevel, setPermissionLevel] = useState<'read_only' | 'read_write'>('read_write');

  const { toast } = useToast();

  const passwordValidation = useMemo(() => {
    return {
      minLength: password.length >= PASSWORD_MIN_LENGTH,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
    };
  }, [password]);

  const isPasswordValid = passwordValidation.minLength && 
    passwordValidation.hasUppercase && 
    passwordValidation.hasLowercase && 
    passwordValidation.hasNumber;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!isPasswordValid) {
      toast({
        title: 'Ogiltigt lösenord',
        description: 'Lösenordet uppfyller inte säkerhetskraven.',
        variant: 'destructive',
      });
      return;
    }

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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 12 tecken"
              className={password && !isPasswordValid ? 'border-destructive' : ''}
            />
            <div className="space-y-1 text-xs">
              <p className="text-muted-foreground font-medium">Lösenordet måste innehålla:</p>
              <div className="grid grid-cols-2 gap-1">
                <div className={`flex items-center gap-1 ${password ? (passwordValidation.minLength ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
                  {password ? (passwordValidation.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />) : <span className="w-3">•</span>}
                  Minst {PASSWORD_MIN_LENGTH} tecken
                </div>
                <div className={`flex items-center gap-1 ${password ? (passwordValidation.hasUppercase ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
                  {password ? (passwordValidation.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />) : <span className="w-3">•</span>}
                  Stor bokstav (A-Z)
                </div>
                <div className={`flex items-center gap-1 ${password ? (passwordValidation.hasLowercase ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
                  {password ? (passwordValidation.hasLowercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />) : <span className="w-3">•</span>}
                  Liten bokstav (a-z)
                </div>
                <div className={`flex items-center gap-1 ${password ? (passwordValidation.hasNumber ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
                  {password ? (passwordValidation.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />) : <span className="w-3">•</span>}
                  Siffra (0-9)
                </div>
              </div>
            </div>
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
            <Button type="submit" disabled={loading || !isPasswordValid}>
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
