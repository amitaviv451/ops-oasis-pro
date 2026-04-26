import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Users, Pencil, Mail, Phone, MapPin } from "lucide-react";
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
import { useDebounce } from "@/hooks/use-debounce";
import { usePageParam } from "@/hooks/use-page-param";
import { DataPagination, PAGE_SIZE } from "@/components/DataPagination";
import { EmptyState } from "@/components/EmptyState";

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

const empty = { name: "", email: "", phone: "", address: "", notes: "" };

const Customers = () => {
  const orgId = useOrgId();
  const [items, setItems] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = usePageParam();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isInitial: boolean) => {
    if (isInitial) setInitialLoading(true); else setPageLoading(true);
    let query = supabase.from("customers").select("*", { count: "exact" }).order("created_at", { ascending: false });
    const q = debouncedSearch.trim();
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await query.range(from, to);
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    else { setItems((data ?? []) as Customer[]); setTotal(count ?? 0); }
    if (isInitial) setInitialLoading(false); else setPageLoading(false);
  }, [debouncedSearch, page]);

  // Reset to page 1 when search changes
  useEffect(() => { if (page !== 1) setPage(1); /* eslint-disable-next-line */ }, [debouncedSearch]);
  useEffect(() => { load(items.length === 0 && total === 0); /* eslint-disable-next-line */ }, [load]);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, email: c.email ?? "", phone: c.phone ?? "", address: c.address ?? "", notes: c.notes ?? "" });
    setOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (!orgId) return;
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("customers").update(payload).eq("id", editing.id)
      : await supabase.from("customers").insert({ ...payload, organization_id: orgId });
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Customer updated" : "Customer added" });
    setOpen(false);
    load(false);
  };

  const isFiltered = debouncedSearch.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Your contact list — searchable, organized.</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="h-4 w-4" /> New customer</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, phone" className="pl-9" />
      </div>

      <div className="rounded-xl border border-border bg-card shadow-soft">
        {initialLoading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No customers yet"
            description="Add your first customer to get started."
            actionLabel="New customer"
            onAction={isFiltered ? () => setSearch("") : openNew}
            filtered={isFiltered}
            query={debouncedSearch}
          />
        ) : (
          <>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Phone</TableHead><TableHead>Address</TableHead><TableHead className="w-12"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {items.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => openEdit(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ? <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span> : "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span> : "—"}</TableCell>
                    <TableCell className="max-w-[260px] truncate text-muted-foreground">{c.address ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.address}</span> : "—"}</TableCell>
                    <TableCell><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} loading={pageLoading} />
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader><DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div className="space-y-2"><Label>Notes</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create customer"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Customers;
