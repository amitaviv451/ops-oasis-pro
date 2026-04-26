import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** Read/write the ?page= query param. 1-indexed. */
export function usePageParam(): [number, (p: number) => void] {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(params);
      if (p <= 1) next.delete("page");
      else next.set("page", String(p));
      setParams(next, { replace: false });
    },
    [params, setParams],
  );

  return [page, setPage];
}
