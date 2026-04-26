ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON public.invoices(job_id);