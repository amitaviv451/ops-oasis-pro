import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Package, Pencil, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unit: string;
  reorder_point: number;
  unit_cost: number | null;
}

const empty = { name: "", sku: "", quantity: "0", unit: "ea", reorder_point: "0", unit_cost: "" };

const Inventory = () => {
  const orgId = useOrgId();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("inventory_items").select("*").order("name");
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Item[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((i) =>
    !search.trim() ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.sku ?? "").toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  const lowStock = useMemo(() => items.filter((i) => Number(i.quantity) <= Number(i.reorder_point)).length, [items]);
  const totalValue = useMemo(() => items.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_cost ?? 0), 0), [items]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (i: Item) => {
    setEditing(i);
    setForm({
      name: i.name, sku: i.sku ?? "", quantity: String(i.quantity), unit: i.unit,
      reorder_point: String(i.reorder_point), unit_cost: i.unit_cost?.toString() ?? "",
    });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (!orgId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      sku: form.sku.trim() || null,
      quantity: Number(form.quantity || 0),
      unit: form.unit.trim() || "ea",
      reorder_point: Number(form.reorder_point || 0),
      unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
    };
    const { error } = editing
      ? await supabase.from("inventory_items").update(payload).eq("id", editing.id)
      : await supabase.from("inventory_items").insert({ ...payload, organization_id: orgId });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Item updated" : "Item added" });
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">Track parts on hand and know when to reorder.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New item</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="SKUs" value={String(items.length)} />
        <Kpi label="Stock value" value={`$${totalValue.toLocaleString()}`} />
        <Kpi label="Low stock" value={String(lowStock)} accent={lowStock > 0 ? "warn" : undefined} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or SKU" className="pl-9" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><Package className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">{items.length === 0 ? "No inventory yet" : "No matches"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{items.length === 0 ? "Add parts to start tracking stock." : "Try a different search."}</p>
            {items.length === 0 && <Button onClick={openNew} className="mt-4 gap-2"><Plus className="h-4 w-4" /> New item</Button>}
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>SKU</TableHead><TableHead className="text-right">On hand</TableHead><TableHead className="text-right">Reorder at</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead className="w-12"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((i) => {
                const low = Number(i.quantity) <= Number(i.reorder_point);
                return (
                  <TableRow key={i.id} className="cursor-pointer" onClick={() => openEdit(i)}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{i.sku ?? "—"}</TableCell>
                    <TableCell className={cn("text-right font-mono text-sm", low && "text-destructive font-semibold")}>
                      {low && <AlertTriangle className="mr-1 inline h-3 w-3" />}
                      {Number(i.quantity)} {i.unit}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-muted-foreground">{Number(i.reorder_point)}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{i.unit_cost != null ? `$${Number(i.unit_cost).toLocaleString()}` : "—"}</TableCell>
                    <TableCell><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
              <div className="space-y-2"><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Unit</Label><Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="ea, ft, lb" /></div>
              <div className="space-y-2"><Label>Reorder at</Label><Input type="number" step="0.01" value={form.reorder_point} onChange={(e) => setForm({ ...form, reorder_point: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Unit cost ($)</Label><Input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create item"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Kpi = ({ label, value, accent }: { label: string; value: string; accent?: "warn" }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={cn("mt-1 text-2xl font-bold tracking-tight", accent === "warn" && "text-warning")}>{value}</div>
  </div>
);

export default Inventory;
