import { PresentationThumbnail } from "./PresentationThumbnail";
import { useEffect, useState } from "react";
import { t } from "../../i18n";
import { useNLEContext } from "../nle/NLEContext";
import type { PresentationCue } from "./presentationCues";

export interface DisplayRange {
  cue: PresentationCue;
  start: number;
  end: number;
}
export function PresentationBrowser({
  ranges,
  onClose,
  onPresent,
  initialSelection,
  onSelectionChange,
}: {
  ranges: DisplayRange[];
  initialSelection?: { index: number; ended: boolean };
  onSelectionChange?: (selection: { index: number; ended: boolean }) => void;
  onClose: () => void;
  onPresent: (index: number, ended?: boolean) => void;
}) {
  const { pause, seek, projectId } = useNLEContext();
  const [selected, setSelected] = useState(initialSelection ?? { index: 0, ended: false });
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [retry, setRetry] = useState(0);
  const range = ranges[selected.index];
  const time = range ? (selected.ended ? range.end : range.start) : undefined;
  useEffect(() => {
    if (time === undefined) return;
    pause();
    setStatus("loading");
    let timer: ReturnType<typeof setTimeout>;
    const deadline = Date.now() + 15000;
    const locate = () => {
      if (seek(time)) setStatus("ready");
      else if (Date.now() >= deadline) setStatus("failed");
      else timer = setTimeout(locate, 150);
    };
    locate();
    return () => clearTimeout(timer);
  }, [time, pause, seek, retry]);
  function choose(index: number, ended: boolean) {
    const next = { index, ended };
    setSelected(next);
    onSelectionChange?.(next);
    setRetry((value) => value + 1);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [onClose]);
  const button =
    "rounded-md border border-white/20 px-3 py-2 hover:bg-white/10 disabled:opacity-40";
  return (
    <>
      <header
        data-presentation-mode="browse"
        className="absolute inset-x-0 top-0 h-16 flex items-center justify-between px-5 border-b border-white/15 text-white"
      >
        <strong>{t("presentation.browseTitle")}</strong>
        <div className="flex gap-3">
          <button className={button} onClick={onClose}>
            {t("presentation.backEditor")}
          </button>
          <button
            className={button + " bg-emerald-700"}
            disabled={!range || status !== "ready"}
            onClick={() => onPresent(selected.index, selected.ended)}
          >
            {t("presentation.play")}
          </button>
        </div>
      </header>
      <aside
        className="absolute left-0 top-16 bottom-0 w-60 overflow-y-auto border-r border-white/15 p-3 text-white"
        aria-label={t("presentation.groups")}
      >
        {ranges.map((item, index) => (
          <details key={item.cue.id} open className="mb-4">
            <summary className="cursor-pointer py-2 text-sm">
              {index + 1}. {item.cue.label}
            </summary>
            {(index === 0 ? [false, true] : [true]).map((ended) => (
              <button
                key={String(ended)}
                aria-pressed={selected.index === index && selected.ended === ended}
                className={
                  "block w-full rounded-md border p-2 mb-2 text-left " +
                  (selected.index === index && selected.ended === ended
                    ? "border-emerald-400 bg-emerald-900/30"
                    : "border-white/15")
                }
                onClick={() => choose(index, ended)}
              >
                <PresentationThumbnail
                  projectId={projectId ?? ""}
                  time={ended ? item.end : item.start}
                  selected={selected.index === index && selected.ended === ended}
                  label={ended ? t("presentation.endState") : t("presentation.startState")}
                />
                <span className="block pt-2 text-sm">
                  {ended ? t("presentation.endState") : t("presentation.startState")}
                </span>
              </button>
            ))}
          </details>
        ))}
        {!ranges.length && <p role="status">{t("presentation.noStates")}</p>}
      </aside>
      <footer className="absolute bottom-0 right-0 left-60 h-20 border-t border-white/15 px-5 flex items-center justify-between text-white gap-3">
        <span className="text-sm">
          {range?.cue.label}
          <br />
          {status === "failed"
            ? t("presentation.seekFailed")
            : status === "loading"
              ? t("presentation.loading")
              : t("presentation.waiting")}
          {status === "failed" && (
            <button className={button} onClick={() => setRetry((value) => value + 1)}>
              {t("presentation.retry")}
            </button>
          )}
        </span>
        <button
          className={button}
          disabled={
            !range || status !== "ready" || (selected.ended && selected.index === ranges.length - 1)
          }
          onClick={() => onPresent(selected.index, selected.ended)}
        >
          {t("presentation.play")}
        </button>
      </footer>
    </>
  );
}
