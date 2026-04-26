import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, Calendar, User, MapPin, Wrench,
  DollarSign, Receipt, MessageSquare, Clock, Save, X, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type JobStatus = "NEW" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Priority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

interface Job {
  id: string;
  job_number: number;
  title: string;
  customer_name: string | null;
  status: JobStatus;
  priority: string;
  scheduled_at: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  assigned_technician: string | null;
  service_type: string | null;
  address: string | null;
  created_at: string;
  organization_id: string;
}

interface JobNote {
  id: string;
  body: string;
  user_email: string | null;
  created_at: string;
}

interface TimelineEntry {
  id: string;
  from_status: JobStatus | null;
  to_status: JobStatus;
  changed_by: string | null;
  changed_at: string;
}

interface Invoice {
  id: string;
  amount: number;
  status: string;
  issued_at: string;
}

const STATUSES: JobStatus[] = ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const PRIORITIES: Priority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

const statusStyles: Record<JobStatus, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  SCHEDULED: "bg-accent text-accent-foreground",
  IN_PROGRESS: "bg-warning/15 text-warning",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const priorityStyles: Record<string, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-secondary text-secondary-foreground",
  HIGH: "bg-warning/15 text-warning",
  URGENT: "bg-destructive/15 text-destructive",
};

const formatDateTime = (s: string | null) =>
  s ? new Date(s).toLocaleString("en", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

const JobDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "", customer_name: "", status: "NEW" as JobStatus, priority: "NORMAL",
    scheduled_at: "", estimated_cost: "", assigned_technician: "",
    service_type: "", address: "",
  });

  const [editingActual, setEditingActual] = useState(false);
  const [actualDraft, setActualDraft] = useState("");
  const [savingActual, setSavingActual] = useState(false);

  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [{ data: j, error: je }, { data: n }, { data: t }, { data: inv }] = await Promise.all([
      supabase.from("jobs").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
      supabase.from("job_notes").select("*").eq("job_id", id).order("created_at", { ascending: false }),
      supabase.from("job_timeline").select("*").eq("job_id", id).order("changed_at", { ascending: false }),
      supabase.from("invoices").select("id, amount, status, issued_at").eq("job_id", id).order("issued_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (je || !j) {
      toast({ title: "Job not found", variant: "destructive" });
      navigate("/jobs");
      return;
    }
    setJob(j as Job);
    setNotes((n ?? []) as JobNote[]);
    setTimeline((t ?? []) as TimelineEntry[]);
    setInvoice((inv ?? null) as Invoice | null);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const openEdit = () => {
    if (!job) return;
    setEditForm({
      title: job.title,
      customer_name: job.customer_name ?? "",
      status: job.status,
      priority: job.priority ?? "NORMAL",
      scheduled_at: job.scheduled_at ? job.scheduled_at.slice(0, 16) : "",
      estimated_cost: job.estimated_cost?.toString() ?? "",
      assigned_technician: job.assigned_technician ?? "",
      service_type: job.service_type ?? "",
      address: job.address ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !editForm.title.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("jobs").update({
      title: editForm.title.trim(),
      customer_name: editForm.customer_name.trim() || null,
      status: editForm.status,
      priority: editForm.priority,
      scheduled_at: editForm.scheduled_at ? new Date(editForm.scheduled_at).toISOString() : null,
      estimated_cost: editForm.estimated_cost ? Number(editForm.estimated_cost) : null,
      assigned_technician: editForm.assigned_technician.trim() || null,
      service_type: editForm.service_type.trim() || null,
      address: editForm.address.trim() || null,
    }).eq("id", job.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Job updated" });
    setEditOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!job) return;
    const { error } = await supabase.from("jobs").update({ deleted_at: new Date().toISOString() }).eq("id", job.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Job #${job.job_number} deleted` });
    navigate("/jobs");
  };

  const saveActual = async () => {
    if (!job) return;
    setSavingActual(true);
    const value = actualDraft ? Number(actualDraft) : null;
    const { error } = await supabase.from("jobs").update({ actual_cost: value }).eq("id", job.id);
    setSavingActual(false);
    if (error) {
      toast({ title: "Failed to update", description: error.message, variant: "destructive" });
      return;
    }
    setEditingActual(false);
    toast({ title: "Actual cost updated" });
    load();
  };

  const addNote = async () => {
    if (!job || !newNote.trim() || !user) return;
    setAddingNote(true);
    const { error } = await supabase.from("job_notes").insert({
      job_id: job.id,
      organization_id: job.organization_id,
      body: newNote.trim(),
      user_email: user.email ?? null,
    });
    setAddingNote(false);
    if (error) {
      toast({ title: "Failed to add note", description: error.message, variant: "destructive" });
      return;
    }
    setNewNote("");
    load();
  };

  const generateInvoice = async () => {
    if (!job) return;
    setGeneratingInvoice(true);
    const amount = job.actual_cost ?? job.estimated_cost ?? 0;
    const { error } = await supabase.from("invoices").insert({
      organization_id: job.organization_id,
      customer_name: job.customer_name,
      amount,
      status: "DRAFT",
      job_id: job.id,
    } as any);
    setGeneratingInvoice(false);
    if (error) {
      toast({ title: "Failed to create invoice", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Invoice drafted" });
    load();
  };

  const canEditActual = useMemo(
    () => job?.status === "IN_PROGRESS" || job?.status === "COMPLETED",
    [job?.status],
  );

  if (loading || !job) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to jobs
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
              #{job.job_number}
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{job.title}</h1>
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusStyles[job.status])}>
                {job.status.replace("_", " ")}
              </span>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", priorityStyles[job.priority] ?? priorityStyles.NORMAL)}>
                {job.priority ?? "NORMAL"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEdit} className="gap-1.5">
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)} className="gap-1.5">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <InfoCard icon={<User className="h-4 w-4" />} label="Customer" value={job.customer_name ?? "—"} />
        <InfoCard icon={<Calendar className="h-4 w-4" />} label="Scheduled" value={formatDateTime(job.scheduled_at)} />
        <InfoCard icon={<Wrench className="h-4 w-4" />} label="Technician" value={job.assigned_technician ?? "—"} />
        <InfoCard icon={<Wrench className="h-4 w-4" />} label="Service type" value={job.service_type ?? "—"} />
        <InfoCard icon={<MapPin className="h-4 w-4" />} label="Address" value={job.address ?? "—"} />
      </div>

      {/* Cost + Invoice row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cost card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" /> Cost</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Estimated</span>
              <span className="font-mono text-sm">
                {job.estimated_cost != null ? `$${Number(job.estimated_cost).toLocaleString()}` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Actual</span>
              {editingActual ? (
                <div className="flex items-center gap-1.5">
                  <Input
                    type="number" min="0" step="0.01" autoFocus
                    value={actualDraft}
                    onChange={(e) => setActualDraft(e.target.value)}
                    className="h-8 w-28"
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" disabled={savingActual} onClick={saveActual}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setEditingActual(false)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm">
                    {job.actual_cost != null ? `$${Number(job.actual_cost).toLocaleString()}` : "—"}
                  </span>
                  {canEditActual && (
                    <Button
                      size="sm" variant="ghost" className="h-7 w-7 p-0"
                      onClick={() => { setActualDraft(job.actual_cost?.toString() ?? ""); setEditingActual(true); }}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {!canEditActual && (
              <p className="text-xs text-muted-foreground">Actual cost is editable while job is in progress or completed.</p>
            )}
          </CardContent>
        </Card>

        {/* Invoice card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Receipt className="h-4 w-4" /> Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            {invoice ? (
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm">
                    Status: <span className="font-medium">{invoice.status}</span>
                  </div>
                  <div className="font-mono text-sm text-muted-foreground">
                    ${Number(invoice.amount).toLocaleString()}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate("/invoices")}>
                  View
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">No invoice yet for this job.</p>
                <Button size="sm" onClick={generateInvoice} disabled={generatingInvoice} className="gap-1.5">
                  <Receipt className="h-4 w-4" /> {generatingInvoice ? "..." : "Generate Invoice"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="notes" className="w-full">
        <TabsList>
          <TabsTrigger value="notes" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Notes</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Clock className="h-3.5 w-3.5" /> Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm" onClick={addNote} disabled={addingNote || !newNote.trim()} className="gap-1.5">
                  <Plus className="h-4 w-4" /> {addingNote ? "Adding..." : "Add note"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {notes.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border border-border bg-card p-3 shadow-soft">
                  <p className="whitespace-pre-wrap text-sm">{n.body}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{n.user_email ?? "Unknown"}</span>
                    <span>•</span>
                    <span>{formatDateTime(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="timeline">
          {timeline.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">No status changes yet.</p>
          ) : (
            <div className="space-y-2">
              {timeline.map((e) => (
                <div key={e.id} className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-soft">
                  <div className="flex items-center gap-2 text-sm">
                    {e.from_status ? (
                      <>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusStyles[e.from_status])}>
                          {e.from_status.replace("_", " ")}
                        </span>
                        <span className="text-muted-foreground">→</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Created as</span>
                    )}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusStyles[e.to_status])}>
                      {e.to_status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {e.changed_by ?? "system"} • {formatDateTime(e.changed_at)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit job #{job.job_number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="customer">Customer</Label>
                <Input id="customer" value={editForm.customer_name} onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tech">Technician</Label>
                <Input id="tech" value={editForm.assigned_technician} onChange={(e) => setEditForm({ ...editForm, assigned_technician: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={editForm.status} onValueChange={(v: JobStatus) => setEditForm({ ...editForm, status: v })}>
                  <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                  <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="scheduled">Scheduled at</Label>
                <Input id="scheduled" type="datetime-local" value={editForm.scheduled_at} onChange={(e) => setEditForm({ ...editForm, scheduled_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estimated">Estimated ($)</Label>
                <Input id="estimated" type="number" min="0" step="0.01" value={editForm.estimated_cost} onChange={(e) => setEditForm({ ...editForm, estimated_cost: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="service">Service type</Label>
                <Input id="service" value={editForm.service_type} onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job #{job.job_number}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the job from all lists. You can recover it from the database if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

const InfoCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) => (
  <div className="rounded-xl border border-border bg-card p-4 shadow-soft">
    <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
      {icon} {label}
    </div>
    <div className="mt-1.5 text-sm font-medium">{value}</div>
  </div>
);

export default JobDetail;
