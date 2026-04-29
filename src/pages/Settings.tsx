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

          {(() => {
            const identities = (user as unknown as { identities?: { provider: string }[] } | null)?.identities ?? [];
            const providers = new Set(identities.map((i) => i.provider));
            const hasEmail = providers.has("email");
            const hasGoogle = providers.has("google");
            const connectGoogle = async () => {
              const { error } = await supabase.auth.linkIdentity({
                provider: "google",
                options: { redirectTo: `${window.location.origin}/settings` },
              });
              if (error) toast({ title: "Couldn't connect Google", description: error.message, variant: "destructive" });
            };
            const Method = ({ label, connected, onConnect, logo }: { label: string; connected: boolean; onConnect?: () => void; logo: React.ReactNode }) => (
              <div className="flex items-center justify-between rounded-lg border border-border bg-background p-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 place-items-center rounded-md bg-secondary">{logo}</div>
                  <div>
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {connected ? "Connected" : "Not connected"}
                    </div>
                  </div>
                </div>
                {connected ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-1 text-xs font-medium text-success">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : onConnect ? (
                  <Button size="sm" variant="outline" onClick={onConnect}>
                    <Plus className="h-3.5 w-3.5" /> Connect
                  </Button>
                ) : null}
              </div>
            );
            return (
              <div className="rounded-xl border border-border bg-card p-6 shadow-soft lg:col-span-2">
                <div className="mb-4 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Account &amp; sign-in</h2>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">
                  Manage which methods you can use to sign in to your account.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Method
                    label="Email &amp; Password"
                    connected={hasEmail}
                    logo={<User className="h-4 w-4 text-muted-foreground" />}
                  />
                  <Method
                    label="Google"
                    connected={hasGoogle}
                    onConnect={hasGoogle ? undefined : connectGoogle}
                    logo={
                      <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    }
                  />
                </div>
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Linking by matching email is enforced server-side. If your Google email matches this account, the identity will be merged.
                </p>
              </div>
            );
          })()}

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
