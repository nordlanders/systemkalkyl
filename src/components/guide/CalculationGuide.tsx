import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { 
  X, ChevronLeft, ChevronRight, 
  FileText, Settings, BarChart3, 
  Save, CheckCircle2, ListPlus, 
  MousePointerClick, ArrowRight
} from 'lucide-react';

interface GuideStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  details: string[];
  tip?: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    title: 'Steg 1: Grunduppgifter',
    description: 'Börja med att fylla i grundläggande information om kalkylen.',
    icon: <FileText className="h-8 w-8 text-accent" />,
    details: [
      'Ange ett namn för kalkylen',
      'Välj CI (Configuration Item) från listan',
      'Välj tjänstetyp (t.ex. Anpassad drift)',
      'Välj kund och ägande organisation',
      'Välj kalkylår',
    ],
    tip: 'Alla fält måste fyllas i innan du kan gå vidare till nästa steg.',
  },
  {
    title: 'Steg 2: Prisrader',
    description: 'Lägg till och konfigurera prisrader för kalkylen.',
    icon: <ListPlus className="h-8 w-8 text-accent" />,
    details: [
      'Klicka "Lägg till rad" för att lägga till en prispost',
      'Välj pristyp från prislistan',
      'Ange antal/kvantitet',
      'Enhetspris hämtas automatiskt från priskonfigurationen',
      'Lägg till en kommentar vid behov',
      'Du kan lägga till flera rader för olika tjänster',
    ],
    tip: 'Totalbeloppet beräknas automatiskt. Du kan redigera eller ta bort rader genom att klicka på dem.',
  },
  {
    title: 'Steg 3: Sammanställning & Spara',
    description: 'Granska kalkylen och välj status innan du sparar.',
    icon: <BarChart3 className="h-8 w-8 text-accent" />,
    details: [
      'Granska alla prisrader och totalkostnaden',
      'Total årskostnad visas som primärt värde',
      'Månadskostnad visas inom parentes',
      'Välj status: Utkast eller Skicka för godkännande',
      'Klicka "Spara" för att spara kalkylen',
    ],
    tip: 'Du kan spara som utkast och komma tillbaka senare, eller skicka direkt för godkännande.',
  },
  {
    title: 'Hantera kalkyler',
    description: 'Efter att du sparat kan du hantera dina kalkyler från listan.',
    icon: <Settings className="h-8 w-8 text-accent" />,
    details: [
      'Alla dina kalkyler visas i kalkyloversikten',
      'Filtrera på år, status, tjänstetyp m.m.',
      'Klicka på en kalkyl för att redigera den',
      'Godkända kalkyler kan bara läsas, inte redigeras',
      'Du kan skapa en ny version av en godkänd kalkyl',
      'Exportera till PDF direkt från listan',
    ],
    tip: 'Använd "Visa alla" för att se kalkyler från andra användare (skrivskyddat).',
  },
];

interface CalculationGuideProps {
  open: boolean;
  onClose: () => void;
  onNavigateToCalculator?: () => void;
}

export default function CalculationGuide({ open, onClose, onNavigateToCalculator }: CalculationGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);

  if (!open) return null;

  const step = GUIDE_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === GUIDE_STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 shadow-lg border-accent/20 animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            {step.icon}
            <div>
              <h2 className="text-xl font-semibold text-foreground">{step.title}</h2>
              <p className="text-sm text-muted-foreground">{step.description}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <CardContent className="p-6">
          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {GUIDE_STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-8 bg-accent'
                    : i < currentStep
                    ? 'w-2.5 bg-accent/40'
                    : 'w-2.5 bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Details list */}
          <div className="space-y-3 mb-6">
            {step.details.map((detail, i) => (
              <div key={i} className="flex items-start gap-3 fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex-shrink-0 mt-0.5 h-6 w-6 rounded-full bg-accent/10 flex items-center justify-center">
                  <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                </div>
                <p className="text-sm text-foreground">{detail}</p>
              </div>
            ))}
          </div>

          {/* Tip */}
          {step.tip && (
            <div className="rounded-lg bg-accent/5 border border-accent/10 p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-accent">Tips: </span>
                {step.tip}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(s => s - 1)}
              disabled={isFirst}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Föregående
            </Button>

            <span className="text-sm text-muted-foreground">
              {currentStep + 1} / {GUIDE_STEPS.length}
            </span>

            {isLast ? (
              <Button
                onClick={() => {
                  onClose();
                  onNavigateToCalculator?.();
                }}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <MousePointerClick className="h-4 w-4 mr-1" />
                Skapa kalkyl
              </Button>
            ) : (
              <Button onClick={() => setCurrentStep(s => s + 1)}>
                Nästa
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
