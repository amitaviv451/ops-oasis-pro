import { useEffect, useState } from "react";
import { Building2, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOrgId } from "@/lib/useOrgId";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";

const Settings = () => {
  const { user } = useAuth();
  const orgId = useOrgId();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (!user || !orgId) return;
    (async () => {
      setLoading(true);
      const [pRes, oRes] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).single(),
        supabase.from("organizations").select("name").eq("id", orgId).single(),
      ]);
      setFullName(pRes.data?.full_name ?? "");
      setOrgName(oRes.data?.name ?? "");
      setLoading(false);
    })();
  }, [user, orgId]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Profile updated" });
  };

  const saveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSavingOrg(true);
    const { error } = await supabase.from("organizations").update({ name: orgName.trim() }).eq("id", orgId);
    setSavingOrg(false);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Company updated" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile and company.</p>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-64" /><Skeleton className="h-64" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={saveProfile} className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Your profile</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Email</Label><Input value={user?.email ?? ""} disabled /></div>
              <div className="space-y-2"><Label>Full name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
              <Button type="submit" disabled={savingProfile}>{savingProfile ? "Saving..." : "Save profile"}</Button>
            </div>
          </form>

          <form onSubmit={saveOrg} className="rounded-xl border border-border bg-card p-6 shadow-soft">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Company</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Company name</Label><Input value={orgName} onChange={(e) => setOrgName(e.target.value)} /></div>
              <p className="text-xs text-muted-foreground">Shown on estimates, invoices, and customer-facing emails.</p>
              <Button type="submit" disabled={savingOrg}>{savingOrg ? "Saving..." : "Save company"}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default Settings;
