import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { 
  X, ChevronLeft, ChevronRight, 
  FileText, Settings, BarChart3, 
  Save, CheckCircle2, ListPlus, 
  MousePointerClick, ArrowRight,
  Calculator, Users, Shield, Server, Building2,
  Download
} from 'lucide-react';
import { generateGuidePdf } from '@/lib/guide-pdf';

const ICON_MAP: Record<string, React.ReactNode> = {
  FileText: <FileText className="h-8 w-8 text-accent" />,
  ListPlus: <ListPlus className="h-8 w-8 text-accent" />,
  BarChart3: <BarChart3 className="h-8 w-8 text-accent" />,
  Settings: <Settings className="h-8 w-8 text-accent" />,
  Save: <Save className="h-8 w-8 text-accent" />,
  CheckCircle2: <CheckCircle2 className="h-8 w-8 text-accent" />,
  MousePointerClick: <MousePointerClick className="h-8 w-8 text-accent" />,
  ArrowRight: <ArrowRight className="h-8 w-8 text-accent" />,
  Calculator: <Calculator className="h-8 w-8 text-accent" />,
  Users: <Users className="h-8 w-8 text-accent" />,
  Shield: <Shield className="h-8 w-8 text-accent" />,
  Server: <Server className="h-8 w-8 text-accent" />,
  Building2: <Building2 className="h-8 w-8 text-accent" />,
};

interface GuideStep {
  id: string;
  title: string;
  description: string;
  icon_name: string;
  details: string[];
  tip: string | null;
}

interface CalculationGuideProps {
  open: boolean;
  onClose: () => void;
  onNavigateToCalculator?: () => void;
}

export default function CalculationGuide({ open, onClose, onNavigateToCalculator }: CalculationGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setCurrentStep(0);
    setLoading(true);
    supabase
      .from('guide_steps')
      .select('id, title, description, icon_name, details, tip')
      .eq('is_active', true)
      .order('step_order')
      .then(({ data }) => {
        setSteps((data || []).map(s => ({
          ...s,
          details: Array.isArray(s.details) ? (s.details as string[]) : []
        })));
        setLoading(false);
      });
  }, [open]);

  if (!open) return null;

  if (loading || steps.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <Card className="w-full max-w-md mx-4 p-6 text-center">
          <p className="text-muted-foreground">{loading ? 'Laddar guide...' : 'Ingen guide konfigurerad.'}</p>
          <Button variant="outline" className="mt-4" onClick={onClose}>Stäng</Button>
        </Card>
      </div>
    );
  }

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const icon = ICON_MAP[step.icon_name] || <FileText className="h-8 w-8 text-accent" />;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <Card className="w-full max-w-2xl mx-4 shadow-lg border-accent/20 animate-scale-in">
        <div className="flex items-center justify-between p-6 pb-0">
          <div className="flex items-center gap-3">
            {icon}
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
          <div className="flex items-center justify-center gap-2 mb-6">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === currentStep ? 'w-8 bg-accent' : i < currentStep ? 'w-2.5 bg-accent/40' : 'w-2.5 bg-muted'
                }`}
              />
            ))}
          </div>

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

          {step.tip && (
            <div className="rounded-lg bg-accent/5 border border-accent/10 p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-accent">Tips: </span>
                {step.tip}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => setCurrentStep(s => s - 1)} disabled={isFirst}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Föregående
            </Button>
            <span className="text-sm text-muted-foreground">{currentStep + 1} / {steps.length}</span>
            {isLast ? (
              <Button
                onClick={() => { onClose(); onNavigateToCalculator?.(); }}
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
