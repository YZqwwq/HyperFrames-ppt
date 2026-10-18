import { expect, it } from "vitest";
import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import { pickPropertyAnimation } from "./pickPropertyAnimation";

const mixed = {
  id: "mixed",
  targetSelector: "#circle",
  method: "fromTo",
  position: 5.9,
  duration: 1.4,
  fromProperties: { x: 0, scale: 1 },
  properties: { x: -180.5, scale: 9.4375 },
} as GsapAnimation;
it("edits the existing mixed tween's scale instead of creating a second writer", () => {
  expect(pickPropertyAnimation([mixed], "#circle", "scale", 7.3)).toBe(mixed);
});
it("recognizes channels held inside percentage keyframes", () => {
  const keyframed = {
    ...mixed,
    properties: {},
    fromProperties: undefined,
    keyframes: {
      format: "percentage",
      keyframes: [{ percentage: 0, properties: { x: 0, scale: 1 } }],
    },
  } as GsapAnimation;
  expect(pickPropertyAnimation([keyframed], "#circle", "scale", 5.9)).toBe(keyframed);
});
it("does not put a new rotation channel into the position tween", () => {
  expect(pickPropertyAnimation([mixed], "#circle", "rotation", 5.9)).toBeUndefined();
});
