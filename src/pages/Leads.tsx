import { useCallback, useEffect, useState } from "react";
import { Plus, Search, Sparkles, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { usePageParam } from "@/hooks/use-page-param";
import { DataPagination, PAGE_SIZE } from "@/components/DataPagination";
import { EmptyState } from "@/components/EmptyState";

type LeadStatus = "NEW" | "CONTACTED" | "QUALIFIED" | "CONVERTED" | "LOST";

interface Lead {
  id: string;
  name: string;
  source: string | null;
  status: LeadStatus;
  created_at: string;
}

const STATUSES: LeadStatus[] = ["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "LOST"];

const statusStyles: Record<LeadStatus, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  CONTACTED: "bg-accent text-accent-foreground",
  QUALIFIED: "bg-warning/15 text-warning",
  CONVERTED: "bg-success/15 text-success",
  LOST: "bg-destructive/10 text-destructive",
};

interface FormState { name: string; source: string; status: LeadStatus; }
const emptyForm: FormState = { name: "", source: "", status: "NEW" };

const Leads = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<string, number>>({ ALL: 0 });
  const [initialLoading, setInitialLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [page, setPage] = usePageParam();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const loadCounts = useCallback(async () => {
    const { data } = await supabase.from("leads").select("status");
    const c: Record<string, number> = { ALL: (data ?? []).length };
    STATUSES.forEach((s) => (c[s] = 0));
    (data ?? []).forEach((r: any) => (c[r.status] = (c[r.status] ?? 0) + 1));
    setCounts(c);
  }, []);

  const loadLeads = useCallback(async (isInitial: boolean) => {
    if (isInitial) setInitialLoading(true); else setPageLoading(true);
    let query = supabase.from("leads").select("*", { count: "exact" }).order("created_at", { ascending: false });
    if (statusFilter !== "ALL") query = query.eq("status", statusFilter);
    const q = debouncedSearch.trim();
    if (q) query = query.or(`name.ilike.%${q}%,source.ilike.%${q}%`);
    const from = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) toast({ title: "Failed to load leads", description: error.message, variant: "destructive" });
    else { setLeads((data ?? []) as Lead[]); setTotal(count ?? 0); }
    if (isInitial) setInitialLoading(false); else setPageLoading(false);
  }, [debouncedSearch, statusFilter, page]);

  useEffect(() => { if (page !== 1) setPage(1); /* eslint-disable-next-line */ }, [debouncedSearch, statusFilter]);
  useEffect(() => { loadLeads(initialLoading); /* eslint-disable-next-line */ }, [loadLeads]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  const openCreate = () => { setEditing(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (lead: Lead) => {
    setEditing(lead);
    setForm({ name: lead.name, source: lead.source ?? "", status: lead.status });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast({ title: "Name is required", variant: "destructive" });
    if (!user) return;
    setSaving(true);
    const { data: profile } = await supabase.from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile?.organization_id) { toast({ title: "No organization found", variant: "destructive" }); setSaving(false); return; }
    const payload = { name: form.name.trim(), source: form.source.trim() || null, status: form.status };
    let error;
    if (editing) ({ error } = await supabase.from("leads").update(payload).eq("id", editing.id));
    else ({ error } = await supabase.from("leads").insert({ ...payload, organization_id: profile.organization_id }));
    setSaving(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Lead updated" : "Lead created" });
    setDialogOpen(false);
    loadLeads(false);
    loadCounts();
  };

  const isFiltered = debouncedSearch.trim().length > 0 || statusFilter !== "ALL";
  const clearFilters = () => { setSearch(""); setStatusFilter("ALL"); };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">Capture and qualify every opportunity.</p>
        </div>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New lead</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or source" className="pl-9" />
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
        {initialLoading ? (
          <div className="space-y-2 p-6">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : leads.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No leads yet"
            description="Add your first lead to start tracking new opportunities."
            actionLabel="New lead"
            onAction={isFiltered ? clearFilters : openCreate}
            filtered={isFiltered}
            query={debouncedSearch}
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id} className="cursor-pointer" onClick={() => openEdit(lead)}>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell className="text-muted-foreground">{lead.source ?? "—"}</TableCell>
                    <TableCell>
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[lead.status])}>
                        {lead.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                    </TableCell>
                    <TableCell><Pencil className="h-3.5 w-3.5 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DataPagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} loading={pageLoading} />
          </>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader><DialogTitle>{editing ? "Edit lead" : "New lead"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Sarah Johnson" autoFocus />
            </div>
            <div className="space-y-2">
              <Label htmlFor="source">Source</Label>
              <Input id="source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="e.g. Google Ads, Referral, Website" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={form.status} onValueChange={(v: LeadStatus) => setForm({ ...form, status: v })}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Save changes" : "Create lead"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Leads;
