// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import type { DomEditSelection } from "../components/editor/domEditingTypes";
import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import { selectionTimeOffset } from "./selectionClock";
import { editMoment } from "./editMoment";
import { parkPlayheadOnKeyframe } from "./gsapDragCommit";
import { commitValueAtPlayhead, planValueEdit } from "./gsapValueAtPlayhead";
import { usePlayerStore } from "../player/store/playerStore";

const animation = {
  id: "circle",
  targetSelector: "#circle",
  method: "fromTo",
  resolvedStart: 5.9,
  position: 5.9,
  duration: 1.4,
  ease: "power2.inOut",
  fromProperties: { x: 0, y: 0, scale: 1 },
  properties: { x: -180.5, y: 197.589, scale: 9.4375 },
} as GsapAnimation;
function selection(master = true) {
  document.body.innerHTML = master
    ? '<div data-composition-file="slides/08.html" data-start="56"><div id="circle"></div></div>'
    : '<div id="circle"></div>';
  return {
    element: document.getElementById("circle"),
    id: "circle",
    sourceFile: "slides/08.html",
  } as DomEditSelection;
}
afterEach(() => {
  document.body.replaceChildren();
  usePlayerStore.setState({ currentTime: 0, activeKeyframePct: null });
});

it("maps a master playhead into the selected source, without mutating the frozen gesture", () => {
  const sel = selection();
  const stamp = { origX: 0, origY: 0, baseX: 0, baseY: 0, at: { time: 61.9, keyframePct: 0 } };
  expect(editMoment(stamp, sel).time).toBeCloseTo(5.9);
  expect(stamp.at.time).toBe(61.9);
  expect(editMoment(stamp, sel).keyframePct).toBe(0);
});
it("does not subtract the master mount again when editing a page directly", () => {
  const sel = selection(false);
  usePlayerStore.setState({ currentTime: 5.9 });
  expect(editMoment(undefined, sel).time).toBe(5.9);
});
it("sums nested source mounts but excludes the child clip's own start", () => {
  document.body.innerHTML =
    '<div data-composition-file="page.html" data-start="56"><div data-composition-file="group.html" data-start="2"><div id="circle" data-start="1"></div></div></div>';
  expect(
    selectionTimeOffset({ element: document.getElementById("circle")!, sourceFile: "group.html" }),
  ).toBe(58);
});
it("seeks back to the master endpoint after saving", () => {
  const sel = selection();
  parkPlayheadOnKeyframe(animation, 100, sel);
  expect(usePlayerStore.getState().requestedSeekTime).toBe(63.3);
});
it("an endpoint edit preserves duration, easing and the opposite endpoint", () => {
  const sel = selection();
  usePlayerStore.setState({ currentTime: 63.3, activeKeyframePct: 100 });
  const plan = planValueEdit(sel, animation, { x: -160 }, null);
  expect(plan.ok).toBe(true);
  if (!plan.ok) return;
  expect(plan.mutation.duration).toBe(1.4);
  expect(plan.mutation.position).toBe(5.9);
  expect(plan.mutation.easeEach).toBe("power2.inOut");
  expect(plan.mutation.keyframes[0].properties.x).toBe(0);
  expect(plan.mutation.keyframes.at(-1)?.properties.x).toBe(-160);
});

it("successive endpoint saves keep the selected point and do not add nodes", async () => {
  const sel = selection();
  usePlayerStore.setState({ currentTime: 58, activeKeyframePct: 0 });
  for (const x of [10, 20]) {
    await commitValueAtPlayhead(
      sel,
      animation,
      { x },
      null,
      {
        commitMutation: async (_selection, mutation) => {
          expect(mutation).toMatchObject({
            type: "replace-with-keyframes",
            position: 5.9,
            duration: 1.4,
            keyframes: [
              { percentage: 0, properties: { x } },
              { percentage: 100, properties: { x: -180.5 } },
            ],
          });
        },
      },
      { label: "Move start" },
    );
    expect(usePlayerStore.getState().activeKeyframePct).toBe(0);
  }
});
