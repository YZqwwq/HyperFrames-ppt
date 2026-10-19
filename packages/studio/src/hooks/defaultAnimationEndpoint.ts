import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import { resolveTweenDuration, resolveTweenStart } from "../utils/globalTimeCompiler";

/** Choose the nearest motion span, then its start before the midpoint or end from it onward. */
export function defaultAnimationEndpoint(
  runs: GsapAnimation[],
  time: number,
): { index: number; pct: 0 | 100 } | null {
  let choice: { index: number; pct: 0 | 100 } | null = null;
  let distance = Infinity;
  runs.forEach((run, index) => {
    const start = resolveTweenStart(run);
    const duration = resolveTweenDuration(run);
    if (start === null || duration <= 0) return;
    const gap = Math.max(start - time, time - start - duration, 0);
    if (gap >= distance) return;
    distance = gap;
    choice = { index, pct: time < start + duration / 2 ? 0 : 100 };
  });
  return choice;
}
