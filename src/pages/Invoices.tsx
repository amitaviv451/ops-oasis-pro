import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Receipt, Download, CheckCircle } from "lucide-react";
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
import { LineItemEditor, LineItem, blankItem, computeTotals } from "@/components/LineItemEditor";
import { downloadInvoicePdf } from "@/lib/invoicePdf";

type Status = "DRAFT" | "SENT" | "PAID" | "OVERDUE";
const STATUSES: Status[] = ["DRAFT", "SENT", "PAID", "OVERDUE"];

interface Invoice {
  id: string;
  customer_name: string | null;
  amount: number;
  status: Status;
  issued_at: string;
  paid_at: string | null;
  payment_amount: number | null;
  due_date: string | null;
  tax_rate: number;
  organization_id: string;
}

const styles: Record<Status, string> = {
  DRAFT: "bg-secondary text-secondary-foreground",
  SENT: "bg-accent text-accent-foreground",
  PAID: "bg-success/15 text-success",
  OVERDUE: "bg-destructive/10 text-destructive",
};

const Invoices = () => {
  const orgId = useOrgId();
  const [items, setItems] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | Status>("ALL");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("Your Company");

  const [form, setForm] = useState({
    customer_name: "", status: "DRAFT" as Status, due_date: "", tax_rate: 0,
  });
  const [lines, setLines] = useState<LineItem[]>([blankItem()]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("invoices").select("*").order("issued_at", { ascending: false });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Invoice[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!orgId) return;
    supabase.from("organizations").select("name").eq("id", orgId).single()
      .then(({ data }) => { if (data?.name) setOrgName(data.name); });
  }, [orgId]);

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

  const openNew = () => {
    setEditing(null);
    setForm({ customer_name: "", status: "DRAFT", due_date: "", tax_rate: 0 });
    setLines([blankItem()]);
    setOpen(true);
  };

  const openEdit = async (i: Invoice) => {
    setEditing(i);
    setForm({
      customer_name: i.customer_name ?? "",
      status: i.status,
      due_date: i.due_date ?? "",
      tax_rate: Number(i.tax_rate ?? 0),
    });
    const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", i.id).order("position");
    setLines(((data ?? []) as any[]).map((l) => ({
      id: l.id, description: l.description, quantity: Number(l.quantity),
      unit_price: Number(l.unit_price), total: Number(l.total),
    })));
    setOpen(true);
  };

  const persistItems = async (invoiceId: string, organization_id: string) => {
    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId);
    if (lines.length === 0) return;
    const rows = lines.map((it, idx) => ({
      invoice_id: invoiceId,
      organization_id,
      description: it.description || "Item",
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      total: Number(it.total) || 0,
      position: idx,
    }));
    const { error } = await supabase.from("invoice_items").insert(rows);
    if (error) throw error;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSaving(true);
    const { grandTotal } = computeTotals(lines, form.tax_rate);
    const payload: any = {
      customer_name: form.customer_name.trim() || null,
      amount: grandTotal,
      status: form.status,
      tax_rate: form.tax_rate,
      due_date: form.due_date || null,
      paid_at: form.status === "PAID" ? new Date().toISOString() : null,
    };
    try {
      let invoiceId: string;
      if (editing) {
        const { error } = await supabase.from("invoices").update(payload).eq("id", editing.id);
        if (error) throw error;
        invoiceId = editing.id;
      } else {
        const { data, error } = await supabase.from("invoices").insert({ ...payload, organization_id: orgId }).select("id").single();
        if (error || !data) throw error;
        invoiceId = data.id;
      }
      await persistItems(invoiceId, orgId);
      toast({ title: editing ? "Invoice updated" : "Invoice created" });
      setOpen(false);
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (inv: Invoice) => {
    setActionPending(inv.id);
    const { error } = await supabase.from("invoices").update({
      status: "PAID",
      paid_at: new Date().toISOString(),
      payment_amount: inv.amount,
    } as any).eq("id", inv.id);
    setActionPending(null);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Marked as paid" });
    load();
  };

  const downloadPdf = async (inv: Invoice) => {
    setActionPending(inv.id);
    try {
      const { data: rows } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("position");
      const itemRows = ((rows ?? []) as any[]).map((l) => ({
        description: l.description, quantity: Number(l.quantity),
        unit_price: Number(l.unit_price), total: Number(l.total),
      }));
      const taxRate = Number(inv.tax_rate ?? 0);
      const subtotal = itemRows.reduce((s, it) => s + it.total, 0);
      const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
      const total = subtotal + tax;
      const paid = Number(inv.payment_amount ?? (inv.status === "PAID" ? total : 0));
      const due = Math.max(0, total - paid);

      // Best-effort short id as the human invoice number
      await downloadInvoicePdf({
        companyName: orgName,
        invoiceNumber: inv.id.slice(0, 8).toUpperCase(),
        customerName: inv.customer_name ?? "—",
        issueDate: format(new Date(inv.issued_at), "MMM d, yyyy"),
        dueDate: inv.due_date ? format(new Date(inv.due_date), "MMM d, yyyy") : undefined,
        items: itemRows,
        subtotal, taxRate, tax, total,
        amountPaid: paid, amountDue: due,
      });
    } catch (err: any) {
      toast({ title: "PDF failed", description: err?.message ?? "Unknown error", variant: "destructive" });
    } finally {
      setActionPending(null);
    }
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
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[230px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => openEdit(i)}>
                  <TableCell className="font-medium">{i.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(i.issued_at), "MMM d, yyyy")}</TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", styles[i.status])}>{i.status}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">${Number(i.amount).toLocaleString()}</TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      {i.status === "SENT" && (
                        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs" disabled={actionPending === i.id} onClick={() => markPaid(i)}>
                          <CheckCircle className="h-3 w-3" /> Mark paid
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" disabled={actionPending === i.id} onClick={() => downloadPdf(i)}>
                        <Download className="h-3 w-3" /> PDF
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[760px] max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit invoice" : "New invoice"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cust">Customer</Label>
                <Input id="cust" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Customer name" autoFocus />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v: Status) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Line items</Label>
              <LineItemEditor
                items={lines}
                onChange={setLines}
                taxRate={form.tax_rate}
                onTaxRateChange={(n) => setForm({ ...form, tax_rate: n })}
                amountPaid={editing?.payment_amount ?? 0}
                showPaid={!!editing}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="due">Due date</Label>
                <Input id="due" type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
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
