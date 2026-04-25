import { useEffect, useMemo, useState } from "react";
import { UsersRound, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "DISPATCHER" | "TECHNICIAN";

interface Member {
  id: string;
  full_name: string | null;
  email: string | null;
  role: Role | null;
}

const roleStyles: Record<Role, string> = {
  OWNER: "bg-primary/15 text-primary",
  ADMIN: "bg-warning/15 text-warning",
  DISPATCHER: "bg-accent text-accent-foreground",
  TECHNICIAN: "bg-secondary text-secondary-foreground",
};

const Team = () => {
  const orgId = useOrgId();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").eq("organization_id", orgId),
        supabase.from("user_roles").select("user_id, role").eq("organization_id", orgId),
      ]);
      if (profilesRes.error || rolesRes.error) {
        toast({ title: "Failed to load team", variant: "destructive" });
        setLoading(false);
        return;
      }
      const roleMap = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r.role as Role]));
      setMembers((profilesRes.data ?? []).map((p) => ({ ...p, role: roleMap.get(p.id) ?? null })));
      setLoading(false);
    })();
  }, [orgId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    members.forEach((m) => { if (m.role) c[m.role] = (c[m.role] ?? 0) + 1; });
    return c;
  }, [members]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">Everyone with access to your FieldPro workspace.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {(["OWNER", "ADMIN", "DISPATCHER", "TECHNICIAN"] as Role[]).map((r) => (
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
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead></TableRow></TableHeader>
            <TableBody>
              {members.map((m) => (
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
                    {m.role ? (
                      <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", roleStyles[m.role])}>
                        <Shield className="h-3 w-3" />{m.role}
                      </span>
                    ) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
};

export default Team;
