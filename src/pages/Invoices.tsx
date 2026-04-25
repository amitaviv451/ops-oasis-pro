import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Receipt, Pencil } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Status = "DRAFT" | "SENT" | "PAID" | "OVERDUE";
const STATUSES: Status[] = ["DRAFT", "SENT", "PAID", "OVERDUE"];

interface Invoice {
  id: string;
  customer_name: string | null;
  amount: number;
  status: Status;
  issued_at: string;
  paid_at: string | null;
}

const styles: Record<Status, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  SENT: "bg-accent text-accent-foreground",
  PAID: "bg-success/15 text-success",
  OVERDUE: "bg-destructive/10 text-destructive",
};

const empty = { customer_name: "", amount: "", status: "DRAFT" as Status };

const Invoices = () => {
  const orgId = useOrgId();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("invoices").select("*").order("issued_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Invoice[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((i) => {
    if (filter !== "ALL" && i.status !== filter) return false;
    if (!search.trim()) return true;
    return (i.customer_name ?? "").toLowerCase().includes(search.toLowerCase());
  }), [items, search, filter]);

  const totals = useMemo(() => ({
    paid: items.filter((i) => i.status === "PAID").reduce((s, i) => s + Number(i.amount), 0),
    outstanding: items.filter((i) => i.status === "SENT" || i.status === "OVERDUE").reduce((s, i) => s + Number(i.amount), 0),
    overdue: items.filter((i) => i.status === "OVERDUE").reduce((s, i) => s + Number(i.amount), 0),
  }), [items]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (i: Invoice) => {
    setEditing(i);
    setForm({ customer_name: i.customer_name ?? "", amount: String(i.amount), status: i.status });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    const payload = {
      customer_name: form.customer_name.trim() || null,
      amount: form.amount ? Number(form.amount) : 0,
      status: form.status,
      paid_at: form.status === "PAID" ? new Date().toISOString() : null,
    };
    const { error } = editing
      ? await supabase.from("invoices").update(payload).eq("id", editing.id)
      : await supabase.from("invoices").insert({ ...payload, organization_id: orgId });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Invoice updated" : "Invoice created" });
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">Bill customers and track what's been paid.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New invoice</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Paid" value={`$${totals.paid.toLocaleString()}`} />
        <Kpi label="Outstanding" value={`$${totals.outstanding.toLocaleString()}`} />
        <Kpi label="Overdue" value={`$${totals.overdue.toLocaleString()}`} accent="destructive" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by customer" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["ALL", ...STATUSES] as const).map((s) => (
            <button key={s} type="button" onClick={() => setFilter(s)}
              className={cn("rounded-full border border-border px-3 py-1 text-xs font-medium transition-colors",
                filter === s ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground hover:text-foreground")}>
              {s === "ALL" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><Receipt className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">{items.length === 0 ? "No invoices yet" : "No matches"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{items.length === 0 ? "Create your first invoice." : "Adjust your filters."}</p>
            {items.length === 0 && <Button onClick={openNew} className="mt-4 gap-2"><Plus className="h-4 w-4" /> New invoice</Button>}
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Customer</TableHead><TableHead>Issued</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="w-12"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => openEdit(i)}>
                  <TableCell className="font-medium">{i.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(i.issued_at), "MMM d, yyyy")}</TableCell>
                  <TableCell><span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", styles[i.status])}>{i.status}</span></TableCell>
                  <TableCell className="text-right font-mono text-sm">${Number(i.amount).toLocaleString()}</TableCell>
                  <TableCell><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Customer</Label><Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Amount ($)</Label><Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div className="space-y-2"><Label>Status</Label>
                <Select value={form.status} onValueChange={(v: Status) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create invoice"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Kpi = ({ label, value, accent }: { label: string; value: string; accent?: "destructive" }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-2xl font-bold tracking-tight", accent === "destructive" && "text-destructive")}>{value}</div>
  </div>
);

export default Invoices;
