import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  corsHeaders, makeHeaders, verifyAuth, logSecurityEvent,
} from "../_shared/security.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const ip = req.headers.get("x-forwarded-for") || "unknown";

  try {
    // Verify auth
    const { user, error: authError } = await verifyAuth(req);
    if (authError || !user) return authError!;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    await logSecurityEvent(adminClient, {
      user_id: user.id,
      event_type: "account_deleted",
      details: `User ${user.email} deleted their account`,
      ip_address: ip,
    });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), { status: 500, headers: makeHeaders() });
    }

    return new Response(JSON.stringify({ success: true }), { headers: makeHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: makeHeaders() });
  }
});
