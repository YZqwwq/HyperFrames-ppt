import { useEffect, useRef, useState, type RefObject } from "react";
import { useNLEContext } from "../nle/NLEContext";
import { liveTime, usePlayerStore } from "../../player/store/playerStore";

export function useCuePlayback(
  stage: RefObject<HTMLDivElement | null>,
  ranges: { start: number; end: number; transition?: "cut" | "animate" }[],
) {
  const { play, pause, seek, projectId, timelineDisabled } = useNLEContext();
  const [session, setSession] = useState<{
    index: number;
    phase: "ready" | "running" | "ended";
  } | null>(null);
  const ref = useRef(session);
  ref.current = session;
  const options = useRef<{ loop: boolean; rate: number } | null>(null);
  const target = useRef<number | null>(null);
  function stopAt(time: number) {
    target.current = null;
    pause();
    seek(time);
  }
  function exit() {
    target.current = null;
    pause();
    setSession(null);
    ref.current = null;
    const saved = options.current;
    options.current = null;
    if (saved) {
      usePlayerStore.getState().setLoopEnabled(saved.loop);
      usePlayerStore.getState().setPlaybackRate(saved.rate);
    }
    if (document.fullscreenElement === stage.current) void document.exitFullscreen();
  }
  function advance() {
    const state = ref.current;
    if (!state) return;
    const range = ranges[state.index];
    if (!range) return;
    if (state.phase === "running") return;
    const index = state.phase === "ended" ? state.index + 1 : state.index;
    const next = ranges[index];
    if (!next) return;
    pause();
    if (next.transition === "cut") {
      if (!seek(next.end)) return;
      target.current = null;
      const ended = { index, phase: "ended" as const };
      ref.current = ended;
      setSession(ended);
      return;
    }
    if (!seek(next.start)) return;
    target.current = next.end;
    ref.current = { index, phase: "running" };
    setSession(ref.current);
    play();
  }
  function previous() {
    const state = ref.current;
    if (!state) return;
    if (state.phase === "running" || state.index === 0) {
      stopAt(ranges[state.index].start);
      ref.current = { ...state, phase: "ready" };
      setSession(ref.current);
    } else if (state.index > 0) {
      const index = state.index - 1;
      stopAt(ranges[index].end);
      ref.current = { index, phase: "ended" };
      setSession(ref.current);
    }
  }
  function enter(index: number, ended = false) {
    const range = ranges[index];
    if (!range || timelineDisabled) return;
    pause();
    if (!seek(ended ? range.end : range.start)) return;
    const store = usePlayerStore.getState();
    options.current = { loop: store.loopEnabled, rate: store.playbackRate };
    store.setLoopEnabled(false);
    store.setPlaybackRate(1);
    ref.current = { index, phase: ended ? "ended" : "ready" };
    setSession(ref.current);
    if (!stage.current?.matches(":popover-open"))
      void stage.current?.requestFullscreen?.().catch(() => {});
  }
  const actions = useRef({ advance, previous, exit });
  actions.current = { advance, previous, exit };
  const active = session !== null;
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const end = target.current;
      if (end !== null && liveTime.latest() >= end) {
        target.current = null;
        pause();
        seek(end);
        ref.current = ref.current ? { ...ref.current, phase: "ended" } : null;
        setSession(ref.current);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onKey = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (
        ![" ", "ArrowRight", "ArrowDown", "Enter", "ArrowLeft", "ArrowUp", "Escape"].includes(
          event.key,
        )
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.key === "Escape") actions.current.exit();
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") actions.current.previous();
      else actions.current.advance();
    };
    const fullscreen = () => {
      if (!document.fullscreenElement) actions.current.exit();
    };
    window.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", fullscreen);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKey, true);
      document.removeEventListener("fullscreenchange", fullscreen);
    };
  }, [active, pause, seek]);
  useEffect(() => {
    if (timelineDisabled && ref.current) actions.current.exit();
  }, [timelineDisabled]);
  useEffect(
    () => () => {
      if (ref.current) actions.current.exit();
    },
    [projectId],
  );
  return { session, enter, exit, advance, previous };
}
