import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const portalUrl = (kind: "invoice" | "estimate", token: string) =>
  `${window.location.origin}/portal/${kind}/${token}`;

/**
 * Copy a portal link for an invoice or estimate.
 * If the record has no portal_token yet (legacy data), generate one with
 * crypto.randomUUID() and persist it before copying the URL.
 */
export const copyPortalLink = async (
  kind: "invoice" | "estimate",
  token: string | null | undefined,
  recordId?: string,
) => {
  let finalToken = token ?? null;

  if (!finalToken) {
    if (!recordId) {
      toast({ title: "No portal link", description: "Save the record first.", variant: "destructive" });
      return;
    }
    const newToken = crypto.randomUUID();
    const table = kind === "invoice" ? "invoices" : "estimates";
    const { error } = await supabase.from(table).update({ portal_token: newToken }).eq("id", recordId);
    if (error) {
      toast({ title: "Could not generate link", description: error.message, variant: "destructive" });
      return;
    }
    finalToken = newToken;
  }

  const url = portalUrl(kind, finalToken);
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  } catch {
    toast({ title: "Copy failed", description: url, variant: "destructive" });
  }
};
