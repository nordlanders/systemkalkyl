import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      }
    );

    const { data: { user: requestingUser }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !requestingUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if requesting user is admin or superadmin
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", requestingUser.id)
      .in("role", ["admin", "superadmin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Only admins can update user settings" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requestingUserRole = roleData.role;

    const { userId, role, permissionLevel, canApprove, approvalOrganizations } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if target user is superadmin - only superadmins can modify superadmins
    const { data: targetRoleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (targetRoleData?.role === "superadmin" && requestingUserRole !== "superadmin") {
      return new Response(JSON.stringify({ error: "Endast superadmin kan ändra en superadmin-användare" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Non-superadmins cannot promote anyone to superadmin
    if (role === "superadmin" && requestingUserRole !== "superadmin") {
      return new Response(JSON.stringify({ error: "Endast superadmin kan tilldela superadmin-rollen" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get old values for audit
    const { data: oldProfile } = await supabaseAdmin
      .from("profiles")
      .select("permission_level, can_approve, approval_organizations")
      .eq("user_id", userId)
      .single();

    const { data: oldRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    // Update profile settings
    const profileUpdates: Record<string, unknown> = {};
    if (permissionLevel !== undefined) {
      profileUpdates.permission_level = permissionLevel;
    }
    if (canApprove !== undefined) {
      profileUpdates.can_approve = canApprove;
    }
    if (approvalOrganizations !== undefined) {
      profileUpdates.approval_organizations = approvalOrganizations;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await supabaseAdmin
        .from("profiles")
        .update(profileUpdates)
        .eq("user_id", userId);
    }

    // Update role
    if (role) {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);

      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userId, role });
    }

    // Log the audit
    await supabaseAdmin.from("audit_log").insert({
      user_id: requestingUser.id,
      action: "update",
      table_name: "user_settings",
      record_id: userId,
      old_values: { 
        role: oldRole?.role, 
        permissionLevel: oldProfile?.permission_level,
        canApprove: oldProfile?.can_approve,
        approvalOrganizations: oldProfile?.approval_organizations,
      },
      new_values: { role, permissionLevel, canApprove, approvalOrganizations },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
