import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Loader2, BookOpen, Calculator, Settings, Users, History, BarChart3, Home, Shield, FileText, Download, Search, Filter, Clock, CheckCircle2, FileCheck } from 'lucide-react';

export default function UserManualPage() {
  const { user, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 fade-in max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <BookOpen className="h-8 w-8 text-primary" />
            Användarmanual
          </h1>
          <p className="text-muted-foreground mt-1">
            Lär dig hur du använder Tjänstekalkyl effektivt
          </p>
        </div>

        {/* Introduction */}
        <Card>
          <CardHeader>
            <CardTitle>Välkommen till Tjänstekalkyl</CardTitle>
            <CardDescription>
              Ett verktyg för att räkna fram och underhålla IT-kostnadskalkyler
            </CardDescription>
          </CardHeader>
          <CardContent className="prose prose-sm dark:prose-invert max-w-none">
            <p>
              Tjänstekalkyl är ett system för att skapa, hantera och följa upp kostnadskalkyler 
              för IT-tjänster. Systemet använder en central priskonfiguration som gör det enkelt 
              att hålla alla kalkyler uppdaterade med aktuella priser.
            </p>
          </CardContent>
        </Card>

        {/* Navigation Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5 text-primary" />
              Navigering
            </CardTitle>
            <CardDescription>
              Så här hittar du runt i systemet
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Home className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Start</h4>
                  <p className="text-sm text-muted-foreground">Startsidan med nyheter och snabblänkar</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <Calculator className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Kalkyler</h4>
                  <p className="text-sm text-muted-foreground">Skapa och hantera dina kalkyler</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <History className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Historik</h4>
                  <p className="text-sm text-muted-foreground">Se ändringshistorik i systemet</p>
                </div>
              </div>
              {isAdmin && (
                <>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <BarChart3 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium">Analys</h4>
                      <p className="text-sm text-muted-foreground">Statistik och översikt</p>
                      <Badge variant="outline" className="mt-1">Admin</Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Settings className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium">Priskonfiguration</h4>
                      <p className="text-sm text-muted-foreground">Hantera prislistor och priser</p>
                      <Badge variant="outline" className="mt-1">Admin</Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <Users className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <h4 className="font-medium">Användare</h4>
                      <p className="text-sm text-muted-foreground">Hantera systemanvändare</p>
                      <Badge variant="outline" className="mt-1">Admin</Badge>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Calculator Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-primary" />
              Skapa kalkyler
            </CardTitle>
            <CardDescription>
              Steg-för-steg guide för att skapa en ny kalkyl
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="step1">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge className="rounded-full">1</Badge>
                    Grundläggande information
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>I första steget anger du grundläggande information om kalkylen:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li><strong>Kund</strong> – Välj vilken kund kalkylen gäller</li>
                    <li><strong>Tjänstetyp</strong> – Typ av tjänst (Bastjänst IT infrastruktur, Anpassad drift, etc.)</li>
                    <li><strong>Ägande organisation</strong> – Organisationen som äger tjänsten</li>
                    <li><strong>CI-identitet</strong> – Unik identifierare för tjänsten</li>
                    <li><strong>Kalkylår</strong> – Vilket år kalkylen gäller för</li>
                    <li><strong>Namn</strong> – Ett beskrivande namn för kalkylen (valfritt)</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step2">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge className="rounded-full">2</Badge>
                    Prisrader
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>I andra steget lägger du till prisrader baserat på priskonfigurationen:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Prisrader förpopuleras automatiskt baserat på vald tjänstetyp</li>
                    <li>Ange antal för varje rad (stödjer decimaler med punkt eller komma)</li>
                    <li>Lägg till kommentarer vid behov</li>
                    <li>Totalkostnaden beräknas automatiskt</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step3">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <Badge className="rounded-full">3</Badge>
                    Sammanfattning, status och spara
                  </span>
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground space-y-2">
                  <p>I sista steget ser du en sammanfattning och väljer status:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Granska all information innan du sparar</li>
                    <li><strong>Välj status:</strong>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li><strong>Ej klar</strong> – Kalkylen är under arbete</li>
                        <li><strong>Klar (men ej godkänd)</strong> – Kalkylen är klar och väntar på godkännande</li>
                      </ul>
                    </li>
                    <li>Klicka på "Spara kalkyl" för att spara</li>
                    <li>Varje sparning skapar en ny version för spårbarhet</li>
                  </ul>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Status and Approval Guide */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Status och godkännande
            </CardTitle>
            <CardDescription>
              Så fungerar kalkylstatus och godkännandeflödet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="font-medium">Ej klar</h4>
                <p className="text-sm text-muted-foreground">
                  Kalkylen är under arbete och inte redo för granskning
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Clock className="h-5 w-5 text-amber-500 mt-0.5" />
              <div>
                <h4 className="font-medium">Klar (men ej godkänd)</h4>
                <p className="text-sm text-muted-foreground">
                  Kalkylen är klar och väntar på att godkännas av en behörig person
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <h4 className="font-medium">Godkänd</h4>
                <p className="text-sm text-muted-foreground">
                  Kalkylen har godkänts. Om ändringar görs krävs nytt godkännande.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Sök och filtrera kalkyler
            </CardTitle>
            <CardDescription>
              Hitta rätt kalkyl snabbt
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Search className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Sökfält</h4>
                <p className="text-sm text-muted-foreground">
                  Sök på kalkylnamn, CI-identitet, kund eller organisation
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Filter className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Filter</h4>
                <p className="text-sm text-muted-foreground">
                  Filtrera på kalkylår, kund och tjänstetyp. Klicka på "Rensa filter" för att återställa.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
              <Download className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium">Exportera PDF</h4>
                <p className="text-sm text-muted-foreground">
                  Klicka på nedladdningsikonen för att exportera en kalkyl som PDF.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Guide */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Administratörsfunktioner
              </CardTitle>
              <CardDescription>
                Funktioner som endast är tillgängliga för administratörer
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="pricing">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Priskonfiguration
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Hantera prislistor och priser för kalkyler:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Lägg till nya prisrader med typ, enhet och pris</li>
                      <li>Ange vilka tjänstetyper som prisraden gäller för</li>
                      <li>Sätt giltighetsperiod för priser</li>
                      <li>Redigera eller ta bort befintliga prisrader</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="users">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Användarhantering
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Hantera systemanvändare:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Skapa nya användare med e-post och lösenord</li>
                      <li>Tilldela roller (Användare, Admin, Superadmin)</li>
                      <li>Sätt behörighetsnivå (Läs/Skriv)</li>
                      <li><strong>Godkännandebehörighet</strong> – Ange om användaren kan godkänna kalkyler</li>
                      <li><strong>Organisationer</strong> – Välj vilka organisationers kalkyler användaren kan godkänna</li>
                      <li>Återställ användarlösenord</li>
                      <li>Se senaste inloggning för varje användare</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="analytics">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analys och statistik
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Få översikt över systemanvändning:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Antal kalkyler per kund</li>
                      <li>Totala kostnader per tjänstetyp</li>
                      <li>Trender över tid</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="approvals">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <FileCheck className="h-4 w-4" />
                      Godkännanden
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Granska och godkänn kalkyler:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Se alla kalkyler som väntar på godkännande</li>
                      <li>Granska detaljer för varje kalkyl</li>
                      <li>Godkänn kalkyler för de organisationer du har behörighet till</li>
                      <li>Godkända kalkyler kan fortfarande redigeras men kräver då nytt godkännande</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="news">
                  <AccordionTrigger>
                    <span className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Nyheter
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground space-y-2">
                    <p>Publicera nyheter och meddelanden:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Skapa och redigera nyheter på startsidan</li>
                      <li>Välj om nyheten ska publiceras direkt eller sparas som utkast</li>
                      <li>Ta bort gamla nyheter</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Tips och genvägar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">•</span>
                Klicka på en kalkyl i listan för att redigera den direkt
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">•</span>
                Klicka på kolumnrubriker i tabellen för att sortera
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">•</span>
                Använd snabblänkarna på startsidan för att navigera snabbt
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">•</span>
                Kvantitetsfältet stödjer decimaler med både punkt och komma
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium">•</span>
                Alla ändringar loggas i historiken för spårbarhet
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
