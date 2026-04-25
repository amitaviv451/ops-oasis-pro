import { useEffect, useMemo, useState } from "react";
import { BarChart3, TrendingUp, DollarSign, Briefcase, UserPlus } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface Inv { amount: number; status: string; issued_at: string; }
interface Job { status: string; created_at: string; estimated_cost: number | null; actual_cost: number | null; }
interface Lead { status: string; created_at: string; }

const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [iRes, jRes, lRes] = await Promise.all([
        supabase.from("invoices").select("amount, status, issued_at"),
        supabase.from("jobs").select("status, created_at, estimated_cost, actual_cost"),
        supabase.from("leads").select("status, created_at"),
      ]);
      setInvoices((iRes.data ?? []) as Inv[]);
      setJobs((jRes.data ?? []) as Job[]);
      setLeads((lRes.data ?? []) as Lead[]);
      setLoading(false);
    })();
  }, []);

  const monthly = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), 5 - i));
    return months.map((m) => {
      const start = startOfMonth(m).getTime();
      const end = endOfMonth(m).getTime();
      const revenue = invoices
        .filter((i) => i.status === "PAID" && new Date(i.issued_at).getTime() >= start && new Date(i.issued_at).getTime() <= end)
        .reduce((s, i) => s + Number(i.amount), 0);
      const newJobs = jobs.filter((j) => new Date(j.created_at).getTime() >= start && new Date(j.created_at).getTime() <= end).length;
      return { month: format(m, "MMM"), revenue, jobs: newJobs };
    });
  }, [invoices, jobs]);

  const totals = useMemo(() => ({
    revenue: invoices.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.amount), 0),
    outstanding: invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.amount), 0),
    activeJobs: jobs.filter((j) => j.status === "IN_PROGRESS" || j.status === "SCHEDULED").length,
    conversion: leads.length === 0 ? 0 : Math.round((leads.filter((l) => l.status === "CONVERTED").length / leads.length) * 100),
  }), [invoices, jobs, leads]);

  if (loading) {
    return <div className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <div className="grid gap-4 sm:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-80 w-full" />
    </div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Revenue, jobs, and pipeline health at a glance.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={DollarSign} label="Revenue (paid)" value={`$${totals.revenue.toLocaleString()}`} />
        <Stat icon={TrendingUp} label="Outstanding" value={`$${totals.outstanding.toLocaleString()}`} />
        <Stat icon={Briefcase} label="Active jobs" value={String(totals.activeJobs)} />
        <Stat icon={UserPlus} label="Lead conversion" value={`${totals.conversion}%`} />
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Last 6 months</h2>
        </div>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, n) => n === "revenue" ? [`$${v.toLocaleString()}`, "Revenue"] : [v, "Jobs"]}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown title="Jobs by status" data={countBy(jobs.map((j) => j.status))} />
        <Breakdown title="Leads by status" data={countBy(leads.map((l) => l.status))} />
      </div>
    </div>
  );
};

const countBy = (arr: string[]) => {
  const m: Record<string, number> = {};
  arr.forEach((s) => (m[s] = (m[s] ?? 0) + 1));
  return Object.entries(m).map(([label, value]) => ({ label, value }));
};

const Stat = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
    <div className="flex items-center justify-between">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
  </div>
);

const Breakdown = ({ title, data }: { title: string; data: { label: string; value: number }[] }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <div className="space-y-3">
          {data.map((d) => (
            <div key={d.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{d.label.replace("_", " ")}</span>
                <span className="text-muted-foreground">{d.value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-gradient-primary" style={{ width: `${(d.value / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Reports;
