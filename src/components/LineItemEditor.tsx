import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface LineItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export const blankItem = (): LineItem => ({
  description: "",
  quantity: 1,
  unit_price: 0,
  total: 0,
});

export const computeItemTotal = (qty: number, price: number) =>
  Math.round(qty * price * 100) / 100;

export const computeTotals = (items: LineItem[], taxRatePct: number) => {
  const subtotal = items.reduce((s, it) => s + (it.total || 0), 0);
  const tax = Math.round(subtotal * (taxRatePct / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + tax) * 100) / 100;
  return { subtotal, tax, grandTotal };
};

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  taxRate: number;
  onTaxRateChange: (n: number) => void;
  amountPaid?: number;
  showPaid?: boolean;
}

export const LineItemEditor = ({ items, onChange, taxRate, onTaxRateChange, amountPaid = 0, showPaid }: Props) => {
  const update = (idx: number, patch: Partial<LineItem>) => {
    const next = items.map((it, i) => {
      if (i !== idx) return it;
      const merged = { ...it, ...patch };
      merged.total = computeItemTotal(Number(merged.quantity) || 0, Number(merged.unit_price) || 0);
      return merged;
    });
    onChange(next);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, blankItem()]);

  const { subtotal, tax, grandTotal } = computeTotals(items, taxRate);
  const due = Math.max(0, grandTotal - (amountPaid || 0));

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Description</th>
              <th className="w-20 px-2 py-2 text-right font-medium">Qty</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Unit price</th>
              <th className="w-28 px-2 py-2 text-right font-medium">Total</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No line items. Click "Add line" below.
                </td>
              </tr>
            ) : items.map((it, idx) => (
              <tr key={idx} className="border-t border-border">
                <td className="px-2 py-1.5">
                  <Input
                    value={it.description}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    placeholder="Item or service"
                    className="h-8"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number" min="0" step="0.01"
                    value={it.quantity}
                    onChange={(e) => update(idx, { quantity: Number(e.target.value) })}
                    className="h-8 text-right"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <Input
                    type="number" min="0" step="0.01"
                    value={it.unit_price}
                    onChange={(e) => update(idx, { unit_price: Number(e.target.value) })}
                    className="h-8 text-right"
                  />
                </td>
                <td className="px-2 py-1.5 text-right font-mono">
                  ${it.total.toFixed(2)}
                </td>
                <td className="px-1 text-right">
                  <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => remove(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="outline" size="sm" onClick={add} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add line
        </Button>
        <div className="flex items-center gap-2">
          <label htmlFor="tax-rate" className="text-xs font-medium text-muted-foreground">Tax %</label>
          <Input
            id="tax-rate"
            type="number" min="0" step="0.01"
            value={taxRate}
            onChange={(e) => onTaxRateChange(Number(e.target.value) || 0)}
            className="h-8 w-20 text-right"
          />
        </div>
      </div>

      <div className="ml-auto w-full max-w-xs space-y-1 rounded-lg border border-border bg-muted/30 p-3 text-sm">
        <Row label="Subtotal" value={`$${subtotal.toFixed(2)}`} />
        <Row label={`Tax (${taxRate}%)`} value={`$${tax.toFixed(2)}`} />
        <div className="my-1 h-px bg-border" />
        <Row label="Total" value={`$${grandTotal.toFixed(2)}`} bold />
        {showPaid && (
          <>
            <Row label="Paid" value={`$${(amountPaid || 0).toFixed(2)}`} muted />
            <Row label="Due" value={`$${due.toFixed(2)}`} bold accent />
          </>
        )}
      </div>
    </div>
  );
};

const Row = ({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }) => (
  <div className={`flex justify-between ${bold ? "font-semibold" : ""} ${muted ? "text-muted-foreground" : ""} ${accent ? "text-primary" : ""}`}>
    <span>{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);
