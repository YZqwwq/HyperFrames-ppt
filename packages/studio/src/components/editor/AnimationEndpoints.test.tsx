// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AnimationEndpoints } from "./AnimationEndpoints";
import { makeSelection } from "../../hooks/domSelectionTestHarness";
import { animationEndpointTarget } from "../../hooks/animationEndpointTarget";
import { usePlayerStore } from "../../player/store/playerStore";
import { t } from "../../i18n";

Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

it("keeps selection passive and switches between an explicit endpoint and whole motion", () => {
  const previous = usePlayerStore.getState();
  usePlayerStore.setState({ timelineReady: true, currentTime: 4, autoKeyframeEnabled: false });
  const element = makeSelection("dot", document.createElement("div"));
  const animation = {
    id: "move",
    method: "to" as const,
    targetSelector: "#dot",
    position: 2,
    duration: 4,
    properties: { x: 100 },
  };
  const seek = vi.fn();
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const click = (label: string) => {
    const button = Array.from(host.querySelectorAll("button")).find(
      (el) => el.textContent === label,
    );
    expect(button).toBeDefined();
    act(() => button!.click());
  };
  try {
    act(() =>
      root.render(<AnimationEndpoints element={element} animations={[animation]} onSeek={seek} />),
    );
    expect(seek).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().autoKeyframeEnabled).toBe(false);
    expect(usePlayerStore.getState().currentTime).toBe(4);
    click(t("animation.startState"));
    expect(seek).toHaveBeenLastCalledWith(2);
    expect(usePlayerStore.getState().autoKeyframeEnabled).toBe(true);
    expect(animationEndpointTarget(element, [animation], 2)).toBe(animation);
    click(t("animation.locateMiddle"));
    expect(seek.mock.lastCall?.[0]).toBeCloseTo(4, 4);
    expect(usePlayerStore.getState().autoKeyframeEnabled).toBe(false);
    expect(usePlayerStore.getState().activeKeyframePct).toBeNull();
    expect(animationEndpointTarget(element, [animation], 4)).toBeNull();
    seek.mockClear();
    click(t("animation.adjustWhole"));
    expect(seek).not.toHaveBeenCalled();
    expect(usePlayerStore.getState().autoKeyframeEnabled).toBe(false);
    expect(usePlayerStore.getState().activeKeyframePct).toBeNull();
    expect(animationEndpointTarget(element, [animation], 2)).toBeNull();
    expect(host.querySelector('[role="status"]')?.textContent).toBe(t("animation.scopeWhole"));
  } finally {
    act(() => root.unmount());
    host.remove();
    usePlayerStore.setState(previous, true);
  }
});
