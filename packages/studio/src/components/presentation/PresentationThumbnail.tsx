import { useEffect, useRef, useState } from "react";
import { useThumbnailStill } from "../../hooks/useThumbnailStill";
import { usePlayerStore } from "../../player/store/playerStore";
import { t } from "../../i18n";

export function PresentationThumbnail({
  projectId,
  time,
  selected,
  label,
}: {
  projectId: string;
  time: number;
  selected: boolean;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [requested, setRequested] = useState(false);
  const [retry, setRetry] = useState(0);
  const revision = usePlayerStore(
    (s) => (s.thumbnailRevisions["*"] ?? 0) + (s.thumbnailRevisions["index.html"] ?? 0),
  );
  useEffect(() => {
    if (!container.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setVisible(entry.isIntersecting);
        if (entry.isIntersecting) setRequested(true);
      },
      {
        root: container.current.closest("aside"),
        rootMargin: "320px",
      },
    );
    observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const url = `/api/projects/${encodeURIComponent(projectId)}/thumbnail/index.html?t=${time}&output=preview&revision=${revision}&retry=${retry}`;
  // Keep visited frames leased so scrolling does not cancel an in-flight capture.
  // The presentation in front of the editor takes priority over its timeline posters.
  const image = useThumbnailStill(requested || selected ? url : null, projectId, {
    priority: visible || selected ? "interaction" : "overscan",
  });
  return (
    <div
      ref={container}
      className="w-full aspect-video rounded bg-neutral-800 flex items-center justify-center overflow-hidden"
      aria-busy={(requested || selected) && image.status === "loading"}
    >
      {image.status === "ready" ? (
        <img src={image.url} alt={label} className="w-full h-full object-contain" />
      ) : (
        <span
          role="status"
          className="text-xs text-neutral-300 p-2"
          onClick={
            image.status === "failed"
              ? (event) => {
                  event.stopPropagation();
                  setRetry((value) => value + 1);
                }
              : undefined
          }
        >
          {image.status === "failed"
            ? t("presentation.thumbnailFailed")
            : requested || selected
              ? t("presentation.loading")
              : t("presentation.thumbnailPending")}
        </span>
      )}
    </div>
  );
}
