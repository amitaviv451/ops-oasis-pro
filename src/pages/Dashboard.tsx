import { useEffect, useState } from "react";
import { Briefcase, DollarSign, UserPlus, Receipt, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// One-time welcome toast for newly bootstrapped accounts (e.g. Google OAuth signups)
const WELCOME_KEY = "fp.welcomeShown";
async function maybeWelcomeNewUser() {
  if (localStorage.getItem(WELCOME_KEY)) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  // Ensure profile + org exist (the DB trigger handles this; this is a safety net + freshness check)
  const { data: profile } = await supabase
    .from("profiles").select("id, organization_id, full_name").eq("id", user.id).maybeSingle();
  if (!profile) return; // trigger will populate momentarily
  const created = new Date(user.created_at).getTime();
  const isFresh = Date.now() - created < 60_000;
  if (isFresh) {
    toast.success("Welcome to FieldPro! Set up your company in Settings.");
  }
  localStorage.setItem(WELCOME_KEY, "1");
}

interface KPI {
  openJobs: number;
  revenueMTD: number;
  newLeads: number;
  unpaid: number;
  growthPct: number;
}

interface RevPoint { month: string; revenue: number; }
interface RecentJob { id: string; job_number: number; title: string; customer_name: string | null; status: string; }

const statusStyles: Record<string, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  SCHEDULED: "bg-accent text-accent-foreground",
  IN_PROGRESS: "bg-warning/15 text-warning",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPI | null>(null);
  const [revData, setRevData] = useState<RevPoint[]>([]);
  const [recent, setRecent] = useState<RecentJob[]>([]);
  const [unpaidCount, setUnpaidCount] = useState(0);

  useEffect(() => {
    maybeWelcomeNewUser();
    (async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [openJobsRes, leadsRes, mtdRes, prevRes, unpaidRes, sixMoRes, recentRes, unpaidCountRes] = await Promise.all([
        supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["NEW", "SCHEDULED", "IN_PROGRESS"]),
        supabase.from("leads").select("id", { count: "exact", head: true }).eq("status", "NEW"),
        supabase.from("invoices").select("amount").eq("status", "PAID").gte("paid_at", monthStart.toISOString()),
        supabase.from("invoices").select("amount").eq("status", "PAID").gte("paid_at", prevMonthStart.toISOString()).lt("paid_at", monthStart.toISOString()),
        supabase.from("invoices").select("amount").in("status", ["SENT", "OVERDUE"]),
        supabase.from("invoices").select("amount,paid_at").eq("status", "PAID").gte("paid_at", sixMonthsAgo.toISOString()),
        supabase.from("jobs").select("id,job_number,title,customer_name,status").order("created_at", { ascending: false }).limit(5),
        supabase.from("invoices").select("id", { count: "exact", head: true }).in("status", ["SENT", "OVERDUE"]),
      ]);

      const sum = (rows: { amount: number | null }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
      const mtd = sum(mtdRes.data as any);
      const prev = sum(prevRes.data as any);
      const growth = prev > 0 ? ((mtd - prev) / prev) * 100 : 0;

      // Build 6-month series
      const buckets: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = d.toLocaleString("en", { month: "short" });
        buckets[key] = 0;
      }
      (sixMoRes.data ?? []).forEach((r: any) => {
        if (!r.paid_at) return;
        const d = new Date(r.paid_at);
        const key = d.toLocaleString("en", { month: "short" });
        if (key in buckets) buckets[key] += Number(r.amount ?? 0);
      });

      setKpi({
        openJobs: openJobsRes.count ?? 0,
        revenueMTD: mtd,
        newLeads: leadsRes.count ?? 0,
        unpaid: sum(unpaidRes.data as any),
        growthPct: growth,
      });
      setRevData(Object.entries(buckets).map(([month, revenue]) => ({ month, revenue })));
      setRecent((recentRes.data ?? []) as RecentJob[]);
      setUnpaidCount(unpaidCountRes.count ?? 0);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Here's what's happening across your business.</p>
      </div>

      {!loading && unpaidCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <AlertCircle className="h-5 w-5 text-warning" />
          <div className="flex-1 text-sm">
            <span className="font-semibold">{unpaidCount} unpaid invoice{unpaidCount === 1 ? "" : "s"}</span>
            <span className="text-muted-foreground"> totaling ${kpi?.unpaid.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard loading={loading} icon={Briefcase} label="Open jobs" value={kpi?.openJobs ?? 0} />
        <KpiCard loading={loading} icon={DollarSign} label="Revenue MTD" value={`$${(kpi?.revenueMTD ?? 0).toLocaleString()}`} trend={kpi?.growthPct} />
        <KpiCard loading={loading} icon={UserPlus} label="New leads" value={kpi?.newLeads ?? 0} />
        <KpiCard loading={loading} icon={Receipt} label="Unpaid" value={`$${(kpi?.unpaid ?? 0).toLocaleString()}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Revenue chart */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Revenue</h2>
              <p className="text-xs text-muted-foreground">Last 6 months</p>
            </div>
          </div>
          <div className="h-64">
            {loading ? <Skeleton className="h-full w-full" /> : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revData}>
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v / 1000}k`} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "var(--radius)", fontSize: 12 }}
                    formatter={(v: number) => [`$${v.toLocaleString()}`, "Revenue"]}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent jobs */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
          <h2 className="mb-4 text-base font-semibold">Recent jobs</h2>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No jobs yet.</div>
          ) : (
            <ul className="space-y-3">
              {recent.map((j) => (
                <li key={j.id} className="flex items-start justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">#{j.job_number} · {j.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{j.customer_name ?? "—"}</div>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[j.status])}>
                    {j.status.replace("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ loading, icon: Icon, label, value, trend }: { loading: boolean; icon: any; label: string; value: string | number; trend?: number }) => (
  <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
    <div className="flex items-center justify-between">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    {loading ? <Skeleton className="mt-3 h-8 w-24" /> : <div className="mt-2 text-2xl font-bold">{value}</div>}
    {!loading && typeof trend === "number" && trend !== 0 && (
      <div className={cn("mt-1 flex items-center gap-1 text-xs font-medium", trend > 0 ? "text-success" : "text-destructive")}>
        {trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(trend).toFixed(1)}% vs last month
      </div>
    )}
  </div>
);

export default Dashboard;
