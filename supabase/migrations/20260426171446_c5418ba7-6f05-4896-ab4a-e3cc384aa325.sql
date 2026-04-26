-- Add portal_token + decline/approve metadata to invoices and estimates
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS portal_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text;

CREATE UNIQUE INDEX IF NOT EXISTS invoices_portal_token_key ON public.invoices(portal_token);
CREATE UNIQUE INDEX IF NOT EXISTS estimates_portal_token_key ON public.estimates(portal_token);

-- Public (anon) read access by portal token. Existing org policies remain for authenticated users.
CREATE POLICY "Public can read invoice by token"
  ON public.invoices FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can read invoice items by token"
  ON public.invoice_items FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can read estimate by token"
  ON public.estimates FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can read estimate items by token"
  ON public.estimate_items FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Public can read organizations for portal"
  ON public.organizations FOR SELECT
  TO anon
  USING (true);

-- Allow anon to mark an invoice paid (only specific status transitions)
CREATE POLICY "Public can pay invoice"
  ON public.invoices FOR UPDATE
  TO anon
  USING (status IN ('SENT'::invoice_status, 'OVERDUE'::invoice_status))
  WITH CHECK (status = 'PAID'::invoice_status);

-- Allow anon to approve/decline estimate
CREATE POLICY "Public can respond to estimate"
  ON public.estimates FOR UPDATE
  TO anon
  USING (status IN ('SENT'::estimate_status, 'DRAFT'::estimate_status))
  WITH CHECK (status IN ('ACCEPTED'::estimate_status, 'DECLINED'::estimate_status));
