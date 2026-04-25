import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const useOrgId = () => {
  const { user } = useAuth();
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()
      .then(({ data }) => setOrgId(data?.organization_id ?? null));
  }, [user]);

  return orgId;
};
