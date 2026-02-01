import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Key, Loader2 } from 'lucide-react';
import { z } from 'zod';

const passwordSchema = z.object({
  newPassword: z
    .string()
    .min(12, 'Lösenordet måste vara minst 12 tecken')
    .max(72, 'Lösenordet får inte vara längre än 72 tecken'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Lösenorden matchar inte',
  path: ['confirmPassword'],
});

export default function ChangePasswordDialog() {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});

  const { toast } = useToast();

  const resetForm = () => {
    setNewPassword('');
    setConfirmPassword('');
    setErrors({});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate input
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      const fieldErrors: { newPassword?: string; confirmPassword?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === 'newPassword') {
          fieldErrors.newPassword = err.message;
        } else if (err.path[0] === 'confirmPassword') {
          fieldErrors.confirmPassword = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: 'Lösenord uppdaterat',
        description: 'Ditt lösenord har ändrats.',
      });

      resetForm();
      setOpen(false);
    } catch (error: any) {
      console.error('Error updating password:', error);
      
      let errorMessage = 'Kunde inte uppdatera lösenordet.';
      if (error.message?.includes('same as old')) {
        errorMessage = 'Det nya lösenordet måste skilja sig från det gamla.';
      }

      toast({
        title: 'Fel vid uppdatering',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Key className="h-4 w-4" />
          <span className="hidden sm:inline">Byt lösenord</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Byt lösenord</DialogTitle>
            <DialogDescription>
              Ange ditt nya lösenord nedan. Lösenordet måste vara minst 12 tecken.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nytt lösenord</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minst 12 tecken"
                disabled={loading}
              />
              {errors.newPassword && (
                <p className="text-sm text-destructive">{errors.newPassword}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Bekräfta lösenord</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Upprepa lösenordet"
                disabled={loading}
              />
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">{errors.confirmPassword}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Avbryt
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Spara
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
