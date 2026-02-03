import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Key, Eye, EyeOff, Copy, Check, FileCheck } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface OwningOrganization {
  id: string;
  name: string;
}

interface UserData {
  user_id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user' | 'superadmin';
  permission_level: 'read_only' | 'read_write';
  can_approve?: boolean;
  approval_organizations?: string[];
}

interface EditUserDialogProps {
  user: UserData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
  currentUserId: string;
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const special = '!@#$%&*';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  password += special.charAt(Math.floor(Math.random() * special.length));
  password += Math.floor(Math.random() * 10);
  return password;
}

export default function EditUserDialog({ 
  user, 
  open, 
  onOpenChange, 
  onUserUpdated,
  currentUserId 
}: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [role, setRole] = useState<'user' | 'admin' | 'superadmin'>('user');
  const [permissionLevel, setPermissionLevel] = useState<'read_only' | 'read_write'>('read_write');
  const [canApprove, setCanApprove] = useState(false);
  const [approvalOrganizations, setApprovalOrganizations] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [owningOrganizations, setOwningOrganizations] = useState<OwningOrganization[]>([]);

  const { toast } = useToast();

  // Fetch owning organizations from database
  useEffect(() => {
    async function fetchOwningOrganizations() {
      const { data, error } = await supabase
        .from('owning_organizations')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      
      if (!error && data) {
        setOwningOrganizations(data);
      }
    }
    
    if (open) {
      fetchOwningOrganizations();
    }
  }, [open]);

  // Update local state when user prop changes or dialog opens
  useEffect(() => {
    if (user && open) {
      setRole(user.role);
      setPermissionLevel(user.permission_level);
      setCanApprove(user.can_approve ?? false);
      setApprovalOrganizations(user.approval_organizations ?? []);
      setNewPassword('');
      setShowPassword(false);
      setCopied(false);
    }
  }, [user, open]);

  function toggleOrganization(org: string) {
    if (approvalOrganizations.includes(org)) {
      setApprovalOrganizations(approvalOrganizations.filter(o => o !== org));
    } else {
      setApprovalOrganizations([...approvalOrganizations, org]);
    }
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
          canApprove,
          approvalOrganizations: canApprove ? approvalOrganizations : [],
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

  async function handleResetPassword() {
    if (!user) return;

    const tempPassword = generateTempPassword();
    setResetLoading(true);

    try {
      const response = await supabase.functions.invoke('reset-user-password', {
        body: {
          email: user.email,
          newPassword: tempPassword,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setNewPassword(tempPassword);
      setShowPassword(true);

      toast({
        title: 'Lösenord återställt',
        description: `Ett nytt tillfälligt lösenord har genererats för ${user.email}.`,
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: 'Fel vid återställning',
        description: error instanceof Error ? error.message : 'Kunde inte återställa lösenordet.',
        variant: 'destructive',
      });
    } finally {
      setResetLoading(false);
    }
  }

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Kopierat',
        description: 'Lösenordet har kopierats till urklipp.',
      });
    } catch {
      toast({
        title: 'Kunde inte kopiera',
        description: 'Kopiera lösenordet manuellt.',
        variant: 'destructive',
      });
    }
  }

  const isCurrentUser = user?.user_id === currentUserId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
              onValueChange={(v) => setRole(v as 'user' | 'admin' | 'superadmin')}
              disabled={isCurrentUser}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">Användare</SelectItem>
                <SelectItem value="admin">Administratör</SelectItem>
                <SelectItem value="superadmin">Superadmin</SelectItem>
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

          <Separator />

          {/* Approval permissions section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="canApprove" className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  Kan godkänna kalkyler
                </Label>
                <p className="text-xs text-muted-foreground">
                  Tillåt användaren att godkänna kalkyler som är klara
                </p>
              </div>
              <Switch
                id="canApprove"
                checked={canApprove}
                onCheckedChange={setCanApprove}
                disabled={isCurrentUser}
              />
            </div>

            {canApprove && (
              <div className="space-y-2 pl-6 border-l-2 border-primary/20">
                <Label>Organisationer att godkänna</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Välj vilka organisationers kalkyler användaren kan godkänna. Lämna tomt för alla.
                </p>
                <div className="space-y-2">
                  {owningOrganizations.map((org) => (
                    <div key={org.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`org-${org.id}`}
                        checked={approvalOrganizations.includes(org.name)}
                        onCheckedChange={() => toggleOrganization(org.name)}
                      />
                      <label
                        htmlFor={`org-${org.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {org.name}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
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

        <Separator className="my-2" />

        <div className="space-y-3">
          <Label className="text-sm font-medium">Återställ lösenord</Label>
          <p className="text-xs text-muted-foreground">
            Genererar ett nytt tillfälligt lösenord som användaren måste byta vid nästa inloggning.
          </p>
          
          {newPassword && (
            <div className="space-y-2">
              <Label className="text-xs">Nytt tillfälligt lösenord</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    readOnly
                    className="pr-10 font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-amber-600">
                Spara detta lösenord - det visas endast en gång!
              </p>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            onClick={handleResetPassword}
            disabled={resetLoading || isCurrentUser}
            className="w-full gap-2"
          >
            {resetLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Återställer...
              </>
            ) : (
              <>
                <Key className="h-4 w-4" />
                Återställ lösenord
              </>
            )}
          </Button>
          {isCurrentUser && (
            <p className="text-xs text-muted-foreground">
              Använd "Byt lösenord" i menyn för att ändra ditt eget lösenord.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
