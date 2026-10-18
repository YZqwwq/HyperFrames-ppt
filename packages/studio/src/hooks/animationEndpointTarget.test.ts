// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import type { DomEditSelection } from "../components/editor/domEditingTypes";
import { usePlayerStore } from "../player/store/playerStore";
import { tween } from "./gsapParsedTween.test-helpers";
import {
  animationEndpointTarget,
  setAnimationEndpointTarget,
  clearAnimationEndpointTarget,
} from "./animationEndpointTarget";
import { resolveGroupTween } from "./gsapRuntimeBridge";
import { planValueAtPlayhead } from "./gsapValueAtPlayhead";

const selection = {
  element: document.createElement("div"),
  sourceFile: "circle.html",
  id: "box",
  selector: "#box",
} as DomEditSelection;
const grow = tween({
  id: "grow",
  method: "fromTo",
  position: 2.1,
  duration: 0.8,
  ease: "none",
  fromProperties: { x: 90, y: 2 },
  properties: { x: -166, y: 211 },
});
const overlap = tween({ id: "overlap", position: 2.1, duration: 13.85, properties: { x: -1010 } });
afterEach(() => {
  clearAnimationEndpointTarget(selection.element);
  usePlayerStore.setState({ activeKeyframePct: null });
});

it.each([0, 100])(
  "keeps the selected segment at endpoint %s despite overlapping position writers",
  async (pct) => {
    usePlayerStore.setState({ activeKeyframePct: pct });
    setAnimationEndpointTarget(selection, grow, pct);
    const time = 2.1 + (0.8 * pct) / 100;
    const result = await resolveGroupTween(
      "position",
      [overlap, grow],
      selection,
      vi.fn(),
      undefined,
      time,
    );
    expect(result?.anim).toBe(grow);
    const plan = planValueAtPlayhead({
      anim: result!.anim,
      at: { percentage: pct },
      values: { x: 123 },
      implicitEndValue: () => null,
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.mutation.keyframes.find((k) => k.percentage === pct)?.properties.x).toBe(123);
      expect(plan.mutation.keyframes.find((k) => k.percentage === 100 - pct)?.properties.x).toBe(
        pct === 0 ? -166 : 90,
      );
    }
  },
);
it("does not retain endpoint ownership after seeking or changing the source", () => {
  usePlayerStore.setState({ activeKeyframePct: 0 });
  setAnimationEndpointTarget(selection, grow, 0);
  expect(animationEndpointTarget(selection, [grow], 10)).toBeNull();
  expect(
    animationEndpointTarget({ ...selection, sourceFile: "other.html" }, [grow], 2.1),
  ).toBeNull();
});
it("survives conversion to keyframes but refuses an ambiguous replacement", () => {
  usePlayerStore.setState({ activeKeyframePct: 0 });
  setAnimationEndpointTarget(selection, grow, 0);
  const converted = { ...grow, id: "converted", method: "to" as const };
  expect(animationEndpointTarget(selection, [converted], 2.1)).toBe(converted);
  expect(() =>
    animationEndpointTarget(selection, [converted, { ...converted, id: "other" }], 2.1),
  ).toThrow();
});
