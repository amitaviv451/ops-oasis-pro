import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfDay, endOfDay, endOfWeek, startOfWeek } from "date-fns";
import {
  Briefcase, MapPin, CheckCircle2, Clock, User as UserIcon, LogOut, Loader2, Plus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserRole } from "@/lib/useUserRole";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type JobStatus = "NEW" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

interface Job {
  id: string;
  job_number: number;
  title: string;
  customer_name: string | null;
  address: string | null;
  status: JobStatus;
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  organization_id: string;
}

const statusBadge: Record<JobStatus, string> = {
  NEW: "bg-secondary text-secondary-foreground",
  SCHEDULED: "bg-accent text-accent-foreground",
  IN_PROGRESS: "bg-warning/15 text-warning",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-destructive/10 text-destructive",
};

const mapsUrl = (address: string) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const enc = encodeURIComponent(address);
  return isIOS ? `https://maps.apple.com/?address=${enc}` : `https://maps.google.com/?q=${enc}`;
};

type Tab = "today" | "all" | "profile";
type AllFilter = "today" | "week" | "all";

const FieldView = () => {
  const { user, signOut } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");
  const [allFilter, setAllFilter] = useState<AllFilter>("today");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user]);

  const loadJobs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("technician_id", user.id)
      .is("deleted_at", null)
      .order("scheduled_start", { ascending: true, nullsFirst: false });
    if (error) toast({ title: "Failed to load jobs", description: error.message, variant: "destructive" });
    else setJobs((data ?? []) as Job[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const todayJobs = useMemo(() => {
    const s = startOfDay(new Date()).getTime();
    const e = endOfDay(new Date()).getTime();
    return jobs.filter((j) => {
      if (!j.scheduled_start) return false;
      const t = new Date(j.scheduled_start).getTime();
      return t >= s && t <= e;
    });
  }, [jobs]);

  const filteredAll = useMemo(() => {
    if (allFilter === "all") return jobs;
    const now = new Date();
    if (allFilter === "today") {
      const s = startOfDay(now).getTime(), e = endOfDay(now).getTime();
      return jobs.filter((j) => j.scheduled_start && new Date(j.scheduled_start).getTime() >= s && new Date(j.scheduled_start).getTime() <= e);
    }
    const s = startOfWeek(now).getTime(), e = endOfWeek(now).getTime();
    return jobs.filter((j) => j.scheduled_start && new Date(j.scheduled_start).getTime() >= s && new Date(j.scheduled_start).getTime() <= e);
  }, [jobs, allFilter]);

  const updateStatus = async (job: Job, status: JobStatus, actualCost?: number) => {
    const patch: any = { status };
    if (typeof actualCost === "number") patch.actual_cost = actualCost;
    const { error } = await supabase.from("jobs").update(patch).eq("id", job.id);
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, ...patch } : j)));
    toast({ title: status === "IN_PROGRESS" ? "Marked on the way" : status === "COMPLETED" ? "Job completed" : "Updated" });
  };

  const list = tab === "today" ? todayJobs : filteredAll;

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <h1 className="text-lg font-bold tracking-tight">
          {tab === "today" ? "Today's jobs" : tab === "all" ? "All my jobs" : "Profile"}
        </h1>
      </header>

      <main className="px-4 py-4 space-y-3">
        {tab === "all" && (
          <div className="flex gap-1.5">
            {(["today", "week", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setAllFilter(f)}
                className={cn(
                  "h-10 flex-1 rounded-full border border-border px-3 text-sm font-medium transition-colors",
                  allFilter === f ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground"
                )}
              >
                {f === "today" ? "Today" : f === "week" ? "This Week" : "All"}
              </button>
            ))}
          </div>
        )}

        {tab === "profile" ? (
          <ProfileTab
            email={profile?.email ?? user?.email ?? ""}
            name={profile?.full_name ?? "—"}
            role={role ?? "TECHNICIAN"}
            onSignOut={async () => { await signOut(); navigate("/login"); }}
          />
        ) : loading || roleLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <Briefcase className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">No jobs to show</p>
            <p className="text-xs text-muted-foreground mt-1">
              {tab === "today" ? "Nothing scheduled for today." : "Try a different filter."}
            </p>
          </div>
        ) : (
          list.map((j) => (
            <JobCard
              key={j.id}
              job={j}
              expanded={expanded === j.id}
              onToggle={() => setExpanded(expanded === j.id ? null : j.id)}
              onStatusChange={updateStatus}
              userId={user?.id ?? ""}
            />
          ))
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-3 border-t border-border bg-background">
        <TabButton active={tab === "today"} onClick={() => setTab("today")} icon={<Clock className="h-5 w-5" />} label="Today" />
        <TabButton active={tab === "all"} onClick={() => setTab("all")} icon={<Briefcase className="h-5 w-5" />} label="My jobs" />
        <TabButton active={tab === "profile"} onClick={() => setTab("profile")} icon={<UserIcon className="h-5 w-5" />} label="Profile" />
      </nav>
    </div>
  );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium",
      active ? "text-primary" : "text-muted-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

interface JobNote {
  id: string;
  body: string;
  created_at: string;
  user_email: string | null;
}

