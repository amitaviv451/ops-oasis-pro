import { useEffect, useMemo, useState } from "react";
import { Plus, Search, BookOpen, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";

interface Item {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit_price: number;
  taxable: boolean;
}

const empty = { name: "", description: "", category: "", unit_price: "", taxable: true };

const PriceBook = () => {
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
    const { data, error } = await supabase.from("price_book_items").select("*").order("name");
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Item[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => items.filter((i) =>
    !search.trim() ||
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    (i.category ?? "").toLowerCase().includes(search.toLowerCase())
  ), [items, search]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (i: Item) => {
    setEditing(i);
    setForm({ name: i.name, description: i.description ?? "", category: i.category ?? "", unit_price: String(i.unit_price), taxable: i.taxable });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (!orgId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      category: form.category.trim() || null,
      unit_price: form.unit_price ? Number(form.unit_price) : 0,
      taxable: form.taxable,
    };
    const { error } = editing
      ? await supabase.from("price_book_items").update(payload).eq("id", editing.id)
      : await supabase.from("price_book_items").insert({ ...payload, organization_id: orgId });
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
          <h1 className="text-2xl font-bold tracking-tight">Price Book</h1>
          <p className="text-sm text-muted-foreground">Reusable services and parts with set pricing.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New item</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items or categories" className="pl-9" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><BookOpen className="h-5 w-5" /></div>
            <h2 className="mt-4 text-lg font-semibold">{items.length === 0 ? "Your price book is empty" : "No matches"}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{items.length === 0 ? "Add services and parts to speed up estimates." : "Try a different search."}</p>
            {items.length === 0 && <Button onClick={openNew} className="mt-4 gap-2"><Plus className="h-4 w-4" /> New item</Button>}
          </div>
        ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Tax</TableHead><TableHead className="text-right">Price</TableHead><TableHead className="w-12"></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map((i) => (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => openEdit(i)}>
                  <TableCell>
                    <div className="font-medium">{i.name}</div>
                    {i.description && <div className="text-xs text-muted-foreground">{i.description}</div>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{i.category ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.taxable ? "Taxable" : "Exempt"}</TableCell>
                  <TableCell className="text-right font-mono">${Number(i.unit_price).toLocaleString()}</TableCell>
                  <TableCell><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editing ? "Edit item" : "New item"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus placeholder="e.g. Service call — diagnostic" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Plumbing, HVAC..." /></div>
              <div className="space-y-2"><Label>Price ($)</Label><Input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div><Label className="text-sm">Taxable</Label><p className="text-xs text-muted-foreground">Apply tax when used on estimates and invoices.</p></div>
              <Switch checked={form.taxable} onCheckedChange={(v) => setForm({ ...form, taxable: v })} />
            </div>
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

export default PriceBook;
