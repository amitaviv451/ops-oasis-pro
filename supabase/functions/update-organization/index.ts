import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) return json(401, { error: "Unauthorized" });
  const userId = claimsData.claims.sub as string;

  let body: { name?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 120) {
    return json(400, { error: "Name must be 1-120 characters" });
  }

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Resolve caller's org
  const { data: profile, error: pErr } = await admin
    .from("profiles").select("organization_id").eq("id", userId).single();
  if (pErr || !profile?.organization_id) return json(403, { error: "No organization" });
  const orgId = profile.organization_id as string;

  // Require OWNER or ADMIN in that org
  const { data: roles, error: rErr } = await admin
    .from("user_roles").select("role")
    .eq("user_id", userId).eq("organization_id", orgId);
  if (rErr) return json(500, { error: "Role lookup failed" });
  const allowed = (roles ?? []).some((r) => r.role === "OWNER" || r.role === "ADMIN");
  if (!allowed) return json(403, { error: "OWNER or ADMIN required" });

  const { error: uErr } = await admin
    .from("organizations").update({ name }).eq("id", orgId);
  if (uErr) return json(500, { error: "Update failed" });

  return json(200, { ok: true, organization_id: orgId, name });
});
