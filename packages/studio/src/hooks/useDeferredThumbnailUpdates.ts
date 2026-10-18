import { useCallback, useEffect, useRef } from "react";

export function inspectorHasFocus(): boolean {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return !!active?.closest('[data-flat-panel-body="true"]');
}

/** Coalesce persisted revisions until the inspector interaction is finished. */
export function useDeferredThumbnailUpdates(
  projectId: string | null,
  update: (paths: readonly string[] | null) => void,
) {
  const pending = useRef<Set<string> | null | undefined>(undefined);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const updateRef = useRef(update);
  updateRef.current = update;
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      pending.current = undefined;
    },
    [projectId],
  );
  return useCallback((paths: readonly string[] | null) => {
    if (pending.current !== null) {
      if (paths === null) pending.current = null;
      else {
        pending.current ??= new Set();
        paths.forEach((path) => pending.current?.add(path));
      }
    }
    clearTimeout(timer.current);
    const flush = () => {
      if (inspectorHasFocus()) {
        timer.current = setTimeout(flush, 800);
        return;
      }
      const batch = pending.current;
      pending.current = undefined;
      if (batch !== undefined) updateRef.current(batch === null ? null : [...batch]);
    };
    timer.current = setTimeout(flush, 800);
  }, []);
}
