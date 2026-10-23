import { Menu, MenuItem, MenuSeparator } from "../ui/Menu";
import { createPortal } from "react-dom";
import { usePreviewToolbarSlot } from "../dock/PreviewToolbarSlot";
import { PresentationBrowser } from "./PresentationBrowser";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useFileManagerContext } from "../../contexts/FileManagerContext";
import { useStudioShellContext } from "../../contexts/StudioContext";
import { useNLEContext } from "../nle/NLEContext";
import { liveTime, usePlayerStore } from "../../player/store/playerStore";
import { t } from "../../i18n";
import {
  anchorAt,
  CUE_FILE,
  parseCues,
  resolveCue,
  type CueAnchor,
  type PresentationCue,
} from "./presentationCues";
import { useCuePlayback } from "./useCuePlayback";

export function PresentationControls({
  stage,
  onActiveChange,
  browsing,
  onBrowseChange,
}: {
  stage: RefObject<HTMLDivElement | null>;
  onActiveChange: (active: boolean) => void;
  browsing: boolean;
  onBrowseChange: (active: boolean) => void;
}) {
  const toolbarSlot = usePreviewToolbarSlot();
  const files = useFileManagerContext();
  const shell = useStudioShellContext();
  const { projectId, compositionStack, timelineDisabled, pause, seek } = useNLEContext();
  const clips = usePlayerStore((s) => s.elements);
  const duration = usePlayerStore((s) => s.duration);
  const timelineReady = usePlayerStore((s) => s.timelineReady);
  const preparing = !timelineReady || !Number.isFinite(duration) || duration <= 0;
  const clipTimingKey = clips.map((c) => `${c.id}:${c.start}:${c.duration}`).join("|");
  const [cues, setCues] = useState<PresentationCue[]>([]);
  const [browserSelection, setBrowserSelection] = useState({ index: 0, ended: false });
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState<CueAnchor | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const source = useRef<string | null>(null);
  const fileRef = useRef(files);
  fileRef.current = files;
  const master = compositionStack.length === 1;
  const resolved = cues.map((cue) => ({
    cue,
    range: preparing ? null : resolveCue(cue, clips, duration),
  }));
  const playable = resolved.flatMap((item) =>
    item.range ? [{ cue: item.cue, ...item.range, transition: item.cue.transition }] : [],
  );
  const playback = useCuePlayback(stage, playable);
  const active = playback.session !== null;
  useEffect(() => onActiveChange(active), [active, onActiveChange]);
  useEffect(() => {
    const state = playback.session;
    if (state && state.phase !== "running")
      setBrowserSelection({ index: state.index, ended: state.phase === "ended" });
  }, [playback.session]);
  useEffect(() => {
    let active = true;
    setBusy(true);
    setPending(null);
    setError("");
    setCues([]);
    fileRef.current
      .readOptionalProjectFile(CUE_FILE)
      .then((text) => {
        if (!active) return;
        source.current = text;
        const data = parseCues(text);
        setCues(data);
        setSelected((previous) =>
          data.some((c) => c.id === previous) ? previous : (data[0]?.id ?? ""),
        );
      })
      .catch((reason) => {
        if (active) setError(String(reason));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [projectId, clipTimingKey]);
  async function save(next: PresentationCue[]) {
    if (busy) return false;
    setBusy(true);
    try {
      const text = JSON.stringify({ version: 1, segments: next }, null, 2) + "\n";
      await files.writeProjectFile(CUE_FILE, text, source.current ?? undefined);
      source.current = text;
      setCues(next);
      setError("");
      return true;
    } catch (reason) {
      setError(String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }
  function markEnd() {
    if (!pending) return;
    const cue = {
      id: crypto.randomUUID(),
      label: t("presentation.segment", { number: cues.length + 1 }),
      start: pending,
      end: anchorAt(liveTime.latest(), clips),
    };
    if (!resolveCue(cue, clips, duration)) {
      shell.showToast(t("presentation.invalidRange"), "error");
      return;
    }
    void save([...cues, cue]).then((saved) => {
      if (!saved) return;
      setSelected(cue.id);
      setPending(null);
    });
  }
  const disabled =
    preparing || busy || !!error || !!shell.writeBlockedReason || timelineDisabled || !master;
  const button =
    "rounded px-2 py-1 text-xs hover:bg-white/15 disabled:opacity-40 whitespace-nowrap";
  if (playback.session) {
    const state = playback.session;
    const current = playable[state.index];
    const finished = state.phase === "ended" && state.index === playable.length - 1;
    return (
      <div data-presentation-mode="true" className="absolute inset-0 z-[100] flex flex-col">
        {playback.fullscreenUnavailable && (
          <p role="status" className="bg-black/85 px-4 py-2 text-center text-sm text-white">
            {t("presentation.fullscreenUnavailable")}
          </p>
        )}
        <button
          className="flex-1 cursor-default"
          aria-label={t("presentation.next")}
          onClick={playback.advance}
        />
        <div className="flex items-center justify-center gap-3 bg-black/85 p-2 text-white text-xs">
          <button className={button} onClick={playback.previous}>
            {t("presentation.previous")}
          </button>
          <span>
            {current?.cue.label} ·{" "}
            {state.phase === "running"
              ? t("presentation.running")
              : finished
                ? t("presentation.finished")
                : t("presentation.waiting")}
          </span>
          <button
            className={button}
            disabled={finished || state.phase === "running"}
            onClick={playback.advance}
          >
            {state.phase === "running" ? t("presentation.running") : t("presentation.next")}
          </button>
          <span>{t("presentation.keys")}</span>
          <button className={button} onClick={playback.exit}>
            {t("presentation.exit")}
          </button>
        </div>
      </div>
    );
  }
  if (browsing)
    return (
      <PresentationBrowser
        ranges={playable}
        initialSelection={browserSelection}
        onSelectionChange={setBrowserSelection}
        onClose={() => {
          pause();
          onBrowseChange(false);
        }}
        onPresent={playback.enter}
      />
    );
  const toolbar = (
    <div
      data-presentation-controls="true"
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      className={
        toolbarSlot ? "hf-presentation-toolbar" : "border-t border-white/10 px-2 py-1 text-white"
      }
    >
      <div className="flex items-center gap-1 flex-wrap">
        <button
          className={button + " bg-emerald-700"}
          disabled={preparing || busy || !master || timelineDisabled || !!error}
          onClick={() => {
            pause();
            onBrowseChange(true);
          }}
        >
          {t("presentation.browseTitle")}
        </button>
        <select
          aria-label={t("presentation.segments")}
          className="max-w-64 bg-neutral-800 text-white text-xs rounded p-1"
          value={selected}
          disabled={preparing || busy || !master}
          onChange={(e) => {
            setSelected(e.target.value);
            const item = resolved.find((x) => x.cue.id === e.target.value);
            if (item?.range) {
              pause();
              seek(item.range.start);
            }
          }}
        >
          <option value="">{t("presentation.choose")}</option>
          {resolved.map(({ cue, range }) => (
            <option key={cue.id} value={cue.id}>
              {cue.label}
              {preparing
                ? ` · ${t("presentation.loading")}`
                : range
                  ? ` (${range.start.toFixed(2)}–${range.end.toFixed(2)}s)`
                  : ` · ${t("presentation.invalid")}`}
            </option>
          ))}
        </select>
        <button
          className={button + " bg-emerald-700"}
          disabled={disabled || playable.length === 0}
          onClick={playback.enterFromCurrentTime}
        >
          {t("presentation.play")}
        </button>
        <Menu
          aria-label={t("presentation.title")}
          align="end"
          trigger={
            <button className={button} title={pending ? t("presentation.pending") : undefined}>
              {t("presentation.title")} ▾{pending ? " •" : ""}
            </button>
          }
        >
          <MenuItem
            disabled={disabled}
            onClick={() => {
              pause();
              setPending(anchorAt(liveTime.latest(), clips));
            }}
          >
            {t("presentation.start")}
          </MenuItem>
          <MenuItem disabled={disabled || !pending} onClick={markEnd}>
            {t("presentation.end")}
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            disabled={disabled || !selected}
            onClick={() => {
              const cue = cues.find((c) => c.id === selected);
              if (!cue) return;
              const label = window.prompt(t("presentation.name"), cue.label);
              if (label?.trim())
                void save(cues.map((c) => (c.id === selected ? { ...c, label: label.trim() } : c)));
            }}
          >
            {t("presentation.rename")}
          </MenuItem>
          <MenuItem
            disabled={disabled || !selected}
            onClick={() =>
              void save(cues.filter((c) => c.id !== selected)).then(() => setSelected(""))
            }
          >
            {t("presentation.delete")}
          </MenuItem>
        </Menu>
      </div>
      {!master && <p className="text-xs text-neutral-400">{t("presentation.masterOnly")}</p>}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
  return toolbarSlot ? createPortal(toolbar, toolbarSlot) : toolbar;
}
