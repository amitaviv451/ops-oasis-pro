import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDays, format, isSameDay, startOfDay } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, GripVertical, Clock } from "lucide-react";
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useDraggable, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
  scheduled_start: string | null;
  scheduled_end: string | null;
  estimated_duration_minutes: number | null;
  technician_id: string | null;
}

interface Tech {
  id: string;
  full_name: string | null;
  email: string | null;
}

const START_HOUR = 7;
const END_HOUR = 19; // exclusive — last block is 18:00–19:00
const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const SLOT_WIDTH = 96;
const ROW_HEIGHT = 72;
const TECH_COL_WIDTH = 192;

const statusBlock: Record<JobStatus, string> = {
  NEW: "bg-secondary text-secondary-foreground border-secondary",
  SCHEDULED: "bg-primary/15 text-primary border-primary/40",
  IN_PROGRESS: "bg-warning/20 text-warning border-warning/50",
  COMPLETED: "bg-success/20 text-success border-success/50",
  CANCELLED: "bg-destructive/15 text-destructive border-destructive/40",
};

const techDisplayName = (t: Tech) => t.full_name?.trim() || t.email || "Unnamed";

const Dispatch = () => {
  const orgId = useOrgId();
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(startOfDay(new Date()));
  const [pickerOpen, setPickerOpen] = useState(false);

  const [techs, setTechs] = useState<Tech[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const [conflictSlot, setConflictSlot] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const jobsRef = useRef<Job[]>([]);
  jobsRef.current = jobs;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const dayStart = useMemo(() => {
    const d = new Date(date); d.setHours(START_HOUR, 0, 0, 0); return d;
  }, [date]);
  const dayEnd = useMemo(() => {
    const d = new Date(date); d.setHours(END_HOUR, 0, 0, 0); return d;
  }, [date]);

  const load = async () => {
    if (!orgId) return;
    setLoading(true);

    const { data: roleRows } = await supabase
      .from("user_roles").select("user_id").eq("organization_id", orgId).eq("role", "TECHNICIAN");
    const techIds = (roleRows ?? []).map((r) => r.user_id);

    let techList: Tech[] = [];
    if (techIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles").select("id, full_name, email").in("id", techIds);
      techList = (profs ?? []) as Tech[];
    }
    setTechs(techList);

    const { data: jobRows, error } = await supabase
      .from("jobs")
      .select("id, job_number, title, customer_name, status, scheduled_start, scheduled_end, estimated_duration_minutes, technician_id")
      .is("deleted_at", null)
      .neq("status", "CANCELLED")
      .neq("status", "COMPLETED");
    if (error) {
      toast({ title: "Failed to load jobs", description: error.message, variant: "destructive" });
    }
    setJobs((jobRows ?? []) as Job[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [orgId]);

  const unscheduled = useMemo(
    () => jobs.filter((j) => !j.scheduled_start || !j.technician_id),
    [jobs],
  );

  const scheduledByTech = useMemo(() => {
    const map: Record<string, Job[]> = {};
    techs.forEach((t) => (map[t.id] = []));
    jobs.forEach((j) => {
      if (!j.scheduled_start || !j.technician_id) return;
      if (!isSameDay(new Date(j.scheduled_start), date)) return;
      if (!map[j.technician_id]) map[j.technician_id] = [];
      map[j.technician_id].push(j);
    });
    return map;
  }, [jobs, techs, date]);

  const handleDragStart = (e: DragStartEvent) => {
    setActiveJob(jobs.find((j) => j.id === e.active.id) ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveJob(null);
    const { active, over } = e;
    if (!over) return;
    const job = jobs.find((j) => j.id === active.id);
    if (!job) return;
    const overId = String(over.id);
    if (!overId.startsWith("slot:")) return;

    const [, techId, hourStr] = overId.split(":");
    const hour = Number(hourStr);
    const newStart = new Date(date); newStart.setHours(hour, 0, 0, 0);
    const durationMin = job.estimated_duration_minutes ?? 60;
    const newEnd = new Date(newStart.getTime() + durationMin * 60_000);

    // Conflict detection
    const overlap = jobs.some((j) => {
      if (j.id === job.id) return false;
      if (j.technician_id !== techId) return false;
      if (!j.scheduled_start || !j.scheduled_end) return false;
      if (!isSameDay(new Date(j.scheduled_start), date)) return false;
      const s = new Date(j.scheduled_start).getTime();
      const eMs = new Date(j.scheduled_end).getTime();
      return newStart.getTime() < eMs && newEnd.getTime() > s;
    });
    if (overlap) {
      toast({
        title: "Scheduling conflict",
        description: "This technician already has a job at that time.",
        variant: "destructive",
      });
      return;
    }

    // Optimistic
    const previous = jobs;
    const newStatus: JobStatus = job.status === "NEW" ? "SCHEDULED" : job.status;
    setJobs((curr) => curr.map((j) => j.id === job.id ? {
      ...j,
      technician_id: techId,
      scheduled_start: newStart.toISOString(),
      scheduled_end: newEnd.toISOString(),
      estimated_duration_minutes: durationMin,
      status: newStatus,
    } : j));

    const { error } = await supabase
      .from("jobs")
      .update({
        technician_id: techId,
        scheduled_start: newStart.toISOString(),
        scheduled_end: newEnd.toISOString(),
        estimated_duration_minutes: durationMin,
        status: newStatus,
      } as any)
      .eq("id", job.id);

    if (error) {
      setJobs(previous);
      toast({ title: "Reschedule failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Job scheduled" });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dispatch</h1>
          <p className="text-sm text-muted-foreground">Drag jobs onto a technician's time slot to schedule.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate((d) => addDays(d, -1))} aria-label="Previous day">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(date, "EEE, MMM d, yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => { if (d) { setDate(startOfDay(d)); setPickerOpen(false); } }}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="icon" onClick={() => setDate((d) => addDays(d, 1))} aria-label="Next day">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(startOfDay(new Date()))}>Today</Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-[260px_1fr] gap-4">
          <aside className="rounded-xl border border-border bg-card p-3 shadow-soft">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Unscheduled</h2>
              <span className="text-xs text-muted-foreground">{unscheduled.length}</span>
            </div>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
              ) : unscheduled.length === 0 ? (
                <p className="py-6 text-center text-xs text-muted-foreground">No unscheduled jobs.</p>
              ) : (
                unscheduled.map((job) => <JobCard key={job.id} job={job} />)
              )}
            </div>
          </aside>

          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
            <div style={{ minWidth: TECH_COL_WIDTH + HOURS.length * SLOT_WIDTH }}>
              <div className="flex border-b border-border bg-muted/30">
                <div style={{ width: TECH_COL_WIDTH }} className="shrink-0 border-r border-border p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Technician
                </div>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    style={{ width: SLOT_WIDTH }}
                    className="shrink-0 border-r border-border px-2 py-3 text-xs font-medium text-muted-foreground"
                  >
                    {format(new Date().setHours(h, 0, 0, 0), "h a")}
                  </div>
                ))}
              </div>

              {loading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : techs.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  No technicians found. Assign the TECHNICIAN role from the Team page.
                </div>
              ) : (
                techs.map((tech) => (
                  <TechRow
                    key={tech.id}
                    tech={tech}
                    jobs={scheduledByTech[tech.id] ?? []}
                    dayStart={dayStart}
                    dayEnd={dayEnd}
                    onJobClick={(jid) => navigate(`/jobs/${jid}`)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <DragOverlay>
          {activeJob ? <JobCard job={activeJob} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

const JobCard = ({ job, dragging }: { job: Job; dragging?: boolean }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "group cursor-grab rounded-lg border border-border bg-background p-2.5 shadow-soft transition-opacity active:cursor-grabbing",
        (isDragging || dragging) && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-[10px] text-muted-foreground">#{job.job_number}</div>
          <div className="truncate text-sm font-medium">{job.title}</div>
          <div className="truncate text-xs text-muted-foreground">{job.customer_name ?? "No customer"}</div>
          <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" /> {job.estimated_duration_minutes ?? 60} min
          </div>
        </div>
      </div>
    </div>
  );
};

const TechRow = ({
  tech, jobs, dayStart, dayEnd, onJobClick,
}: {
  tech: Tech; jobs: Job[]; dayStart: Date; dayEnd: Date; onJobClick: (id: string) => void;
}) => (
  <div className="flex border-b border-border last:border-b-0" style={{ height: ROW_HEIGHT }}>
    <div style={{ width: TECH_COL_WIDTH }} className="shrink-0 border-r border-border bg-muted/20 p-3">
      <div className="truncate text-sm font-medium">{techDisplayName(tech)}</div>
      <div className="truncate text-xs text-muted-foreground">{tech.email}</div>
    </div>
    <div className="relative flex">
      {HOURS.map((h) => <SlotCell key={h} techId={tech.id} hour={h} />)}
      {jobs.map((job) => (
        <JobBlock key={job.id} job={job} dayStart={dayStart} dayEnd={dayEnd} onClick={() => onJobClick(job.id)} />
      ))}
    </div>
  </div>
);

const SlotCell = ({ techId, hour }: { techId: string; hour: number }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${techId}:${hour}` });
  return (
    <div
      ref={setNodeRef}
      style={{ width: SLOT_WIDTH }}
      className={cn(
        "h-full shrink-0 border-r border-border transition-colors",
        isOver && "bg-primary/15 ring-2 ring-inset ring-primary",
      )}
    />
  );
};

const JobBlock = ({
  job, dayStart, dayEnd, onClick,
}: { job: Job; dayStart: Date; dayEnd: Date; onClick: () => void }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id });
  const start = new Date(job.scheduled_start!);
  const end = job.scheduled_end ? new Date(job.scheduled_end) : new Date(start.getTime() + 60 * 60_000);
  const dayStartMs = dayStart.getTime();
  const dayEndMs = dayEnd.getTime();
  const clampedStart = Math.max(start.getTime(), dayStartMs);
  const clampedEnd = Math.min(end.getTime(), dayEndMs);
  if (clampedEnd <= dayStartMs || clampedStart >= dayEndMs) return null;
  const hourMs = 3600_000;
  const leftPx = ((clampedStart - dayStartMs) / hourMs) * SLOT_WIDTH;
  const widthPx = Math.max(((clampedEnd - clampedStart) / hourMs) * SLOT_WIDTH, 56);

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => { if (isDragging) return; e.stopPropagation(); onClick(); }}
      className={cn(
        "absolute top-1.5 bottom-1.5 cursor-grab overflow-hidden rounded-md border-l-4 px-2 py-1 text-left shadow-soft transition-opacity active:cursor-grabbing",
        statusBlock[job.status],
        isDragging && "opacity-40",
      )}
      style={{ left: leftPx + 2, width: widthPx - 4 }}
      title={`${job.title} — ${format(start, "h:mm a")}–${format(end, "h:mm a")}`}
    >
      <div className="truncate text-xs font-semibold">{job.title}</div>
      <div className="truncate text-[10px] opacity-80">{job.customer_name ?? "No customer"}</div>
      <div className="truncate text-[10px] opacity-70">{format(start, "h:mm a")}–{format(end, "h:mm a")}</div>
    </button>
  );
};

export default Dispatch;