const JobCard = ({
  job, expanded, onToggle, onStatusChange, userId,
}: {
  job: Job;
  expanded: boolean;
  onToggle: () => void;
  onStatusChange: (j: Job, s: JobStatus, cost?: number) => void;
  userId: string;
}) => {
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [actualCost, setActualCost] = useState<string>(job.estimated_cost ? String(job.estimated_cost) : "");
  const [showCostPrompt, setShowCostPrompt] = useState(false);
  const [pending, setPending] = useState(false);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    setNotesLoading(true);
    const { data } = await supabase
      .from("job_notes")
      .select("id, body, created_at, user_email")
      .eq("job_id", job.id)
      .order("created_at", { ascending: false });
    setNotes((data ?? []) as JobNote[]);
    setNotesLoading(false);
  }, [job.id]);

  useEffect(() => {
    if (expanded) fetchNotes();
  }, [expanded, fetchNotes]);

  const saveNote = async () => {
    if (!note.trim()) return;
    setSavingNote(true);
    const { error } = await supabase.from("job_notes").insert({
      job_id: job.id, organization_id: job.organization_id, body: note.trim(),
    });
    setSavingNote(false);
    if (error) return toast({ title: "Failed to save note", description: error.message, variant: "destructive" });
    setNote("");
    toast({ title: "Note added" });
    fetchNotes();
  };

  const onMyWay = async () => {
    setPending(true);
    await onStatusChange(job, "IN_PROGRESS");
    setPending(false);
  };

  const completeNow = async () => {
    setPending(true);
    await onStatusChange(job, "COMPLETED", actualCost ? Number(actualCost) : undefined);
    setPending(false);
    setShowCostPrompt(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-soft overflow-hidden">
      <button onClick={onToggle} className="w-full p-4 text-left active:bg-muted/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">#{job.job_number}</span>
              {job.scheduled_start && (
                <span>· {format(new Date(job.scheduled_start), "h:mm a")}</span>
              )}
            </div>
            <div className="mt-1 font-semibold leading-tight">{job.customer_name ?? job.title}</div>
            {job.address && <div className="mt-0.5 text-sm text-muted-foreground line-clamp-1">{job.address}</div>}
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", statusBadge[job.status])}>
              {job.status.replace("_", " ")}
            </span>
            {job.status === "COMPLETED" && <CheckCircle2 className="h-5 w-5 text-success" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/20">
          {job.address && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Address</div>
              <div className="mt-1 text-sm">{job.address}</div>
              <a
                href={mapsUrl(job.address)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex h-12 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium active:bg-muted"
              >
                <MapPin className="h-4 w-4" /> Open in Maps
              </a>
            </div>
          )}

          {(job.estimated_cost ?? null) !== null && (
            <div className="text-sm">
              <span className="text-muted-foreground">Estimated cost: </span>
              <span className="font-mono font-semibold">${Number(job.estimated_cost).toFixed(2)}</span>
            </div>
          )}

          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add note</div>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened on site?" rows={2} />
            <Button onClick={saveNote} disabled={!note.trim() || savingNote} variant="outline" className="h-12 w-full gap-2">
              <Plus className="h-4 w-4" /> {savingNote ? "Saving..." : "Add note"}
            </Button>
          </div>

          {job.status === "SCHEDULED" || job.status === "NEW" ? (
            <Button onClick={onMyWay} disabled={pending} className="h-12 w-full text-base font-semibold">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "On My Way"}
            </Button>
          ) : job.status === "IN_PROGRESS" ? (
            showCostPrompt ? (
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actual cost</div>
                <Input type="number" inputMode="decimal" value={actualCost} onChange={(e) => setActualCost(e.target.value)} placeholder="0.00" className="h-12 text-base" />
                <div className="flex gap-2">
                  <Button variant="outline" className="h-12 flex-1" onClick={() => setShowCostPrompt(false)}>Cancel</Button>
                  <Button onClick={completeNow} disabled={pending} className="h-12 flex-1 bg-success text-success-foreground hover:bg-success/90">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm"}
                  </Button>
                </div>
              </div>
            ) : (
              <Button onClick={() => setShowCostPrompt(true)} className="h-12 w-full bg-success text-success-foreground hover:bg-success/90 text-base font-semibold">
                Mark Complete
              </Button>
            )
          ) : job.status === "COMPLETED" ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-success/10 text-success px-4 py-3 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> Completed
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const ProfileTab = ({ email, name, role, onSignOut }: { email: string; name: string; role: string; onSignOut: () => void }) => (
  <div className="space-y-4">
    <div className="rounded-xl border border-border bg-card p-6 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-primary text-2xl font-bold text-primary-foreground">
        {(name?.[0] ?? email?.[0] ?? "T").toUpperCase()}
      </div>
      <div className="mt-3 text-lg font-semibold">{name}</div>
      <div className="text-sm text-muted-foreground">{email}</div>
      <div className="mt-2 inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-secondary-foreground">
        {role}
      </div>
    </div>
    <Button onClick={onSignOut} variant="outline" className="h-12 w-full gap-2">
      <LogOut className="h-4 w-4" /> Sign out
    </Button>
  </div>
);

export default FieldView;
