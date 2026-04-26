import { ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** When true, renders a "Clear filters" CTA via onAction. */
  filtered?: boolean;
  query?: string;
}

export const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  filtered,
  query,
}: EmptyStateProps) => {
  const finalTitle = filtered
    ? query
      ? `No results for "${query}"`
      : "No results match your filters"
    : title;
  const finalDesc = filtered
    ? "Try a different search or clear your filters."
    : description;
  const finalLabel = filtered ? "Clear filters" : actionLabel;

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
        {icon}
      </div>
      <h2 className="mt-4 text-lg font-semibold">{finalTitle}</h2>
      {finalDesc && <p className="mt-2 max-w-md text-sm text-muted-foreground">{finalDesc}</p>}
      {finalLabel && onAction && (
        <Button onClick={onAction} variant={filtered ? "outline" : "default"} className="mt-4">
          {finalLabel}
        </Button>
      )}
    </div>
  );
};
