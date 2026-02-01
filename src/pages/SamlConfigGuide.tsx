import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, CheckCircle2, Circle, Copy, ExternalLink, Info, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

export default function SamlConfigGuide() {
  const { toast } = useToast();
  
  // These values need to be configured based on your Supabase project
  const supabaseProjectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'your-project-ref';
  const acsUrl = `https://${supabaseProjectRef}.supabase.co/auth/v1/sso/saml/acs`;
  const entityId = `https://${supabaseProjectRef}.supabase.co/auth/v1/sso/saml/metadata`;
  const metadataUrl = `https://${supabaseProjectRef}.supabase.co/auth/v1/sso/saml/metadata`;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Kopierat!',
      description: `${label} har kopierats till urklipp.`,
    });
  };

  const steps = [
    {
      title: 'Registrera applikationen i Onegate',
      description: 'Skapa en ny SAML-applikation i Onegate-portalen',
      completed: false,
      details: [
        'Logga in på Onegate administratörsportal',
        'Skapa en ny SAML 2.0-applikation',
        'Ge applikationen ett namn (t.ex. "IT-Kostnadskalkylator")',
      ],
    },
    {
      title: 'Konfigurera Service Provider (SP) metadata',
      description: 'Ange följande värden i Onegate',
      completed: false,
      details: [],
      metadata: [
        { label: 'ACS URL (Assertion Consumer Service)', value: acsUrl },
        { label: 'Entity ID / Audience URI', value: entityId },
        { label: 'Metadata URL', value: metadataUrl },
      ],
    },
    {
      title: 'Konfigurera attributmappning',
      description: 'Mappa användarattribut från Onegate till SAML-claims',
      completed: false,
      details: [
        'email → user.email (obligatoriskt)',
        'name eller displayName → user.name (valfritt)',
        'groups → user.groups (valfritt, för rollhantering)',
      ],
    },
    {
      title: 'Hämta IdP-metadata från Onegate',
      description: 'Exportera metadata för konfiguration i Lovable Cloud',
      completed: false,
      details: [
        'Ladda ner eller kopiera IdP Metadata XML från Onegate',
        'Notera Entity ID, SSO URL och X.509-certifikat',
      ],
    },
    {
      title: 'Konfigurera SAML i Lovable Cloud',
      description: 'Lägg till IdP-konfigurationen i backend',
      completed: false,
      details: [
        'Öppna Lovable Cloud Dashboard',
        'Gå till Authentication → SSO Providers',
        'Lägg till ny SAML-provider med Onegate-metadata',
        'Ange domän (t.ex. sundsvall.se)',
      ],
    },
    {
      title: 'Testa integrationen',
      description: 'Verifiera att SSO-inloggning fungerar',
      completed: false,
      details: [
        'Gå till inloggningssidan',
        'Klicka på "Logga in med Onegate SSO"',
        'Du bör omdirigeras till Onegate för autentisering',
        'Efter inloggning ska du komma tillbaka till applikationen',
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/auth">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">SAML SSO-konfiguration</h1>
            <p className="text-muted-foreground">Guide för att konfigurera Onegate som Identity Provider</p>
          </div>
        </div>

        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Administratörsbehörighet krävs</AlertTitle>
          <AlertDescription>
            Denna konfiguration kräver administratörsåtkomst till både Onegate och Lovable Cloud Dashboard.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          {steps.map((step, index) => (
            <Card key={index}>
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {step.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-500" />
                    ) : (
                      <div className="flex items-center justify-center h-6 w-6 rounded-full border-2 border-primary text-primary font-semibold text-sm">
                        {index + 1}
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {step.title}
                      {step.completed && <Badge variant="secondary">Klar</Badge>}
                    </CardTitle>
                    <CardDescription>{step.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pl-14">
                {step.details.length > 0 && (
                  <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-4">
                    {step.details.map((detail, i) => (
                      <li key={i}>{detail}</li>
                    ))}
                  </ul>
                )}
                
                {step.metadata && (
                  <div className="space-y-3">
                    {step.metadata.map((item, i) => (
                      <div key={i} className="bg-muted rounded-lg p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-muted-foreground mb-1">{item.label}</p>
                            <code className="text-sm break-all">{item.value}</code>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(item.value, item.label)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              Ytterligare information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">SAML-protokoll</h4>
              <p className="text-sm text-muted-foreground">
                Denna integration använder SAML 2.0 för säker Single Sign-On. 
                Användare autentiseras via Onegate och en signerad SAML-assertion 
                skickas tillbaka till applikationen.
              </p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Stöd för Just-In-Time (JIT) provisioning</h4>
              <p className="text-sm text-muted-foreground">
                När en användare loggar in för första gången via SSO skapas automatiskt 
                ett konto i systemet med de attribut som skickas från Onegate.
              </p>
            </div>
            <Separator />
            <div>
              <h4 className="font-semibold mb-2">Felsökning</h4>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Kontrollera att ACS URL är korrekt konfigurerad i Onegate</li>
                <li>Verifiera att certifikatet inte har gått ut</li>
                <li>Säkerställ att användarattribut mappas korrekt</li>
                <li>Kontrollera att domänen matchar den konfigurerade domänen</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <Button asChild variant="outline">
            <a 
              href="https://docs.lovable.dev" 
              target="_blank" 
              rel="noopener noreferrer"
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Läs mer i dokumentationen
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
