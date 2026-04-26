import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";

interface Estimate {
  id: string;
  estimate_number: number;
  title: string;
  customer_name: string | null;
  status: "DRAFT" | "SENT" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  valid_until: string | null;
  created_at: string;
  tax_rate: number;
  organization_id: string;
}
interface Item { description: string; quantity: number; unit_price: number; total: number; position: number }

const fmt = (n: number) => `$${n.toFixed(2)}`;

const PortalEstimate = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [est, setEst] = useState<Estimate | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [orgName, setOrgName] = useState("Your Company");
  const [showDecline, setShowDecline] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase
        .from("estimates").select("*").eq("portal_token", token).maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setEst(data as Estimate);
      const [{ data: lineItems }, { data: org }] = await Promise.all([
        supabase.from("estimate_items").select("description, quantity, unit_price, total, position").eq("estimate_id", data.id).order("position"),
        supabase.from("organizations").select("name").eq("id", data.organization_id).maybeSingle(),
      ]);
      setItems((lineItems ?? []) as Item[]);
      if (org?.name) setOrgName(org.name);
      setLoading(false);
    })();
  }, [token]);

  const subtotal = items.reduce((s, it) => s + Number(it.total), 0);
  const taxRate = Number(est?.tax_rate ?? 0);
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const grand = subtotal + tax;

  const approve = async () => {
    if (!est) return;
    setPending(true);
    const { error } = await supabase.from("estimates").update({
      status: "ACCEPTED", approved_at: new Date().toISOString(),
    } as any).eq("portal_token", token!);
    setPending(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setEst({ ...est, status: "ACCEPTED" });
    toast({ title: "Estimate approved" });
  };

  const decline = async () => {
    if (!est) return;
    setPending(true);
    const { error } = await supabase.from("estimates").update({
      status: "DECLINED", declined_at: new Date().toISOString(), decline_reason: reason || null,
    } as any).eq("portal_token", token!);
    setPending(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setEst({ ...est, status: "DECLINED" });
    setShowDecline(false);
    toast({ title: "Estimate declined" });
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-muted/30"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!est) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
        <div className="rounded-xl border bg-card p-8 text-center max-w-md">
          <h1 className="text-xl font-bold">Estimate not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const responded = est.status === "ACCEPTED" || est.status === "DECLINED";

  return (
    <div className="min-h-screen bg-muted/30 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border bg-card p-8 shadow-sm">
          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <div className="h-12 w-12 rounded-lg bg-primary text-primary-foreground grid place-items-center text-xl font-bold mb-3">
                {orgName.charAt(0).toUpperCase()}
              </div>
              <div className="font-semibold">{orgName}</div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-bold tracking-tight">ESTIMATE</h1>
              <div className="text-sm text-muted-foreground mt-1">EST-{est.estimate_number}</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Project</div>
            <div className="font-semibold mt-1">{est.title}</div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Customer</div>
              <div className="font-medium mt-1">{est.customer_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Date</div>
              <div className="mt-1">{format(new Date(est.created_at), "MMM d, yyyy")}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Valid until</div>
              <div className="mt-1">{est.valid_until ? format(new Date(est.valid_until), "MMM d, yyyy") : "—"}</div>
            </div>
          </div>

          <div className="mt-8 border rounded-lg overflow-hidden">
            <div className="grid grid-cols-12 bg-muted/50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <div className="col-span-6">Description</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-2 text-right">Unit price</div>
              <div className="col-span-2 text-right">Total</div>
            </div>
            {items.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">No line items.</div>
            ) : items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 px-4 py-2 text-sm border-t">
                <div className="col-span-6">{it.description}</div>
                <div className="col-span-2 text-right">{it.quantity}</div>
                <div className="col-span-2 text-right font-mono">{fmt(Number(it.unit_price))}</div>
                <div className="col-span-2 text-right font-mono">{fmt(Number(it.total))}</div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <div className="w-full max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Tax ({taxRate}%)</span><span className="font-mono">{fmt(tax)}</span></div>
              <div className="border-t my-1" />
              <div className="flex justify-between font-semibold"><span>Total</span><span className="font-mono text-primary">{fmt(grand)}</span></div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t">
            {responded ? (
              <div className={`rounded-lg px-4 py-3 text-sm font-medium ${est.status === "ACCEPTED" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                {est.status === "ACCEPTED" ? "Thank you — this estimate has been approved." : "This estimate has been declined. Thanks for letting us know."}
              </div>
            ) : showDecline ? (
              <div className="space-y-3">
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Tell us why (optional)" rows={3} />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" onClick={() => setShowDecline(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={decline} disabled={pending} className="gap-2">
                    {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Confirm decline
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDecline(true)} disabled={pending} className="gap-2 text-destructive hover:text-destructive">
                  <X className="h-4 w-4" /> Decline
                </Button>
                <Button onClick={approve} disabled={pending} className="gap-2 bg-success text-success-foreground hover:bg-success/90">
                  {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve Estimate
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortalEstimate;
