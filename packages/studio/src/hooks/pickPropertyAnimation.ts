import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import { classifyPropertyGroup } from "@hyperframes/core/gsap-parser";

/** A mixed authored tween still owns its individual channels. Do not add a competing tween. */
export function pickPropertyAnimation(
  animations: GsapAnimation[],
  selector: string | null,
  property: string,
  currentTime: number,
): GsapAnimation | undefined {
  const group = classifyPropertyGroup(property);
  const candidates = animations.filter(
    (a) =>
      a.propertyGroup === group ||
      (!a.propertyGroup &&
        (Object.hasOwn(a.properties, property) ||
          Object.hasOwn(a.fromProperties ?? {}, property) ||
          a.keyframes?.keyframes.some((k) => Object.hasOwn(k.properties, property)))),
  );
  return candidates
    .map((anim) => {
      const start = anim.resolvedStart ?? (typeof anim.position === "number" ? anim.position : 0);
      const duration = anim.duration ?? 0;
      const score =
        (anim.keyframes ? 10 : 0) +
        (selector === anim.targetSelector ? 5 : 0) +
        (currentTime >= start - 0.05 && currentTime <= start + duration + 0.05 ? 8 : 0);
      return { anim, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.anim;
}
