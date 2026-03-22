import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, GripVertical, Save, ChevronUp, ChevronDown, Pencil, X } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';

interface GuideStep {
  id: string;
  step_order: number;
  title: string;
  description: string;
  icon_name: string;
  details: string[];
  tip: string | null;
  is_active: boolean;
}

const ICON_OPTIONS = [
  'FileText', 'ListPlus', 'BarChart3', 'Settings', 'Save',
  'CheckCircle2', 'MousePointerClick', 'ArrowRight', 'Calculator',
  'Users', 'Shield', 'Server', 'Building2'
];

export default function GuideManagement() {
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingStep, setEditingStep] = useState<GuideStep | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const fetchSteps = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('guide_steps')
      .select('*')
      .order('step_order');
    if (error) {
      toast({ title: 'Fel', description: 'Kunde inte hämta guidesteg.', variant: 'destructive' });
    } else {
      setSteps((data || []).map(s => ({
        ...s,
        details: Array.isArray(s.details) ? (s.details as string[]) : []
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchSteps(); }, []);

  const openNew = () => {
    const maxOrder = steps.length > 0 ? Math.max(...steps.map(s => s.step_order)) : 0;
    setEditingStep({
      id: '',
      step_order: maxOrder + 1,
      title: '',
      description: '',
      icon_name: 'FileText',
      details: [''],
      tip: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (step: GuideStep) => {
    setEditingStep({ ...step });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editingStep) return;
    setSaving(true);

    const payload = {
      step_order: editingStep.step_order,
      title: editingStep.title,
      description: editingStep.description,
      icon_name: editingStep.icon_name,
      details: editingStep.details.filter(d => d.trim() !== ''),
      tip: editingStep.tip || null,
      is_active: editingStep.is_active,
    };

    let error;
    if (editingStep.id) {
      ({ error } = await supabase.from('guide_steps').update(payload).eq('id', editingStep.id));
    } else {
      ({ error } = await supabase.from('guide_steps').insert(payload));
    }

    if (error) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sparat', description: 'Guidesteget har sparats.' });
      setDialogOpen(false);
      setEditingStep(null);
      fetchSteps();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Vill du verkligen ta bort detta steg?')) return;
    const { error } = await supabase.from('guide_steps').delete().eq('id', id);
    if (error) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Borttaget', description: 'Steget har tagits bort.' });
      fetchSteps();
    }
  };

  const moveStep = async (step: GuideStep, direction: 'up' | 'down') => {
    const idx = steps.findIndex(s => s.id === step.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= steps.length) return;

    const other = steps[swapIdx];
    // Swap orders
    await supabase.from('guide_steps').update({ step_order: 999 }).eq('id', step.id);
    await supabase.from('guide_steps').update({ step_order: step.step_order }).eq('id', other.id);
    await supabase.from('guide_steps').update({ step_order: other.step_order }).eq('id', step.id);
    fetchSteps();
  };

  const addDetail = () => {
    if (!editingStep) return;
    setEditingStep({ ...editingStep, details: [...editingStep.details, ''] });
  };

  const updateDetail = (index: number, value: string) => {
    if (!editingStep) return;
    const newDetails = [...editingStep.details];
    newDetails[index] = value;
    setEditingStep({ ...editingStep, details: newDetails });
  };

  const removeDetail = (index: number) => {
    if (!editingStep) return;
    setEditingStep({ ...editingStep, details: editingStep.details.filter((_, i) => i !== index) });
  };

  if (loading) {
    return <p className="text-muted-foreground">Laddar guidesteg...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Kalkylguide</h2>
          <p className="text-muted-foreground">Hantera stegen i den interaktiva guiden för att skapa kalkyler.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          Lägg till steg
        </Button>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <Card key={step.id} className={!step.is_active ? 'opacity-50' : ''}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex flex-col gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStep(step, 'up')} disabled={idx === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveStep(step, 'down')} disabled={idx === steps.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Steg {step.step_order}</span>
                  {!step.is_active && <span className="text-xs bg-muted px-2 py-0.5 rounded">Inaktiv</span>}
                </div>
                <h3 className="font-semibold text-foreground truncate">{step.title}</h3>
                <p className="text-sm text-muted-foreground truncate">{step.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => openEdit(step)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => handleDelete(step.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingStep?.id ? 'Redigera steg' : 'Nytt steg'}</DialogTitle>
          </DialogHeader>
          {editingStep && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titel</Label>
                  <Input value={editingStep.title} onChange={e => setEditingStep({ ...editingStep, title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Ikon</Label>
                  <Select value={editingStep.icon_name} onValueChange={v => setEditingStep({ ...editingStep, icon_name: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(icon => (
                        <SelectItem key={icon} value={icon}>{icon}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Beskrivning</Label>
                <Input value={editingStep.description} onChange={e => setEditingStep({ ...editingStep, description: e.target.value })} />
              </div>

              <div className="space-y-2">
                <Label>Detaljpunkter</Label>
                {editingStep.details.map((detail, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={detail}
                      onChange={e => updateDetail(i, e.target.value)}
                      placeholder={`Punkt ${i + 1}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeDetail(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={addDetail}>
                  <Plus className="h-3 w-3 mr-1" />
                  Lägg till punkt
                </Button>
              </div>

              <div className="space-y-2">
                <Label>Tips (valfritt)</Label>
                <Textarea
                  value={editingStep.tip || ''}
                  onChange={e => setEditingStep({ ...editingStep, tip: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editingStep.is_active}
                  onCheckedChange={v => setEditingStep({ ...editingStep, is_active: v })}
                />
                <Label>Aktiv</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Avbryt</Button>
            <Button onClick={handleSave} disabled={saving || !editingStep?.title}>
              <Save className="h-4 w-4 mr-1" />
              {saving ? 'Sparar...' : 'Spara'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
