-- Broaden organization update to OWNER or ADMIN, still scoped to the user's own org.
DROP POLICY IF EXISTS "Owners update org" ON public.organizations;

CREATE POLICY "Owners or admins update org"
ON public.organizations
FOR UPDATE
TO authenticated
USING (
  id = public.get_user_org(auth.uid())
  AND (
    public.has_role(auth.uid(), 'OWNER'::public.app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
  )
)
WITH CHECK (
  id = public.get_user_org(auth.uid())
  AND (
    public.has_role(auth.uid(), 'OWNER'::public.app_role)
    OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
  )
);