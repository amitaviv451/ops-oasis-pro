-- Create sequence for invoice numbers starting at 1001
CREATE SEQUENCE IF NOT EXISTS public.invoices_invoice_number_seq START WITH 1001 INCREMENT BY 1;

-- Add invoice_number column
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_number integer NOT NULL DEFAULT nextval('public.invoices_invoice_number_seq');

ALTER SEQUENCE public.invoices_invoice_number_seq OWNED BY public.invoices.invoice_number;

-- Backfill any existing rows that may have collided defaults (defensive)
-- Existing rows already received a default at the time of ALTER, so just ensure uniqueness for future inserts.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_invoice_number_unique ON public.invoices (invoice_number);

-- Bump estimate sequence forward so new estimates start at 1001 (only if currently below)
DO $$
DECLARE
  current_max integer;
BEGIN
  SELECT COALESCE(MAX(estimate_number), 1000) INTO current_max FROM public.estimates;
  IF current_max < 1000 THEN
    PERFORM setval('public.estimates_estimate_number_seq', 1000, true);
  END IF;
END $$;
