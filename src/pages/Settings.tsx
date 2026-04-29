import { useEffect, useState } from "react";
import { Building2, User, Palette, Sun, Moon, Monitor, Shield, Check, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useOrgId } from "@/lib/useOrgId";
import { useTheme, type Theme } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const Settings = () => {
  const { user } = useAuth();
  const orgId = useOrgId();
  const { theme, setTheme } = useTheme();
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
    const { data, error } = await supabase.functions.invoke("update-organization", {
      body: { name: orgName.trim() },
    });
    setSavingOrg(false);
    if (error || (data && (data as { error?: string }).error)) {
      const msg = (data as { error?: string } | null)?.error ?? error?.message ?? "Save failed";
      return toast({ title: "Save failed", description: msg, variant: "destructive" });
    }
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

          <div className="rounded-xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Appearance</h2>
            </div>
            <p className="mb-4 text-xs text-muted-foreground">Choose how FieldPro looks. System matches your device.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {([
                { value: "light", label: "Light", Icon: Sun },
                { value: "dark", label: "Dark", Icon: Moon },
                { value: "system", label: "System", Icon: Monitor },
              ] as const).map(({ value, label, Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTheme(value as Theme)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                    theme === value
                      ? "border-primary bg-accent"
                      : "border-border bg-background hover:bg-accent/50",
                  )}
                >
                  <div className={cn(
                    "grid h-9 w-9 place-items-center rounded-md",
                    theme === value ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {value === "system" ? "Follow OS" : `${label} theme`}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
