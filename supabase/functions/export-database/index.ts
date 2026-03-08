import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify user is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    const { data: isSuperadmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'superadmin' });
    if (!isAdmin && !isSuperadmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const tables = [
      'owning_organizations', 'customers', 'organizations', 'configuration_items',
      'pricing_config', 'calculations', 'calculation_items', 'calculation_versions',
      'profiles', 'user_roles', 'news', 'audit_log', 'budget_outcomes'
    ];

    const dump: Record<string, unknown[]> = {};

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(10000);
      if (error) {
        dump[table] = [{ error: error.message }];
      } else {
        dump[table] = data || [];
      }
    }

    const exportData = {
      exported_at: new Date().toISOString(),
      exported_by: user.email,
      tables: dump,
      row_counts: Object.fromEntries(Object.entries(dump).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]))
    };

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="database-export.json"'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
