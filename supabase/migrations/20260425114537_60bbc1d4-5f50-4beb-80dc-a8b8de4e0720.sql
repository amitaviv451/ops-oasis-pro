
-- 1) Prevent users from changing their own organization_id via the profiles UPDATE policy.
-- Replace the permissive update policy with one that pins organization_id to its current value.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND organization_id IS NOT DISTINCT FROM public.get_user_org(auth.uid())
);

-- 2) Scope has_role to the caller's current organization so a role row in a
-- different org cannot grant privileges in this one.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.organization_id = public.get_user_org(_user_id)
  )
$function$;
