import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import type { DomEditSelection } from "../components/editor/domEditingTypes";
import { resolveTweenStart, resolveTweenDuration } from "../utils/globalTimeCompiler";
import { usePlayerStore } from "../player/store/playerStore";
import { GsapEditBlockedError } from "./gsapEditOutcome";

type Target = {
  file: string;
  id: string;
  selector: string;
  start: number;
  duration: number;
  pct: number;
};
const targets = new WeakMap<HTMLElement, Target>();

export function setAnimationEndpointTarget(
  selection: DomEditSelection,
  animation: GsapAnimation,
  pct: number,
) {
  targets.set(selection.element, {
    file: selection.sourceFile,
    id: animation.id,
    selector: animation.targetSelector,
    start: resolveTweenStart(animation) ?? 0,
    duration: resolveTweenDuration(animation),
    pct,
  });
}
export function clearAnimationEndpointTarget(element: HTMLElement) {
  targets.delete(element);
}

/** An explicit endpoint wins over playhead heuristics, including overlapping tweens. */
export function animationEndpointTarget(
  selection: DomEditSelection,
  animations: GsapAnimation[],
  time?: number,
): GsapAnimation | null {
  const target = targets.get(selection.element);
  if (
    !target ||
    target.file !== selection.sourceFile ||
    usePlayerStore.getState().activeKeyframePct !== target.pct
  )
    return null;
  const at = target.start + (target.duration * target.pct) / 100;
  if (time !== undefined && Math.abs(time - at) > 0.06) return null;
  const exact = animations.find((a) => a.id === target.id && a.targetSelector === target.selector);
  if (exact) return exact;
  // Converting a flat tween to keyframes changes its method/id, but not its authored span.
  const sameSpan = animations.filter(
    (a) =>
      a.targetSelector === target.selector &&
      Math.abs((resolveTweenStart(a) ?? 0) - target.start) < 0.001 &&
      Math.abs(resolveTweenDuration(a) - target.duration) < 0.001 &&
      a.method !== "set",
  );
  if (sameSpan.length === 1) return sameSpan[0]!;
  throw new GsapEditBlockedError("source-uneditable");
}
