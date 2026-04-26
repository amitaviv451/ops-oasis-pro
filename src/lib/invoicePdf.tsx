import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica", color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  brand: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center", marginBottom: 8 },
  brandText: { color: "#ffffff", fontSize: 22, fontFamily: "Helvetica-Bold" },
  companyName: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  companyMuted: { fontSize: 9, color: "#6b7280" },
  invoiceTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", textAlign: "right" },
  meta: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  metaLabel: { fontSize: 8, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 },
  metaValue: { fontSize: 10 },
  table: { borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#e5e7eb", marginBottom: 16 },
  th: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 8, paddingHorizontal: 8 },
  thText: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },
  tr: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  cellDesc: { flex: 4 },
  cellQty: { flex: 1, textAlign: "right" },
  cellPrice: { flex: 1.4, textAlign: "right" },
  cellTotal: { flex: 1.4, textAlign: "right" },
  totals: { alignSelf: "flex-end", width: 220, marginBottom: 24 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalRowBold: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  totalLabel: { fontSize: 10, color: "#374151" },
  totalValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  totalDueValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#2563eb" },
  footer: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", textAlign: "center", fontSize: 9, color: "#6b7280" },
});

export interface InvoicePdfData {
  companyName: string;
  invoiceNumber: string | number;
  customerName: string;
  issueDate: string;
  dueDate?: string;
  items: { description: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountDue: number;
}

const fmt = (n: number) => `$${n.toFixed(2)}`;

const InvoicePDFDoc = ({ data }: { data: InvoicePdfData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        <View>
          <View style={styles.brand}><Text style={styles.brandText}>{data.companyName.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.companyName}>{data.companyName}</Text>
          <Text style={styles.companyMuted}>Issued from your workspace</Text>
        </View>
        <View>
          <Text style={styles.invoiceTitle}>INVOICE</Text>
          <Text style={[styles.companyMuted, { textAlign: "right", marginTop: 4 }]}>#{data.invoiceNumber}</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <View>
          <Text style={styles.metaLabel}>Bill to</Text>
          <Text style={[styles.metaValue, { fontFamily: "Helvetica-Bold" }]}>{data.customerName || "—"}</Text>
        </View>
        <View>
          <Text style={styles.metaLabel}>Issue date</Text>
          <Text style={styles.metaValue}>{data.issueDate}</Text>
        </View>
        <View>
          <Text style={styles.metaLabel}>Due date</Text>
          <Text style={styles.metaValue}>{data.dueDate || "—"}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={styles.th}>
          <Text style={[styles.thText, styles.cellDesc]}>Description</Text>
          <Text style={[styles.thText, styles.cellQty]}>Qty</Text>
          <Text style={[styles.thText, styles.cellPrice]}>Unit price</Text>
          <Text style={[styles.thText, styles.cellTotal]}>Total</Text>
        </View>
        {data.items.length === 0 ? (
          <View style={styles.tr}><Text style={[styles.cellDesc, { color: "#6b7280" }]}>No line items.</Text></View>
        ) : data.items.map((it, i) => (
          <View key={i} style={styles.tr}>
            <Text style={styles.cellDesc}>{it.description || "—"}</Text>
            <Text style={styles.cellQty}>{it.quantity}</Text>
            <Text style={styles.cellPrice}>{fmt(Number(it.unit_price))}</Text>
            <Text style={styles.cellTotal}>{fmt(Number(it.total))}</Text>
          </View>
        ))}
      </View>

      <View style={styles.totals}>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Subtotal</Text><Text style={styles.totalValue}>{fmt(data.subtotal)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Tax ({data.taxRate}%)</Text><Text style={styles.totalValue}>{fmt(data.tax)}</Text></View>
        <View style={styles.totalRowBold}><Text style={[styles.totalLabel, { fontFamily: "Helvetica-Bold" }]}>Total</Text><Text style={styles.totalValue}>{fmt(data.total)}</Text></View>
        <View style={styles.totalRow}><Text style={styles.totalLabel}>Amount paid</Text><Text style={styles.totalValue}>{fmt(data.amountPaid)}</Text></View>
        <View style={styles.totalRowBold}><Text style={[styles.totalLabel, { fontFamily: "Helvetica-Bold" }]}>Amount due</Text><Text style={styles.totalDueValue}>{fmt(data.amountDue)}</Text></View>
      </View>

      <Text style={styles.footer}>Thank you for your business</Text>
    </Page>
  </Document>
);

export const downloadInvoicePdf = async (data: InvoicePdfData) => {
  const blob = await pdf(<InvoicePDFDoc data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${data.invoiceNumber}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
