-- Fix privilege escalation: restrict role inserts to user's own organization
DROP POLICY IF EXISTS "Users insert own roles" ON public.user_roles;

CREATE POLICY "Users insert own roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND organization_id = public.get_user_org(auth.uid())
);