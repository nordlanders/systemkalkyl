import { Button } from '@/components/ui/button';
import { KeyRound, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SamlSsoButtonProps {
  disabled?: boolean;
}

export default function SamlSsoButton({ disabled }: SamlSsoButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSsoLogin = async () => {
    setLoading(true);
    
    try {
      // Attempt to sign in with SSO using the configured domain
      // This requires SAML to be configured in the Supabase dashboard
      const { data, error } = await supabase.auth.signInWithSSO({
        domain: 'sundsvall.se', // Replace with your organization's domain
      });

      if (error) {
        // If SAML is not configured, show a helpful message
        if (error.message.includes('No SSO provider') || error.message.includes('not found')) {
          toast({
            title: 'SSO ej konfigurerat',
            description: 'SAML SSO måste konfigureras av en administratör innan det kan användas.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'SSO-fel',
            description: error.message,
            variant: 'destructive',
          });
        }
        return;
      }

      // If successful, redirect to the SSO provider
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err) {
      console.error('SSO login error:', err);
      toast({
        title: 'SSO-fel',
        description: 'Ett oväntat fel uppstod. Försök igen senare.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full gap-2"
      onClick={handleSsoLogin}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <KeyRound className="h-4 w-4" />
      )}
      Logga in med Onegate SSO
    </Button>
  );
}
