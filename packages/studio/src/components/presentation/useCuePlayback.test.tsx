// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useCuePlayback } from "./useCuePlayback";
import { liveTime, usePlayerStore } from "../../player/store/playerStore";
const { seek, pause, play } = vi.hoisted(() => ({
  seek: vi.fn(() => true),
  pause: vi.fn(),
  play: vi.fn(),
}));
vi.mock("../nle/NLEContext", () => ({
  useNLEContext: () => ({ seek, pause, play, projectId: "demo", timelineDisabled: false }),
}));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
it("ignores repeated advances and restores playback preferences on exit", () => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  let actions!: ReturnType<typeof useCuePlayback>;
  function Fixture() {
    actions = useCuePlayback({ current: null }, [
      { start: 1, end: 2 },
      { start: 3, end: 4, transition: "cut" },
    ]);
    return null;
  }
  usePlayerStore.getState().setLoopEnabled(true);
  usePlayerStore.getState().setPlaybackRate(2);
  try {
    act(() => root.render(<Fixture />));
    act(() => actions.enter(0));
    expect(usePlayerStore.getState().loopEnabled).toBe(false);
    act(() => {
      actions.advance();
      actions.advance();
    });
    expect(play).toHaveBeenCalledTimes(1);
    act(() => actions.previous());
    expect(seek).toHaveBeenLastCalledWith(1);
    expect(actions.session?.phase).toBe("ready");
    act(() => actions.exit());
    expect(usePlayerStore.getState().loopEnabled).toBe(true);
    expect(usePlayerStore.getState().playbackRate).toBe(2);
    act(() => actions.enter(1));
    act(() => actions.advance());
    expect(seek).toHaveBeenLastCalledWith(4);
    expect(actions.session?.phase).toBe("ended");
    expect(play).toHaveBeenCalledTimes(1);
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it.each([false, true])(
  "requests ancestor fullscreen from a popover (rejected: %s)",
  async (reject) => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    const stage = document.createElement("div");
    stage.setAttribute("popover", "manual");
    const request = vi.fn(() => (reject ? Promise.reject(new Error("denied")) : Promise.resolve()));
    const original = Object.getOwnPropertyDescriptor(document.documentElement, "requestFullscreen");
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: request,
    });
    let actions!: ReturnType<typeof useCuePlayback>;
    function Fixture() {
      actions = useCuePlayback({ current: stage }, [{ start: 1, end: 2 }]);
      return null;
    }
    try {
      act(() => root.render(<Fixture />));
      await act(async () => actions.enter(0));
      expect(request).toHaveBeenCalledTimes(1);
      expect(actions.session?.phase).toBe("ready");
      expect(actions.fullscreenUnavailable).toBe(reject);
      act(() => document.dispatchEvent(new Event("fullscreenchange")));
      expect(actions.session === null).toBe(!reject);
      act(() => actions.exit());
      expect(actions.fullscreenUnavailable).toBe(false);
    } finally {
      act(() => root.unmount());
      host.remove();
      if (original) Object.defineProperty(document.documentElement, "requestFullscreen", original);
      else Reflect.deleteProperty(document.documentElement, "requestFullscreen");
    }
  },
);

it.each([
  { time: 0, index: 0, phase: "ready", nextTime: 1 },
  { time: 8, index: 0, phase: "ended", nextTime: 8 },
  { time: 8.1, index: 1, phase: "ready", nextTime: 8.1 },
  { time: 95, index: 1, phase: "ready", nextTime: 95 },
  { time: 96, index: 1, phase: "ended", nextTime: 112 },
  { time: 100, index: 1, phase: "ended", nextTime: 112 },
  { time: 112, index: 2, phase: "ended", nextTime: 112 },
])(
  "presents the current time $time and advances from its segment",
  ({ time, index, phase, nextTime }) => {
    const host = document.body.appendChild(document.createElement("div"));
    const root = createRoot(host);
    let actions!: ReturnType<typeof useCuePlayback>;
    function Fixture() {
      actions = useCuePlayback({ current: null }, [
        { start: 1, end: 8 },
        { start: 8, end: 96 },
        { start: 104, end: 112, transition: "cut" },
      ]);
      return null;
    }
    try {
      act(() => root.render(<Fixture />));
      // The latest playhead can change without a React render or cue selection.
      liveTime.notify(time);
      act(() => actions.enterFromCurrentTime());
      expect(seek).toHaveBeenLastCalledWith(time);
      expect(actions.session).toEqual({ index, phase });
      act(() => actions.advance());
      expect(seek).toHaveBeenLastCalledWith(nextTime);
      if (time === 95) {
        act(() => actions.previous());
        expect(seek).toHaveBeenLastCalledWith(8);
        act(() => actions.advance());
        expect(seek).toHaveBeenLastCalledWith(8);
      }
    } finally {
      act(() => root.unmount());
      host.remove();
      liveTime.notify(0);
    }
  },
);
