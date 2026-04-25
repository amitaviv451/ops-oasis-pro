-- Prevent users from self-assigning elevated roles via direct INSERT.
-- Elevated grants (OWNER/ADMIN) must go through the manage-user-role
-- edge function, which uses the service role and verifies the caller
-- already holds OWNER in the target organization.

DROP POLICY IF EXISTS "Users insert own roles" ON public.user_roles;

CREATE POLICY "Users insert own non-elevated roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_org(auth.uid())
  AND role IN ('DISPATCHER'::public.app_role, 'TECHNICIAN'::public.app_role)
);