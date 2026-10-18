import { useEffect, useState } from "react";
import type { ThumbnailRequest } from "../player/lib/thumbnailScheduler";
import { useThumbnailLease } from "./useThumbnailLease";

/** Keep the old lease alive until its replacement is decoded and ready. */
export function useStableThumbnailLease(request: ThumbnailRequest | null, scope: string) {
  const current = useThumbnailLease(request);
  const [displayed, setDisplayed] = useState<{ request: ThumbnailRequest; scope: string } | null>(
    null,
  );
  const previous = useThumbnailLease(displayed?.scope === scope ? displayed.request : null);
  useEffect(() => {
    if (!request) setDisplayed(null);
    else if (current.status === "ready") setDisplayed({ request, scope });
  }, [request, scope, current.status]);
  return current.status === "ready" || !request || displayed?.scope !== scope
    ? current
    : previous.status === "ready"
      ? previous
      : current;
}
