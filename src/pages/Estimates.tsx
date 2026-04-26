import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, FileText, Send, Check, X, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { LineItemEditor, LineItem, blankItem, computeTotals } from "@/components/LineItemEditor";

// DB enum uses ACCEPTED in place of "APPROVED"
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
  tax_rate: number;
  created_at: string;
  organization_id: string;
}

const STATUSES: EstimateStatus[] = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"];

const statusStyles: Record<EstimateStatus, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  SENT: "bg-accent text-accent-foreground",
  ACCEPTED: "bg-success/15 text-success",
  DECLINED: "bg-destructive/10 text-destructive",
  EXPIRED: "bg-warning/15 text-warning",
};

const Estimates = () => {
  const orgId = useOrgId();
  const navigate = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | EstimateStatus>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Estimate | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "", customer_name: "", valid_until: "", notes: "", tax_rate: 0,
  });
  const [items, setItems] = useState<LineItem[]>([blankItem()]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("estimates").select("*").order("created_at", { ascending: false });
    if (error) toast({ title: "Failed to load estimates", description: error.message, variant: "destructive" });
    else setEstimates((data ?? []) as Estimate[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => estimates.filter((e) => {
    if (statusFilter !== "ALL" && e.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return e.title.toLowerCase().includes(q) || (e.customer_name ?? "").toLowerCase().includes(q) || String(e.estimate_number).includes(q);
  }), [estimates, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: estimates.length };
    STATUSES.forEach((s) => (c[s] = 0));
    estimates.forEach((e) => (c[e.status] = (c[e.status] ?? 0) + 1));
    return c;
  }, [estimates]);

  const totals = useMemo(() => ({
    accepted: estimates.filter((e) => e.status === "ACCEPTED").reduce((s, e) => s + Number(e.amount), 0),
    outstanding: estimates.filter((e) => e.status === "SENT").reduce((s, e) => s + Number(e.amount), 0),
  }), [estimates]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", customer_name: "", valid_until: "", notes: "", tax_rate: 0 });
    setItems([blankItem()]);
    setDialogOpen(true);
  };

  const openEdit = async (est: Estimate) => {
    setEditing(est);
    setForm({
      title: est.title,
      customer_name: est.customer_name ?? "",
      valid_until: est.valid_until ?? "",
      notes: est.notes ?? "",
      tax_rate: Number(est.tax_rate ?? 0),
    });
    const { data: lines } = await supabase
      .from("estimate_items").select("*").eq("estimate_id", est.id).order("position");
    setItems(((lines ?? []) as any[]).map((l) => ({
      id: l.id, description: l.description, quantity: Number(l.quantity),
      unit_price: Number(l.unit_price), total: Number(l.total),
    })));
    setDialogOpen(true);
  };

  const persistItems = async (estimateId: string, organization_id: string) => {
    await supabase.from("estimate_items").delete().eq("estimate_id", estimateId);
    if (items.length === 0) return;
    const rows = items.map((it, idx) => ({
      estimate_id: estimateId,
      organization_id,
      description: it.description || "Item",
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total: Number(it.total) || 0,
      position: idx,
    }));
    const { error } = await supabase.from("estimate_items").insert(rows);
    if (error) throw error;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    if (!orgId) { toast({ title: "No organization found", variant: "destructive" }); return; }
    setSaving(true);

    const { grandTotal } = computeTotals(items, form.tax_rate);
    const payload = {
      title: form.title.trim(),
      customer_name: form.customer_name.trim() || null,
      amount: grandTotal,
      tax_rate: form.tax_rate,
      valid_until: form.valid_until || null,
      notes: form.notes.trim() || null,
    };

    try {
      let estimateId: string;
      if (editing) {
        const { error } = await supabase.from("estimates").update(payload).eq("id", editing.id);
        if (error) throw error;
        estimateId = editing.id;
      } else {
        const { data, error } = await supabase.from("estimates").insert({ ...payload, organization_id: orgId }).select("id").single();
        if (error || !data) throw error;
        estimateId = data.id;
      }
      await persistItems(estimateId, orgId);
      toast({ title: editing ? "Estimate updated" : "Estimate created" });
      setDialogOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (est: Estimate, status: EstimateStatus) => {
    setActionPending(est.id);
    const { error } = await supabase.from("estimates").update({ status }).eq("id", est.id);
    setActionPending(null);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `Estimate ${status.toLowerCase()}` });
    load();
  };

  const convertToInvoice = async (est: Estimate) => {
    if (!orgId) return;
    setActionPending(est.id);
    try {
      // Load line items
      const { data: lines, error: linesErr } = await supabase
        .from("estimate_items").select("*").eq("estimate_id", est.id).order("position");
      if (linesErr) throw linesErr;
      const itemRows = (lines ?? []) as any[];

      // Create invoice
      const { data: inv, error: invErr } = await supabase.from("invoices").insert({
        organization_id: orgId,
        customer_name: est.customer_name,
        amount: est.amount,
        tax_rate: est.tax_rate,
        status: "DRAFT",
      } as any).select("id").single();
      if (invErr || !inv) throw invErr;

      // Copy line items
      if (itemRows.length > 0) {
        const invItems = itemRows.map((l, idx) => ({
          invoice_id: inv.id,
          organization_id: orgId,
          description: l.description,
          quantity: l.quantity,
          unit_price: l.unit_price,
          total: l.total,
          position: idx,
        }));
        const { error } = await supabase.from("invoice_items").insert(invItems);
        if (error) throw error;
      }

      toast({ title: `Invoice drafted from #${est.estimate_number}` });
      navigate("/invoices");
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Estimates</h1>
          <p className="text-sm text-muted-foreground">Send proposals and track which ones convert.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New estimate</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiTile label="Approved" value={`$${totals.accepted.toLocaleString()}`} hint={`${counts.ACCEPTED ?? 0} won`} />
        <KpiTile label="Outstanding" value={`$${totals.outstanding.toLocaleString()}`} hint={`${counts.SENT ?? 0} sent`} />
        <KpiTile label="Drafts" value={String(counts.DRAFT ?? 0)} hint="Not yet sent" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by title, customer, or #" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...STATUSES] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={cn("rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground")}>
              {s === "ALL" ? "All" : s} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><FileText className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">{estimates.length === 0 ? "No estimates yet" : "No estimates match"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{estimates.length === 0 ? "Draft your first proposal." : "Try a different filter."}</p>
            {estimates.length === 0 && <Button onClick={openCreate} className="mt-4 gap-2"><Plus className="h-4 w-4" /> New estimate</Button>}
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
                <TableHead className="w-[230px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((est) => (
                <TableRow key={est.id} className="cursor-pointer" onClick={() => openEdit(est)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{est.estimate_number}</TableCell>
                  <TableCell className="font-medium">{est.title}</TableCell>
                  <TableCell className="text-muted-foreground">{est.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{est.valid_until ? format(new Date(est.valid_until), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[est.status])}>
                      {est.status === "ACCEPTED" ? "APPROVED" : est.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">${Number(est.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {est.status === "DRAFT" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={actionPending === est.id} onClick={() => updateStatus(est, "SENT")}>
                          <Send className="h-3 w-3" /> Send
                        </Button>
                      )}
                      {est.status === "SENT" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={actionPending === est.id} onClick={() => updateStatus(est, "ACCEPTED")}>
                            <Check className="h-3 w-3" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive" disabled={actionPending === est.id} onClick={() => updateStatus(est, "DECLINED")}>
                            <X className="h-3 w-3" /> Decline
                          </Button>
                        </>
                      )}
                      {est.status === "ACCEPTED" && (
                        <Button size="sm" className="h-7 gap-1 px-2 text-xs" disabled={actionPending === est.id} onClick={() => convertToInvoice(est)}>
                          <ArrowRight className="h-3 w-3" /> Convert to Invoice
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit estimate #${editing.estimate_number}` : "New estimate"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Bathroom remodel — phase 1" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Input id="customer" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line items</Label>
              <LineItemEditor
                items={items}
                onChange={setItems}
                taxRate={form.tax_rate}
                onTaxRateChange={(n) => setForm({ ...form, tax_rate: n })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="valid">Valid until</Label>
                <Input id="valid" type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal notes or scope details" rows={3} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create estimate"}</Button>
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
