-- 1. Organizations: notification settings
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS company_display_name TEXT,
  ADD COLUMN IF NOT EXISTS twilio_from_number TEXT,
  ADD COLUMN IF NOT EXISTS default_notification_channel TEXT NOT NULL DEFAULT 'sms'
    CHECK (default_notification_channel IN ('sms', 'whatsapp'));

-- 2. Profiles: per-user phone + channel preference
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS notification_channel TEXT
    CHECK (notification_channel IS NULL OR notification_channel IN ('sms', 'whatsapp'));

-- 3. job_notifications table
CREATE TABLE IF NOT EXISTS public.job_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  job_id UUID NOT NULL,
  technician_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'whatsapp')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  message_body TEXT NOT NULL,
  twilio_message_sid TEXT,
  error_detail TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.job_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Org members access job_notifications" ON public.job_notifications
  FOR ALL TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
CREATE INDEX IF NOT EXISTS idx_job_notifications_job ON public.job_notifications(job_id);
CREATE INDEX IF NOT EXISTS idx_job_notifications_org ON public.job_notifications(organization_id, sent_at DESC);

-- 4. notifications table (in-app alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can mark their own as read (update only)
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Org members can insert notifications targeting other org members
CREATE POLICY "Org members insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE read = false;

-- 5. Trigger: notify on job assignment
CREATE OR REPLACE FUNCTION public.notify_on_job_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sched_text TEXT;
BEGIN
  -- Only fire when a technician is set or changes
  IF TG_OP = 'INSERT' THEN
    IF NEW.technician_id IS NULL THEN RETURN NEW; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.technician_id IS NULL OR NEW.technician_id IS NOT DISTINCT FROM OLD.technician_id THEN
      RETURN NEW;
    END IF;
  END IF;

  sched_text := COALESCE(
    to_char(NEW.scheduled_start AT TIME ZONE 'UTC', 'Mon DD at HH12:MI AM'),
    'unscheduled'
  );

  INSERT INTO public.notifications (organization_id, user_id, type, title, body, link)
  VALUES (
    NEW.organization_id,
    NEW.technician_id,
    'JOB_ASSIGNED',
    'New job assigned to you',
    'Job #' || NEW.job_number || ' — ' || COALESCE(NEW.customer_name, 'No customer') || ', ' || sched_text,
    '/jobs/' || NEW.id::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_notify_assignment ON public.jobs;
CREATE TRIGGER jobs_notify_assignment
  AFTER INSERT OR UPDATE OF technician_id ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_job_assignment();

-- 6. Trigger: notify org leaders on status change
CREATE OR REPLACE FUNCTION public.notify_on_job_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_name TEXT;
  recipient RECORD;
BEGIN
  IF TG_OP <> 'UPDATE' OR NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, p.email, 'Someone') INTO actor_name
  FROM public.profiles p WHERE p.id = auth.uid();
  IF actor_name IS NULL THEN actor_name := 'A teammate'; END IF;

  FOR recipient IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.organization_id = NEW.organization_id
      AND ur.role IN ('OWNER', 'ADMIN', 'DISPATCHER')
      AND ur.user_id <> COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  LOOP
    INSERT INTO public.notifications (organization_id, user_id, type, title, body, link)
    VALUES (
      NEW.organization_id,
      recipient.user_id,
      'JOB_STATUS_CHANGED',
      'Job #' || NEW.job_number || ' status updated',
      actor_name || ' marked job #' || NEW.job_number || ' as ' || replace(NEW.status::text, '_', ' '),
      '/jobs/' || NEW.id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_notify_status_change ON public.jobs;
CREATE TRIGGER jobs_notify_status_change
  AFTER UPDATE OF status ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_job_status_change();

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;