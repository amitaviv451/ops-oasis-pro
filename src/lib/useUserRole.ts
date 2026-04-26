import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type AppRole = "OWNER" | "ADMIN" | "DISPATCHER" | "TECHNICIAN" | null;

export const useUserRole = () => {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setRole(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .order("role", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        setRole((data?.role as AppRole) ?? null);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading]);

  return { role, loading };
};
