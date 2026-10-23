// @vitest-environment happy-dom
import { gsap } from "gsap";
import { afterEach, expect, it } from "vitest";
import { parseGsapScriptAcorn } from "@hyperframes/parsers/gsap-parser-acorn";
import { replaceTweenWithKeyframesInScript } from "@hyperframes/parsers/gsap-writer-acorn";
import { makeSelection } from "../../hooks/domSelectionTestHarness";
import {
  intermediateStop,
  planIntermediateKeyframe,
  sampledPercentage,
} from "./planIntermediateKeyframe";

const source = 'tl.fromTo("#dot", { x: 20 }, { x: 120, duration: 4, ease: "none" }, 2);';
afterEach(() => {
  document.body.replaceChildren();
  gsap.globalTimeline.clear();
});

it("inserts a sampled pose with unchanged endpoints and timing and roundtrips through the writer", () => {
  const iframe = document.body.appendChild(document.createElement("iframe"));
  const doc = iframe.contentDocument!;
  const element = doc.body.appendChild(doc.createElement("div"));
  element.id = "dot";
  const timeline = gsap
    .timeline({ paused: true })
    .fromTo(element, { x: 20 }, { x: 120, duration: 4, ease: "none" }, 2);
  Reflect.set(iframe.contentWindow!, "gsap", gsap);
  Reflect.set(iframe.contentWindow!, "__timelines", { main: timeline });
  timeline.seek(4);
  const animation = parseGsapScriptAcorn(source).animations[0]!;
  expect(intermediateStop(animation, 50)).toBeUndefined();
  const plan = planIntermediateKeyframe(makeSelection("dot", element), animation, 50, 4, iframe);
  expect(plan.mutation.position).toBe(2);
  expect(plan.mutation.duration).toBe(4);
  expect(plan.mutation.keyframes.map((stop) => [stop.percentage, stop.properties.x])).toEqual([
    [0, 20],
    [50, 70],
    [100, 120],
  ]);
  const written = replaceTweenWithKeyframesInScript(source, animation.id, plan.mutation)!;
  const saved = parseGsapScriptAcorn(written).animations[0]!;
  expect(intermediateStop(saved, 50)?.properties.x).toBe(70);
  expect(() =>
    planIntermediateKeyframe(makeSelection("dot", element), saved, 50, 4, iframe),
  ).toThrow();
});

it("refuses to insert without a live sample", () => {
  const animation = parseGsapScriptAcorn(source).animations[0]!;
  expect(() =>
    planIntermediateKeyframe(
      makeSelection("dot", document.createElement("div")),
      animation,
      50,
      4,
      null,
    ),
  ).toThrow();
});

it("does not mistake a flat tween or an arbitrary sample for an authored stop", () => {
  const animation = parseGsapScriptAcorn(source).animations[0]!;
  expect(intermediateStop(animation, 50)).toBeUndefined();
  const keyed = parseGsapScriptAcorn(
    'tl.to("#dot", { duration: 4, keyframes: { "0%": { x: 0 }, "50%": { x: 70 }, "100%": { x: 120 } } }, 2);',
  ).animations[0]!;
  expect(intermediateStop(keyed, 25)).toBeUndefined();
  expect(intermediateStop(keyed, 50)?.percentage).toBe(50);
});

it("aligns samples to the frame actually shown and refuses a stale seek", () => {
  const iframe = document.body.appendChild(document.createElement("iframe"));
  const element = iframe.contentDocument!.body.appendChild(
    iframe.contentDocument!.createElement("div"),
  );
  const selection = makeSelection("dot", element);
  const animation = parseGsapScriptAcorn(source).animations[0]!;
  Reflect.set(iframe.contentWindow!, "__player", { getTime: () => 4 / 30 + 2 });
  expect(sampledPercentage(selection, animation, iframe, 2.15)).toBe(3.333);
  expect(sampledPercentage(selection, animation, iframe, 4)).toBeNull();
});
