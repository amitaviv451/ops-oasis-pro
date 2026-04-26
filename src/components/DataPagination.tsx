import { Loader2 } from "lucide-react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

interface DataPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}

/** Builds a compact page list: 1 … 4 5 [6] 7 8 … 20 */
function buildPages(page: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages: (number | "ellipsis")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(totalPages - 1, page + 1);
  if (start > 2) pages.push("ellipsis");
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages - 1) pages.push("ellipsis");
  pages.push(totalPages);
  return pages;
}

export const DataPagination = ({ page, pageSize, total, onPageChange, loading }: DataPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const pages = buildPages(page, totalPages);

  const go = (p: number) => {
    const clamped = Math.min(Math.max(1, p), totalPages);
    if (clamped !== page) onPageChange(clamped);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Showing <span className="font-medium text-foreground">{from}</span>–
          <span className="font-medium text-foreground">{to}</span> of{" "}
          <span className="font-medium text-foreground">{total}</span> results
        </span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      </div>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); go(page - 1); }}
              className={cn(page <= 1 && "pointer-events-none opacity-40")}
            />
          </PaginationItem>
          {pages.map((p, idx) =>
            p === "ellipsis" ? (
              <PaginationItem key={`e${idx}`}><PaginationEllipsis /></PaginationItem>
            ) : (
              <PaginationItem key={p}>
                <PaginationLink
                  href="#"
                  isActive={p === page}
                  onClick={(e) => { e.preventDefault(); go(p); }}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); go(page + 1); }}
              className={cn(page >= totalPages && "pointer-events-none opacity-40")}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
};

export const PAGE_SIZE = 25;
