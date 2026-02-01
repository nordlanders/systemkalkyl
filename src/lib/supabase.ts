import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export { supabase };

// Type definitions for our tables
export interface Profile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface PricingConfig {
  id: string;
  component_type: string;
  price_per_unit: number;
  effective_from: string;
  effective_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Calculation {
  id: string;
  user_id: string;
  name: string | null;
  cpu_count: number;
  storage_gb: number;
  server_count: number;
  operation_hours: number;
  cpu_cost: number;
  storage_cost: number;
  server_cost: number;
  operation_cost: number;
  total_cost: number;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_values: Json | null;
  new_values: Json | null;
  created_at: string;
}

// Helper to get current effective pricing
export async function getCurrentPricing(): Promise<PricingConfig[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('pricing_config')
    .select('*')
    .lte('effective_from', today)
    .or(`effective_to.is.null,effective_to.gte.${today}`)
    .order('effective_from', { ascending: false });

  if (error) throw error;
  
  // Get the most recent price for each component type
  const latestPrices: Record<string, PricingConfig> = {};
  (data as PricingConfig[]).forEach((price) => {
    if (!latestPrices[price.component_type]) {
      latestPrices[price.component_type] = price;
    }
  });
  
  return Object.values(latestPrices);
}

// Log an audit entry
export async function logAudit(
  action: string,
  tableName: string,
  recordId: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
) {
  const { data: { user } } = await supabase.auth.getUser();
  
  await supabase.from('audit_log').insert([{
    user_id: user?.id || null,
    action,
    table_name: tableName,
    record_id: recordId,
    old_values: (oldValues as Json) || null,
    new_values: (newValues as Json) || null,
  }]);
}
