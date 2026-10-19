import { expect, it } from "vitest";
import { tween } from "./gsapParsedTween.test-helpers";
import { defaultAnimationEndpoint } from "./defaultAnimationEndpoint";
import { resizeRoute } from "./gsapResizePreflight";

const grow = tween({ position: 2, duration: 1, properties: { x: 100, scale: 16 } });
const shrink = tween({ position: 14, duration: 1, properties: { x: -50, scale: 2 } });
it.each([
  [0, 0, 0],
  [2.4, 0, 0],
  [2.5, 0, 100],
  [3, 0, 100],
  [13, 1, 0],
  [15, 1, 100],
])("selects the nearest motion and endpoint at %s seconds", (time, index, pct) => {
  expect(defaultAnimationEndpoint([grow, shrink], time)).toEqual({ index, pct });
});
it("routes mixed position/scale tweens through scale without changing the shared CSS size", () => {
  expect(resizeRoute([grow], []).resizeGroup).toBe("scale");
  expect(
    resizeRoute(
      [],
      [
        {
          ...grow,
          properties: {},
          keyframes: {
            format: "percentage",
            keyframes: [
              { percentage: 0, properties: { x: 0, scale: 1 } },
              { percentage: 100, properties: { x: 100, scale: 16 } },
            ],
          },
        },
      ],
    ).resizeGroup,
  ).toBe("scale");
});

it.each([0, 50, 100])("keeps other poses independent when editing scale at %s%%", async (pct) => {
  const { planValueAtPlayhead } = await import("./gsapValueAtPlayhead");
  const anim = tween({
    id: "grow",
    position: 0,
    propertyGroup: undefined,
    method: "fromTo",
    duration: 1,
    ease: "none",
    fromProperties: { x: 0, scale: 1 },
    properties: { x: 100, scale: 16 },
  });
  const plan = planValueAtPlayhead({
    anim,
    at: { percentage: pct },
    values: { scale: 2 },
    implicitEndValue: () => null,
  });
  expect(plan.ok).toBe(true);
  if (!plan.ok) return;
  const frames = plan.mutation.keyframes;
  expect(frames.find((f) => f.percentage === pct)?.properties.scale).toBe(2);
  if (pct !== 0) expect(frames.find((f) => f.percentage === 0)?.properties.scale).toBe(1);
  if (pct !== 100) expect(frames.find((f) => f.percentage === 100)?.properties.scale).toBe(16);
  expect(anim.properties.scale).toBe(16);
  expect(anim.fromProperties?.scale).toBe(1);
});
