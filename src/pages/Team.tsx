import { useEffect, useMemo, useState } from "react";
import { UsersRound, Shield, Loader2, Trash2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOrgId } from "@/lib/useOrgId";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "DISPATCHER" | "TECHNICIAN";
const ALL_ROLES: Role[] = ["OWNER", "ADMIN", "DISPATCHER", "TECHNICIAN"];

interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  roles: Role[];
}

const roleStyles: Record<Role, string> = {
  OWNER: "bg-primary/15 text-primary",
  ADMIN: "bg-warning/15 text-warning",
  DISPATCHER: "bg-accent text-accent-foreground",
  TECHNICIAN: "bg-secondary text-secondary-foreground",
};

const Team = () => {
  const { user } = useAuth();
  const orgId = useOrgId();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [callerIsOwner, setCallerIsOwner] = useState(false);
  const [pending, setPending] = useState<string | null>(null); // `${userId}:${role}` while mutating
  const [adding, setAdding] = useState<Record<string, Role>>({});

  const load = async (oid: string, uid: string) => {
    setLoading(true);
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email").eq("organization_id", oid),
      supabase.from("user_roles").select("user_id, role").eq("organization_id", oid),
    ]);
    if (profilesRes.error || rolesRes.error) {
      toast({ title: "Failed to load team", variant: "destructive" });
      setLoading(false);
      return;
    }
    const rolesByUser = new Map<string, Role[]>();
    (rolesRes.data ?? []).forEach((r) => {
      const list = rolesByUser.get(r.user_id) ?? [];
      list.push(r.role as Role);
      rolesByUser.set(r.user_id, list);
    });
    setMembers((profilesRes.data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      roles: rolesByUser.get(p.id) ?? [],
    })));
    setCallerIsOwner((rolesByUser.get(uid) ?? []).includes("OWNER"));
    setLoading(false);
  };

  useEffect(() => {
    if (!orgId || !user) return;
    load(orgId, user.id);
  }, [orgId, user]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    members.forEach((m) => m.roles.forEach((r) => { c[r] = (c[r] ?? 0) + 1; }));
    return c;
  }, [members]);

  const callRoleFn = async (action: "assign" | "remove", target_user_id: string, role: Role) => {
    const key = `${target_user_id}:${role}:${action}`;
    setPending(key);
    const { data, error } = await supabase.functions.invoke("manage-user-role", {
      body: { action, target_user_id, role },
    });
    setPending(null);
    const errMsg = error?.message ?? (data as { error?: string } | null)?.error;
    if (errMsg) {
      toast({ title: action === "assign" ? "Assign failed" : "Remove failed", description: errMsg, variant: "destructive" });
      return false;
    }
    toast({ title: action === "assign" ? "Role assigned" : "Role removed" });
    if (orgId && user) await load(orgId, user.id);
    return true;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          Everyone with access to your FieldPro workspace.
          {!callerIsOwner && !loading && (
            <span className="ml-1 italic">Only OWNERs can assign or remove roles.</span>
          )}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {ALL_ROLES.map((r) => (
          <div key={r} className="rounded-xl border border-border bg-card p-4 shadow-soft">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{r}</div>
            <div className="mt-1 text-2xl font-bold">{counts[r] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><UsersRound className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">No team members</h2>
            <p className="mt-2 text-sm text-muted-foreground">Invite teammates to collaborate (coming soon).</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                {callerIsOwner && <TableHead className="w-[260px]">Assign role</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const available = ALL_ROLES.filter((r) => !m.roles.includes(r));
                const selected = adding[m.id] ?? available[0];
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-primary text-xs font-semibold text-primary-foreground">
                          {(m.full_name ?? m.email ?? "?")[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium">{m.full_name ?? "—"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email ?? "—"}</TableCell>
                    <TableCell>
                      {m.roles.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {m.roles.map((r) => {
                            const removeKey = `${m.id}:${r}:remove`;
                            return (
                              <span
                                key={r}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                  roleStyles[r],
                                )}
                              >
                                <Shield className="h-3 w-3" />
                                {r}
                                {callerIsOwner && (
                                  <button
                                    type="button"
                                    aria-label={`Remove ${r}`}
                                    onClick={() => callRoleFn("remove", m.id, r)}
                                    disabled={pending === removeKey}
                                    className="ml-1 rounded-full p-0.5 hover:bg-foreground/10 disabled:opacity-50"
                                  >
                                    {pending === removeKey ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                    {callerIsOwner && (
                      <TableCell>
                        {available.length === 0 ? (
                          <span className="text-xs text-muted-foreground">All roles assigned</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Select
                              value={selected}
                              onValueChange={(v) => setAdding((s) => ({ ...s, [m.id]: v as Role }))}
                            >
                              <SelectTrigger className="h-8 w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {available.map((r) => (
                                  <SelectItem key={r} value={r}>{r}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending === `${m.id}:${selected}:assign`}
                              onClick={() => callRoleFn("assign", m.id, selected)}
                            >
                              {pending === `${m.id}:${selected}:assign` ? (
                                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Plus className="mr-1 h-3.5 w-3.5" />
                              )}
                              Assign
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default Team;
