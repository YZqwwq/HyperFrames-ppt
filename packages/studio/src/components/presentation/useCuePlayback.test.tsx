// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { useCuePlayback } from "./useCuePlayback";
import { usePlayerStore } from "../../player/store/playerStore";
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
