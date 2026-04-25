import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Briefcase, Pencil, Receipt } from "lucide-react";
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

type JobStatus = "NEW" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface Job {
  id: string;
  job_number: number;
  title: string;
  customer_name: string | null;
  status: JobStatus;
  scheduled_at: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  created_at: string;
}

const STATUSES: JobStatus[] = ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const statusStyles: Record<JobStatus, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  SCHEDULED: "bg-accent text-accent-foreground",
  IN_PROGRESS: "bg-warning/15 text-warning",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

interface FormState {
  title: string;
  customer_name: string;
  status: JobStatus;
  scheduled_at: string;
  estimated_cost: string;
  actual_cost: string;
}

const emptyForm: FormState = {
  title: "",
  customer_name: "",
  status: "NEW",
  scheduled_at: "",
  estimated_cost: "",
  actual_cost: "",
};

const Jobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | JobStatus>("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Job | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);

  const createInvoiceFromJob = async (job: Job) => {
    if (!user) return;
    setInvoicingId(job.id);
    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", user.id).single();
    if (!profile?.organization_id) {
      toast({ title: "No organization found", variant: "destructive" });
      setInvoicingId(null);
      return;
    }
    const amount = job.actual_cost ?? job.estimated_cost ?? 0;
    const { error } = await supabase.from("invoices").insert({
      organization_id: profile.organization_id,
      customer_name: job.customer_name,
      amount,
      status: "DRAFT",
    });
    setInvoicingId(null);
    if (error) {
      toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Invoice drafted for #${job.job_number}`, description: `$${Number(amount).toLocaleString()} — ${job.customer_name ?? "no customer"}` });
    navigate("/invoices");
  };

  const loadJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load jobs", description: error.message, variant: "destructive" });
    } else {
      setJobs((data ?? []) as Job[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadJobs();
  }, []);

  const filtered = useMemo(() => {
    return jobs.filter((j) => {
      if (statusFilter !== "ALL" && j.status !== statusFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        j.title.toLowerCase().includes(q) ||
        (j.customer_name ?? "").toLowerCase().includes(q) ||
        String(j.job_number).includes(q)
      );
    });
  }, [jobs, search, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (job: Job) => {
    setEditing(job);
    setForm({
      title: job.title,
      customer_name: job.customer_name ?? "",
      status: job.status,
      scheduled_at: job.scheduled_at ? job.scheduled_at.slice(0, 16) : "",
      estimated_cost: job.estimated_cost?.toString() ?? "",
      actual_cost: job.actual_cost?.toString() ?? "",
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

    // Resolve org_id via profile (RLS scopes to org)
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
      status: form.status,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      actual_cost: form.actual_cost ? Number(form.actual_cost) : null,
    };

    let error;
    if (editing) {
      ({ error } = await supabase.from("jobs").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("jobs")
        .insert({ ...payload, organization_id: profile.organization_id }));
    }

    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Job updated" : "Job created" });
    setDialogOpen(false);
    loadJobs();
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: jobs.length };
    STATUSES.forEach((s) => (c[s] = 0));
    jobs.forEach((j) => (c[j.status] = (c[j.status] ?? 0) + 1));
    return c;
  }, [jobs]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Jobs</h1>
          <p className="text-sm text-muted-foreground">Track every job from new to completed.</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> New job
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job, customer, or #"
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
              {s === "ALL" ? "All" : s.replace("_", " ")} <span className="ml-1 opacity-60">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card shadow-soft">
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
              <Briefcase className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {jobs.length === 0 ? "No jobs yet" : "No jobs match your filters"}
            </h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {jobs.length === 0
                ? "Create your first job to start tracking work."
                : "Try a different search term or status."}
            </p>
            {jobs.length === 0 && (
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="h-4 w-4" /> New job
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
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((job) => (
                <TableRow key={job.id} className="cursor-pointer" onClick={() => openEdit(job)}>
                  <TableCell className="font-mono text-xs text-muted-foreground">#{job.job_number}</TableCell>
                  <TableCell className="font-medium">{job.title}</TableCell>
                  <TableCell className="text-muted-foreground">{job.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {job.scheduled_at
                      ? new Date(job.scheduled_at).toLocaleString("en", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[job.status])}>
                      {job.status.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {job.estimated_cost != null ? `$${Number(job.estimated_cost).toLocaleString()}` : "—"}
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

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit job #${editing.job_number}` : "New job"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Replace water heater"
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
                <Label htmlFor="status">Status</Label>
                <Select value={form.status} onValueChange={(v: JobStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="scheduled">Scheduled at</Label>
                <Input
                  id="scheduled"
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="estimated">Estimated ($)</Label>
                <Input
                  id="estimated"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimated_cost}
                  onChange={(e) => setForm({ ...form, estimated_cost: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actual">Actual ($)</Label>
                <Input
                  id="actual"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actual_cost}
                  onChange={(e) => setForm({ ...form, actual_cost: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editing ? "Save changes" : "Create job"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Jobs;
