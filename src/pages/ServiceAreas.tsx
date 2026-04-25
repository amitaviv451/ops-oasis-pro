import { useEffect, useMemo, useState } from "react";
import { Plus, MapPin, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface Area {
  id: string;
  name: string;
  zip_codes: string | null;
  notes: string | null;
}

const empty = { name: "", zip_codes: "", notes: "" };

const ServiceAreas = () => {
  const orgId = useOrgId();
  const [items, setItems] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("service_areas").select("*").order("name");
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else setItems((data ?? []) as Area[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const totalZips = useMemo(() => items.reduce((s, a) => s + (a.zip_codes?.split(/[\s,]+/).filter(Boolean).length ?? 0), 0), [items]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (a: Area) => {
    setEditing(a);
    setForm({ name: a.name, zip_codes: a.zip_codes ?? "", notes: a.notes ?? "" });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (!orgId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      zip_codes: form.zip_codes.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("service_areas").update(payload).eq("id", editing.id)
      : await supabase.from("service_areas").insert({ ...payload, organization_id: orgId });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Area updated" : "Area added" });
    setOpen(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Areas</h1>
          <p className="text-sm text-muted-foreground">Define the regions and ZIPs you cover.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New area</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Areas</div>
          <div className="mt-1 text-2xl font-bold">{items.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">ZIP codes covered</div>
          <div className="mt-1 text-2xl font-bold">{totalZips}</div>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center shadow-soft">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground"><MapPin className="h-5 w-5" /></div>
          <h2 className="mt-4 text-lg font-semibold">No service areas yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">Add the regions you serve to keep dispatch organized.</p>
          <Button onClick={openNew} className="mt-4 gap-2"><Plus className="h-4 w-4" /> New area</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((a) => (
            <button key={a.id} onClick={() => openEdit(a)} className="group rounded-xl border border-border bg-card p-4 text-left shadow-soft transition-colors hover:border-primary/40">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-accent-foreground"><MapPin className="h-4 w-4" /></div>
                  <h3 className="font-semibold">{a.name}</h3>
                </div>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              {a.zip_codes && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {a.zip_codes.split(/[\s,]+/).filter(Boolean).slice(0, 8).map((z) => (
                    <span key={z} className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-secondary-foreground">{z}</span>
                  ))}
                </div>
              )}
              {a.notes && <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{a.notes}</p>}
            </button>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editing ? "Edit area" : "New service area"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. North Brooklyn" autoFocus /></div>
            <div className="space-y-2">
              <Label>ZIP codes</Label>
              <Input value={form.zip_codes} onChange={(e) => setForm({ ...form, zip_codes: e.target.value })} placeholder="11201, 11211, 11222" />
              <p className="text-xs text-muted-foreground">Separate with commas or spaces.</p>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create area"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ServiceAreas;
