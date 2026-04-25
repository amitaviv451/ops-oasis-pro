
CREATE TYPE public.estimate_status AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED');

CREATE SEQUENCE IF NOT EXISTS public.estimates_estimate_number_seq START 1000;

CREATE TABLE public.estimates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  estimate_number INTEGER NOT NULL DEFAULT nextval('public.estimates_estimate_number_seq'),
  title TEXT NOT NULL,
  customer_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  status public.estimate_status NOT NULL DEFAULT 'DRAFT',
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER SEQUENCE public.estimates_estimate_number_seq OWNED BY public.estimates.estimate_number;

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members access estimates"
  ON public.estimates
  FOR ALL
  TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()))
  WITH CHECK (organization_id = public.get_user_org(auth.uid()));
