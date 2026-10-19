import { defaultAnimationEndpoint } from "../../hooks/defaultAnimationEndpoint";
import {
  setAnimationEndpointTarget,
  clearAnimationEndpointTarget,
} from "../../hooks/animationEndpointTarget";
import { MotionDependencyNotice } from "./MotionDependencyNotice";
import { MotionTimingEditor } from "./MotionTimingEditor";
import type { GsapAnimationEditCallbacks } from "./gsapAnimationCallbacks";
import { useEffect, useRef, useState } from "react";
import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import type { DomEditSelection } from "./domEditingTypes";
import { liveTime, usePlayerStore } from "../../player/store/playerStore";
import { selectionTimeOffset } from "../../hooks/selectionClock";
import {
  percentageToAbsoluteForAnimation,
  resolveTweenDuration,
  resolveTweenStart,
} from "../../utils/globalTimeCompiler";
import { t } from "../../i18n";
import { useNLEContextOptional } from "../nle/NLEContext";
import { afterStudioPendingEdits } from "../../utils/studioPendingEdits";

/** Explicit endpoint editing; the existing geometry controls and canvas write the selected pose. */
export function AnimationEndpoints({
  element,
  animations,
  onSeek,
  onChoose,
  onUpdateMeta,
  onSetAllKeyframeEases,
}: {
  element: DomEditSelection;
  animations: GsapAnimation[];
  onSeek?: (time: number) => void;
  onChoose?: () => void;
  onUpdateMeta?: GsapAnimationEditCallbacks["onUpdateMeta"];
  onSetAllKeyframeEases?: GsapAnimationEditCallbacks["onSetAllKeyframeEases"];
}) {
  const player = useNLEContextOptional();
  const runs = animations.filter(
    (a) => !a.global && a.method !== "set" && resolveTweenDuration(a) > 0,
  );
  const [index, setIndex] = useState(0);
  const [previewing, setPreviewing] = useState(false);
  const [middlePct, setMiddlePct] = useState(50);
  const initialized = useRef<HTMLElement | null>(null);
  const active = usePlayerStore((s) => s.activeKeyframePct);
  const time = usePlayerStore((s) => s.currentTime);
  const ready = usePlayerStore((s) => s.timelineReady);
  const target = useRef<number | null>(null);
  const pendingChoice = useRef<(() => void) | null>(null);
  const run = runs[index] ?? runs[0];
  const offset = selectionTimeOffset(element);
  const start = (run ? (resolveTweenStart(run) ?? 0) : 0) + offset;
  const end = start + (run ? resolveTweenDuration(run) : 0);
  const seek = (at: number) =>
    player ? player.seek(at) : onSeek ? onSeek(at) : usePlayerStore.getState().requestSeek(at);
  const pause = () => (player ? player.pause() : usePlayerStore.getState().requestPlayback(false));
  const pauseRef = useRef(pause);
  pauseRef.current = pause;
  const playRef = useRef(() =>
    player ? player.play() : usePlayerStore.getState().requestPlayback(true),
  );
  playRef.current = () =>
    player ? player.play() : usePlayerStore.getState().requestPlayback(true);
  const seekRef = useRef(seek);
  seekRef.current = seek;
  useEffect(() => {
    setIndex(0);
    setPreviewing(false);
    usePlayerStore.getState().setActiveKeyframePct(null);
    return () => {
      initialized.current = null;
      pendingChoice.current?.();
      clearAnimationEndpointTarget(element.element);
      if (target.current !== null) pauseRef.current();
      target.current = null;
    };
  }, [element.sourceFile, element.id, element.element]);
  useEffect(() => {
    if (!previewing || !ready) return;
    let frame = 0;
    const tick = () => {
      if (target.current !== null && liveTime.latest() >= target.current) {
        pauseRef.current();
        seekRef.current(target.current);
        target.current = null;
        usePlayerStore.getState().setActiveKeyframePct(100);
        setPreviewing(false);
      } else frame = requestAnimationFrame(tick);
    };
    const cancelWaiting = afterStudioPendingEdits(() => {
      seekRef.current(start);
      frame = requestAnimationFrame(() => {
        playRef.current();
        frame = requestAnimationFrame(tick);
      });
    });
    return () => {
      cancelWaiting();
      cancelAnimationFrame(frame);
    };
  }, [previewing, ready, start]);
  useEffect(() => {
    if (
      !ready ||
      !runs.length ||
      initialized.current === element.element ||
      !element.capabilities.canEditStyles
    )
      return;
    const choice = defaultAnimationEndpoint(runs, usePlayerStore.getState().currentTime - offset);
    if (!choice) return;
    initialized.current = element.element;
    const chosen = runs[choice.index]!;
    setIndex(choice.index);
    pauseRef.current();
    pendingChoice.current = afterStudioPendingEdits(() => {
      seekRef.current(
        (resolveTweenStart(chosen) ?? 0) +
          offset +
          (resolveTweenDuration(chosen) * choice.pct) / 100,
      );
      const store = usePlayerStore.getState();
      store.setAutoKeyframeEnabled(true);
      store.setActiveKeyframePct(choice.pct);
      setAnimationEndpointTarget(element, chosen, choice.pct);
    });
  }, [ready, runs, element, offset]);
  if (!run || !element.capabilities.canEditStyles) return null;
  const choose = (pct: number) => {
    target.current = null;
    setPreviewing(false);
    const store = usePlayerStore.getState();
    pause();
    pendingChoice.current?.();
    pendingChoice.current = afterStudioPendingEdits(() => {
      seek(
        (percentageToAbsoluteForAnimation(pct, run) ??
          start - offset + ((end - start) * pct) / 100) + offset,
      );
      store.setAutoKeyframeEnabled(true);
      store.setActiveKeyframePct(pct);
      setAnimationEndpointTarget(element, run, pct);
      onChoose?.();
    });
  };
  const preview = () => {
    if (previewing) {
      choose(100);
      return;
    }
    pendingChoice.current?.();
    clearAnimationEndpointTarget(element.element);
    const store = usePlayerStore.getState();
    store.setActiveKeyframePct(null);
    pause();
    seek(start);
    target.current = end;
    setPreviewing(true);
  };
  return (
    <section
      className="shrink-0 max-h-[65%] overflow-y-auto border-b border-panel-hairline p-3"
      data-animation-endpoints
    >
      <div className="mb-2 text-sm font-medium">{t("animation.states")}</div>
      {runs.length > 1 && (
        <select
          className="mb-2 w-full bg-panel-bg"
          aria-label={t("animation.segment")}
          value={index}
          onChange={(e) => {
            pendingChoice.current?.();
            clearAnimationEndpointTarget(element.element);
            setIndex(Number(e.target.value));
            usePlayerStore.getState().setActiveKeyframePct(null);
          }}
        >
          {runs.map((a, i) => (
            <option key={a.id} value={i}>
              {i + 1} · {a.propertyGroup ?? a.method} · {resolveTweenStart(a)}s
            </option>
          ))}
        </select>
      )}
      <MotionDependencyNotice
        file={element.sourceFile}
        selector={run.targetSelector}
        ordinal={animations
          .filter((a) => !a.global && a.targetSelector === run.targetSelector)
          .findIndex((a) => a.id === run.id)}
      />
      <MotionTimingEditor
        key={run.id}
        animation={run}
        offset={offset}
        onUpdateMeta={onUpdateMeta}
        onSetAllKeyframeEases={onSetAllKeyframeEases}
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded border border-panel-hairline px-3 py-2 aria-pressed:bg-emerald-100"
          aria-pressed={active === 0 && Math.abs(time - start) < 0.1}
          onClick={() => choose(0)}
        >
          {t("animation.startState")}
        </button>
        <button
          className="rounded border border-panel-hairline px-3 py-2 aria-pressed:bg-emerald-100"
          aria-pressed={active === 100 && Math.abs(time - end) < 0.1}
          onClick={() => choose(100)}
        >
          {t("animation.endState")}
        </button>
        <button className="rounded border border-panel-hairline px-3 py-2" onClick={preview}>
          {previewing ? t("animation.stopPreview") : t("animation.preview")}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={99}
          step={1}
          value={middlePct}
          aria-label={t("animation.middlePercent")}
          className="w-16 rounded border border-panel-hairline px-2 py-1"
          onChange={(event) =>
            setMiddlePct(Math.min(99, Math.max(1, Number(event.target.value) || 50)))
          }
        />
        <span>%</span>
        <button
          className="rounded border border-panel-hairline px-3 py-2"
          onClick={() => choose(middlePct)}
        >
          {t("animation.middleState")}
        </button>
      </div>
      <p className="mt-2 text-xs text-panel-text-2">{t("animation.endpointHint")}</p>
    </section>
  );
}
