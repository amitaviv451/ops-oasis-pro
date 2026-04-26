import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { downloadInvoicePdf } from "@/lib/invoicePdf";

interface Invoice {
  id: string;
  invoice_number: number;
  customer_name: string | null;
  amount: number;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE";
  issued_at: string;
  due_date: string | null;
  tax_rate: number;
  payment_amount: number | null;
  organization_id: string;
}
interface Item { description: string; quantity: number; unit_price: number; total: number; position: number }

const fmt = (n: number) => `$${n.toFixed(2)}`;

const PortalInvoice = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [orgName, setOrgName] = useState("Your Company");
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data: inv, error } = await supabase
        .from("invoices").select("*").eq("portal_token", token).maybeSingle();
      if (error || !inv) { setLoading(false); return; }
      setInvoice(inv as Invoice);
      const [{ data: lineItems }, { data: org }] = await Promise.all([
        supabase.from("invoice_items").select("description, quantity, unit_price, total, position").eq("invoice_id", inv.id).order("position"),
        supabase.from("organizations").select("name").eq("id", inv.organization_id).maybeSingle(),
      ]);
      setItems((lineItems ?? []) as Item[]);
      if (org?.name) setOrgName(org.name);
      setLoading(false);
    })();
  }, [token]);

  const subtotal = items.reduce((s, it) => s + Number(it.total), 0);
  const taxRate = Number(invoice?.tax_rate ?? 0);
  const tax = Math.round(subtotal * (taxRate / 100) * 100) / 100;
  const grand = subtotal + tax;
  const paid = Number(invoice?.payment_amount ?? (invoice?.status === "PAID" ? grand : 0));
  const due = Math.max(0, grand - paid);

  const payNow = async () => {
    if (!invoice) return;
    setPaying(true);
    const { error } = await supabase.from("invoices").update({
      status: "PAID", paid_at: new Date().toISOString(), payment_amount: grand,
    }).eq("portal_token", token!);
    setPaying(false);
    if (error) return toast({ title: "Payment failed", description: error.message, variant: "destructive" });
    setInvoice({ ...invoice, status: "PAID", payment_amount: grand });
    toast({ title: "Payment recorded" });
  };

  const downloadPdf = async () => {
    if (!invoice) return;
    await downloadInvoicePdf({
      companyName: orgName,
      invoiceNumber: `INV-${invoice.invoice_number}`,
      customerName: invoice.customer_name ?? "—",
      issueDate: format(new Date(invoice.issued_at), "MMM d, yyyy"),
      dueDate: invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : undefined,
      items, subtotal, taxRate, tax, total: grand, amountPaid: paid, amountDue: due,
    });
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-muted/30"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!invoice) {
    return (
      <div className="min-h-screen grid place-items-center bg-muted/30 px-4">
        <div className="rounded-xl border bg-card p-8 text-center max-w-md">
          <h1 className="text-xl font-bold">Invoice not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  const canPay = invoice.status === "SENT" || invoice.status === "OVERDUE";

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
              <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
              <div className="text-sm text-muted-foreground mt-1">INV-{invoice.invoice_number}</div>
              <div className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-secondary text-secondary-foreground">
                {invoice.status}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Bill to</div>
              <div className="font-medium mt-1">{invoice.customer_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Issue date</div>
              <div className="mt-1">{format(new Date(invoice.issued_at), "MMM d, yyyy")}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Due date</div>
              <div className="mt-1">{invoice.due_date ? format(new Date(invoice.due_date), "MMM d, yyyy") : "—"}</div>
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
              <Row label="Subtotal" value={fmt(subtotal)} />
              <Row label={`Tax (${taxRate}%)`} value={fmt(tax)} />
              <div className="border-t my-1" />
              <Row label="Total" value={fmt(grand)} bold />
              <Row label="Amount paid" value={fmt(paid)} />
              <div className="border-t my-1" />
              <Row label="Amount due" value={fmt(due)} bold accent />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t flex flex-wrap items-center justify-between gap-3">
            {invoice.status === "PAID" ? (
              <div className="flex items-center gap-2 rounded-lg bg-success/10 text-success px-3 py-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> Paid in full
              </div>
            ) : <div />}
            <div className="flex gap-2">
              <Button variant="outline" onClick={downloadPdf} className="gap-2">
                <Download className="h-4 w-4" /> Download PDF
              </Button>
              {canPay && (
                <Button onClick={payNow} disabled={paying} className="gap-2">
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Pay Now
                </Button>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">Thank you for your business</p>
      </div>
    </div>
  );
};

const Row = ({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) => (
  <div className="flex justify-between">
    <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
    <span className={`font-mono ${bold ? "font-semibold" : ""} ${accent ? "text-primary" : ""}`}>{value}</span>
  </div>
);

export default PortalInvoice;
