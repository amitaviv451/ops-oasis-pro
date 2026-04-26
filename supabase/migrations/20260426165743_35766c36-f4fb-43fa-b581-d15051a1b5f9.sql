ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS scheduled_start timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_end timestamptz,
  ADD COLUMN IF NOT EXISTS estimated_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_technician_id ON public.jobs(technician_id);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled_start ON public.jobs(scheduled_start);

-- Backfill scheduled_start from scheduled_at when missing
UPDATE public.jobs
  SET scheduled_start = scheduled_at
  WHERE scheduled_start IS NULL AND scheduled_at IS NOT NULL;

-- Keep scheduled_at in sync with scheduled_start
CREATE OR REPLACE FUNCTION public.sync_job_scheduled_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.scheduled_start IS DISTINCT FROM OLD.scheduled_start
     OR (TG_OP = 'INSERT' AND NEW.scheduled_start IS NOT NULL) THEN
    NEW.scheduled_at = NEW.scheduled_start;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_job_scheduled_at ON public.jobs;
CREATE TRIGGER trg_sync_job_scheduled_at
BEFORE INSERT OR UPDATE OF scheduled_start ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_job_scheduled_at();