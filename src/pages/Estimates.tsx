import { useEffect, useMemo, useState } from "react";
import { Plus, Search, FileText, Pencil } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type EstimateStatus = "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";

interface Estimate {
  id: string;
  estimate_number: number;
  title: string;
  customer_name: string | null;
  amount: number;
  status: EstimateStatus;
  valid_until: string | null;
  notes: string | null;
  created_at: string;
}

const STATUSES: EstimateStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"];

const statusStyles: Record<EstimateStatus, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  SENT: "bg-accent text-accent-foreground",
  ACCEPTED: "bg-success/15 text-success",
  DECLINED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-warning/15 text-warning",
};

interface FormState {
  title: string;
  customer_name: string;
  amount: string;
  status: EstimateStatus;
  valid_until: string;
  notes: string;
}

const emptyForm: FormState = {
  title: "",
  customer_name: "",
  amount: "",
  status: "DRAFT",
  valid_until: "",
  notes: "",
};

const Estimates = () => {
  const { user } = useAuth();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | EstimateStatus>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("estimates")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load estimates", description: error.message, variant: "destructive" });
    } else {
      setEstimates((data ?? []) as Estimate[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    return estimates.filter((e) => {
      if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        e.title.toLowerCase().includes(q) ||
        (e.customer_name ?? "").toLowerCase().includes(q) ||
        String(e.estimate_number).includes(q)
      );
    });
  }, [estimates, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: estimates.length };
    STATUSES.forEach((s) => (c[s] = 0));
    estimates.forEach((e) => (c[e.status] = (c[e.status] ?? 0) + 1));
    return c;
  }, [estimates]);

  const totals = useMemo(() => {
    const accepted = estimates.filter((e) => e.status === "ACCEPTED").reduce((s, e) => s + Number(e.amount), 0);
    const outstanding = estimates.filter((e) => e.status === "SENT").reduce((s, e) => s + Number(e.amount), 0);
    return { accepted, outstanding };
  }, [estimates]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (est: Estimate) => {
    setEditing(est);
    setForm({
      title: est.title,
      customer_name: est.customer_name ?? "",
      amount: est.amount?.toString() ?? "",
      status: est.status,
      valid_until: est.valid_until ?? "",
      notes: est.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    if (!user) return;
    setSaving(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id) {
      toast({ title: "No organization found", variant: "destructive" });
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title.trim(),
      customer_name: form.customer_name.trim() || null,
      amount: form.amount ? Number(form.amount) : 0,
      status: form.status,
      valid_until: form.valid_until || null,
      notes: form.notes.trim() || null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("estimates").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("estimates")
        .insert({ ...payload, organization_id: profile.organization_id }));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Estimate updated" : "Estimate created" });
    setDialogOpen(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estimates</h1>
          <p className="text-sm text-muted-foreground">Send proposals and track which ones convert.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New estimate
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile label="Accepted" value={`$${totals.accepted.toLocaleString()}`} hint={`${counts.ACCEPTED ?? 0} won`} />
        <KpiTile label="Outstanding" value={`$${totals.outstanding.toLocaleString()}`} hint={`${counts.SENT ?? 0} sent`} />
        <KpiTile label="Drafts" value={String(counts.DRAFT ?? 0)} hint="Not yet sent" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, customer, or #"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...STATUSES] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s === "ALL" ? "All" : s} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <FileText className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {estimates.length === 0 ? "No estimates yet" : "No estimates match your filters"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {estimates.length === 0
                ? "Draft your first proposal to start tracking conversions."
                : "Try a different search term or status."}
            </p>
            {estimates.length === 0 && (
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> New estimate
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">#</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Valid until</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((est) => (
                <TableRow key={est.id} className="cursor-pointer" onClick={() => openEdit(est)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{est.estimate_number}</TableCell>
                  <TableCell className="font-medium">{est.title}</TableCell>
                  <TableCell className="text-muted-foreground">{est.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {est.valid_until ? format(new Date(est.valid_until), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[est.status])}>
                      {est.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    ${Number(est.amount).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit estimate #${editing.estimate_number}` : "New estimate"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Bathroom remodel — phase 1"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer">Customer</Label>
              <Input
                id="customer"
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="Customer name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v: EstimateStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="valid">Valid until</Label>
              <Input
                id="valid"
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Internal notes or scope details"
                rows={3}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save changes" : "Create estimate"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const KpiTile = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
    <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
  </div>
);

export default Estimates;
