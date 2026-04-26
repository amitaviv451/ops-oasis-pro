-- Add columns to jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'NORMAL',
  ADD COLUMN IF NOT EXISTS assigned_technician text,
  ADD COLUMN IF NOT EXISTS service_type text,
  ADD COLUMN IF NOT EXISTS address text;

CREATE INDEX IF NOT EXISTS idx_jobs_deleted_at ON public.jobs(deleted_at);

-- job_notes
CREATE TABLE IF NOT EXISTS public.job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  body text NOT NULL,
  user_email text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_notes_job_id ON public.job_notes(job_id);
ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access job_notes"
ON public.job_notes FOR ALL TO authenticated
USING (organization_id = public.get_user_org(auth.uid()))
WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- job_timeline
CREATE TABLE IF NOT EXISTS public.job_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  from_status public.job_status,
  to_status public.job_status NOT NULL,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_job_timeline_job_id ON public.job_timeline(job_id);
ALTER TABLE public.job_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read job_timeline"
ON public.job_timeline FOR SELECT TO authenticated
USING (organization_id = public.get_user_org(auth.uid()));

CREATE POLICY "Org members insert job_timeline"
ON public.job_timeline FOR INSERT TO authenticated
WITH CHECK (organization_id = public.get_user_org(auth.uid()));

-- Trigger: auto-log status changes
CREATE OR REPLACE FUNCTION public.log_job_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_email text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT email INTO actor_email FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.job_timeline (job_id, organization_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NEW.organization_id, NULL, NEW.status, actor_email);
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT email INTO actor_email FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.job_timeline (job_id, organization_id, from_status, to_status, changed_by)
    VALUES (NEW.id, NEW.organization_id, OLD.status, NEW.status, actor_email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_job_status_change ON public.jobs;
CREATE TRIGGER trg_job_status_change
AFTER INSERT OR UPDATE OF status ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.log_job_status_change();