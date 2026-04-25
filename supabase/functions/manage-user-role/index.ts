import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ROLES = ["OWNER", "ADMIN", "DISPATCHER", "TECHNICIAN"] as const;
type Role = typeof ROLES[number];

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const isUuid = (s: unknown): s is string =>
  typeof s === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

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
  const callerId = claimsData.claims.sub as string;

  let body: { action?: unknown; target_user_id?: unknown; role?: unknown };
  try { body = await req.json(); } catch { return json(400, { error: "Invalid JSON" }); }

  const action = body.action;
  const targetUserId = body.target_user_id;
  const role = body.role as Role | undefined;

  if (action !== "assign" && action !== "remove") {
    return json(400, { error: "action must be 'assign' or 'remove'" });
  }
  if (!isUuid(targetUserId)) return json(400, { error: "target_user_id must be uuid" });
  if (action === "assign" && (!role || !ROLES.includes(role))) {
    return json(400, { error: `role must be one of ${ROLES.join(", ")}` });
  }

  const admin = createClient(SUPABASE_URL, SERVICE);

  // Caller's org
  const { data: callerProfile, error: cpErr } = await admin
    .from("profiles").select("organization_id").eq("id", callerId).single();
  if (cpErr || !callerProfile?.organization_id) return json(403, { error: "No organization" });
  const orgId = callerProfile.organization_id as string;

  // Caller must be OWNER in that org
  const { data: callerRoles, error: crErr } = await admin
    .from("user_roles").select("role")
    .eq("user_id", callerId).eq("organization_id", orgId);
  if (crErr) return json(500, { error: "Role lookup failed" });
  const isOwner = (callerRoles ?? []).some((r) => r.role === "OWNER");
  if (!isOwner) return json(403, { error: "OWNER required" });

  // Target must be in the same org
  const { data: targetProfile, error: tpErr } = await admin
    .from("profiles").select("organization_id").eq("id", targetUserId).single();
  if (tpErr || targetProfile?.organization_id !== orgId) {
    return json(403, { error: "Target user not in your organization" });
  }

  if (action === "assign") {
    // Prevent duplicate (user_id, role) — table has unique constraint? if not, upsert-like
    const { data: existing } = await admin
      .from("user_roles").select("id")
      .eq("user_id", targetUserId).eq("organization_id", orgId).eq("role", role!);
    if (existing && existing.length > 0) {
      return json(200, { ok: true, already: true });
    }
    const { error: insErr } = await admin
      .from("user_roles").insert({ user_id: targetUserId, organization_id: orgId, role });
    if (insErr) return json(500, { error: "Insert failed" });
    return json(200, { ok: true });
  }

  // remove
  // Prevent removing last OWNER
  if (role === "OWNER" || role === undefined) {
    const { data: owners } = await admin
      .from("user_roles").select("user_id")
      .eq("organization_id", orgId).eq("role", "OWNER");
    const ownerIds = new Set((owners ?? []).map((o) => o.user_id));
    if (ownerIds.has(targetUserId as string) && ownerIds.size <= 1) {
      return json(400, { error: "Cannot remove the last OWNER" });
    }
  }

  let q = admin.from("user_roles").delete()
    .eq("user_id", targetUserId).eq("organization_id", orgId);
  if (role) q = q.eq("role", role);
  const { error: delErr } = await q;
  if (delErr) return json(500, { error: "Delete failed" });
  return json(200, { ok: true });
});
