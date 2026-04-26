import { toast } from "@/hooks/use-toast";

export const portalUrl = (kind: "invoice" | "estimate", token: string) =>
  `${window.location.origin}/portal/${kind}/${token}`;

export const copyPortalLink = async (kind: "invoice" | "estimate", token: string | null | undefined) => {
  if (!token) {
    toast({ title: "No portal link", description: "Save the record first.", variant: "destructive" });
    return;
  }
  const url = portalUrl(kind, token);
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: "Link copied to clipboard" });
  } catch {
    toast({ title: "Copy failed", description: url, variant: "destructive" });
  }
};
