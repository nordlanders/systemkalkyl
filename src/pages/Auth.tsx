import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Calculator, Loader2, ArrowLeft, HelpCircle } from 'lucide-react';
import { z } from 'zod';
import loginBackground from '@/assets/login-background.jpg';
import SamlSsoButton from '@/components/auth/SamlSsoButton';
import { Link } from 'react-router-dom';
import { Separator } from '@/components/ui/separator';

const authSchema = z.object({
  email: z.string().email('Ange en giltig e-postadress'),
  password: z.string().min(6, 'Lösenordet måste vara minst 6 tecken'),
});

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      authSchema.parse({ email, password });
      setErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);

    if (error) {
      toast({
        title: 'Inloggning misslyckades',
        description: error.message === 'Invalid login credentials' 
          ? 'Ogiltig e-post eller lösenord. Försök igen.'
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Välkommen tillbaka!',
        description: 'Du har loggat in.',
      });
      navigate('/');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !z.string().email().safeParse(email).success) {
      setErrors({ email: 'Ange en giltig e-postadress' });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setLoading(false);

    if (error) {
      toast({
        title: 'Fel',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setResetEmailSent(true);
      toast({
        title: 'E-post för lösenordsåterställning skickad',
        description: 'Kontrollera din e-post för återställningslänken.',
      });
    }
  };

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative"
        style={{
          backgroundImage: `url(${loginBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="w-full max-w-md fade-in relative z-10">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="p-5 rounded-xl bg-primary">
              <Calculator className="h-14 w-14 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Tjänstekalkyl</h1>
              <p className="text-base text-white/80">Räkna fram och underhåll kalkyl på enkelt sätt</p>
            </div>
          </div>

          <Card className="shadow-lg">
            <CardHeader className="text-center">
              <CardTitle>Återställ lösenord</CardTitle>
              <CardDescription>
                {resetEmailSent 
                  ? "Kontrollera din e-post för återställningslänken" 
                  : "Ange din e-post för att få en återställningslänk"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {resetEmailSent ? (
                <div className="space-y-4">
                  <p className="text-center text-muted-foreground">
                    Vi har skickat en länk för lösenordsåterställning till <strong>{email}</strong>. 
                    Kontrollera din inkorg och följ instruktionerna.
                  </p>
                  <Button 
                    variant="outline" 
                    className="w-full gap-2"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setResetEmailSent(false);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Tillbaka till inloggning
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">E-post</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="du@exempel.se"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Skicka återställningslänk
                  </Button>
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="w-full gap-2"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Tillbaka till inloggning
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url(${loginBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/60" />
      <div className="w-full max-w-md fade-in relative z-10">
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="p-5 rounded-xl bg-primary">
            <Calculator className="h-14 w-14 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-white">Tjänstekalkyl</h1>
            <p className="text-base text-white/80">Räkna fram och underhåll kalkyl på enkelt sätt</p>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle>Logga in</CardTitle>
            <CardDescription>Ange dina inloggningsuppgifter för att fortsätta</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">E-post</Label>
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="du@exempel.se"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="signin-password">Lösenord</Label>
                <Input
                  id="signin-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:underline"
                >
                  Glömt lösenord?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Logga in
              </Button>

              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  eller
                </span>
              </div>

              <SamlSsoButton disabled={loading} />
              
              <div className="mt-4 text-center">
                <Link 
                  to="/saml-config" 
                  className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1"
                >
                  <HelpCircle className="h-3 w-3" />
                  SSO-konfigurationsguide för administratörer
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
