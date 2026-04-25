
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'bingo@gmail.com' AND email_confirmed_at IS NULL;

DO $$
DECLARE
  uid UUID;
  oid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = 'bingo@gmail.com';
  IF uid IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = uid) THEN
    INSERT INTO public.organizations (name) VALUES ('Bingo Garage Doors') RETURNING id INTO oid;
    INSERT INTO public.profiles (id, organization_id, full_name, email)
      VALUES (uid, oid, 'Yigor Slav', 'bingo@gmail.com');
    INSERT INTO public.user_roles (user_id, organization_id, role)
      VALUES (uid, oid, 'OWNER');
  END IF;
END $$;
