import { useEffect, useMemo, useState } from "react";
import { format, addDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Clock, User, CalendarRange } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
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
}

const STATUSES: JobStatus[] = ["NEW", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const statusStyles: Record<JobStatus, string> = {
  NEW: "bg-secondary text-secondary-foreground border-border",
  SCHEDULED: "bg-accent text-accent-foreground border-accent",
  IN_PROGRESS: "bg-warning/15 text-warning border-warning/30",
  COMPLETED: "bg-success/15 text-success border-success/30",
  CANCELLED: "bg-destructive/10 text-destructive border-destructive/30",
};

// 7am – 7pm
const HOURS = Array.from({ length: 13 }, (_, i) => i + 7);

const Dispatch = () => {
  const [date, setDate] = useState<Date>(new Date());
  const [jobs, setJobs] = useState<Job[]>([]);
  const [unscheduled, setUnscheduled] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async (d: Date) => {
    setLoading(true);
    const start = startOfDay(d).toISOString();
    const end = endOfDay(d).toISOString();

    const [scheduledRes, unschedRes] = await Promise.all([
      supabase
        .from("jobs")
        .select("id, job_number, title, customer_name, status, scheduled_at, estimated_cost")
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true }),
      supabase
        .from("jobs")
        .select("id, job_number, title, customer_name, status, scheduled_at, estimated_cost")
        .is("scheduled_at", null)
        .in("status", ["NEW", "SCHEDULED"])
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    if (scheduledRes.error) {
      toast({ title: "Failed to load schedule", description: scheduledRes.error.message, variant: "destructive" });
    } else {
      setJobs((scheduledRes.data ?? []) as Job[]);
    }
    if (!unschedRes.error) setUnscheduled((unschedRes.data ?? []) as Job[]);
    setLoading(false);
  };

  useEffect(() => {
    load(date);
  }, [date]);

  const byHour = useMemo(() => {
    const map: Record<number, Job[]> = {};
    HOURS.forEach((h) => (map[h] = []));
    const overflow: Job[] = [];
    jobs.forEach((j) => {
      if (!j.scheduled_at) return;
      const h = new Date(j.scheduled_at).getHours();
      if (map[h]) map[h].push(j);
      else overflow.push(j);
    });
    return { map, overflow };
  }, [jobs]);

  const updateStatus = async (job: Job, status: JobStatus) => {
    const prev = jobs;
    setJobs((js) => js.map((j) => (j.id === job.id ? { ...j, status } : j)));
    const { error } = await supabase.from("jobs").update({ status }).eq("id", job.id);
    if (error) {
      setJobs(prev);
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    }
  };

  const scheduleJob = async (job: Job, when: Date) => {
    const { error } = await supabase
      .from("jobs")
      .update({ scheduled_at: when.toISOString(), status: job.status === "NEW" ? "SCHEDULED" : job.status })
      .eq("id", job.id);
    if (error) {
      toast({ title: "Schedule failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `Scheduled #${job.job_number}` });
      load(date);
    }
  };

  const isToday = isSameDay(date, new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">Plan the day. Drop unscheduled jobs into a time slot.</p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="min-w-[180px] justify-start gap-2 font-medium">
                <CalendarIcon className="h-4 w-4" />
                {isToday ? "Today · " : ""}{format(date, "EEE, MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => d && setDate(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {!isToday && (
            <Button variant="ghost" size="sm" onClick={() => setDate(new Date())}>Today</Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Schedule column */}
        <div className="rounded-xl border border-border bg-card shadow-soft">
          {loading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {HOURS.map((h) => {
                const slot = byHour.map[h];
                return (
                  <div key={h} className="grid grid-cols-[80px_1fr] gap-4 px-4 py-3">
                    <div className="pt-1 text-xs font-mono text-muted-foreground">
                      {format(new Date().setHours(h, 0, 0, 0), "h a")}
                    </div>
                    <div className="space-y-2">
                      {slot.length === 0 ? (
                        <div className="h-10 rounded-md border border-dashed border-border/60" />
                      ) : (
                        slot.map((job) => (
                          <JobCard key={job.id} job={job} onStatus={updateStatus} />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
              {byHour.overflow.length > 0 && (
                <div className="px-4 py-3">
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Outside business hours</div>
                  <div className="space-y-2">
                    {byHour.overflow.map((job) => (
                      <JobCard key={job.id} job={job} onStatus={updateStatus} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Unscheduled column */}
        <aside className="rounded-xl border border-border bg-card shadow-soft">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Unscheduled</h2>
            <p className="text-xs text-muted-foreground">
              {unscheduled.length === 0 ? "All caught up" : `${unscheduled.length} waiting`}
            </p>
          </div>
          <div className="max-h-[600px] space-y-2 overflow-y-auto p-3">
            {unscheduled.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <CalendarRange className="h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-xs text-muted-foreground">No unscheduled jobs</p>
              </div>
            ) : (
              unscheduled.map((job) => (
                <UnscheduledCard key={job.id} job={job} onSchedule={(hour) => {
                  const d = new Date(date);
                  d.setHours(hour, 0, 0, 0);
                  scheduleJob(job, d);
                }} />
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

const JobCard = ({ job, onStatus }: { job: Job; onStatus: (j: Job, s: JobStatus) => void }) => {
  return (
    <div className={cn("rounded-lg border p-3 shadow-soft", statusStyles[job.status])}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono opacity-70">
            #{job.job_number}
            {job.scheduled_at && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {format(new Date(job.scheduled_at), "h:mm a")}
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">{job.title}</div>
          {job.customer_name && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" /> {job.customer_name}
            </div>
          )}
        </div>
        <Select value={job.status} onValueChange={(v: JobStatus) => onStatus(job, v)}>
          <SelectTrigger className="h-7 w-[130px] text-[10px] font-semibold uppercase tracking-wide" onClick={(e) => e.stopPropagation()}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

const UnscheduledCard = ({ job, onSchedule }: { job: Job; onSchedule: (hour: number) => void }) => {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">#{job.job_number}</div>
      <div className="mt-0.5 truncate text-sm font-semibold">{job.title}</div>
      {job.customer_name && (
        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" /> {job.customer_name}
        </div>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Select onValueChange={(v) => onSchedule(Number(v))}>
          <SelectTrigger className="h-7 text-xs">
            <SelectValue placeholder="Schedule at..." />
          </SelectTrigger>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={String(h)} className="text-xs">
                {format(new Date().setHours(h, 0, 0, 0), "h:00 a")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

export default Dispatch;
