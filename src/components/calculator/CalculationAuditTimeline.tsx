import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

interface AuditEntry {
  id: string;
  action: string;
  created_at: string;
  user_name: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Skapade kalkylen',
  update: 'Ändrade kalkylen',
  approve: 'Godkände kalkylen',
  close: 'Avslutade kalkylen',
  reject: 'Avvisade kalkylen',
  submit: 'Skickade för godkännande',
};

export default function CalculationAuditTimeline({ calculationId }: { calculationId: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('audit_log')
          .select('id, action, created_at, user_id')
          .eq('table_name', 'calculations')
          .eq('record_id', calculationId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        // Get unique user IDs
        const userIds = [...new Set((data || []).map(d => d.user_id).filter(Boolean))] as string[];
        
        // Fetch profile names
        let profileMap: Record<string, string> = {};
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);
          
          (profiles || []).forEach(p => {
            profileMap[p.user_id] = p.full_name || p.email;
          });
        }

        setEntries((data || []).map(d => ({
          id: d.id,
          action: d.action,
          created_at: d.created_at,
          user_name: d.user_id ? profileMap[d.user_id] || null : null,
        })));
      } catch (err) {
        console.error('Error loading audit timeline:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [calculationId]);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Ingen historik tillgänglig.</p>;
  }

  return (
    <div className="relative space-y-0">
      {/* Timeline line */}
      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
      
      {entries.map((entry, index) => (
        <div key={entry.id} className="relative flex items-start gap-3 py-2">
          {/* Dot */}
          <div className={`relative z-10 mt-1.5 h-[9px] w-[9px] rounded-full shrink-0 ${
            index === entries.length - 1 ? 'bg-primary' : 'bg-muted-foreground/40'
          }`} />
          
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {ACTION_LABELS[entry.action] || entry.action}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{format(new Date(entry.created_at), 'd MMM yyyy, HH:mm', { locale: sv })}</span>
              {entry.user_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {entry.user_name}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
