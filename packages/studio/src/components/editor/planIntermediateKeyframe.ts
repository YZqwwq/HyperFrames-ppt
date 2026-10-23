import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import type { DomEditSelection } from "./domEditingTypes";
import { planValueEdit, type PlayheadEditPlan } from "../../hooks/gsapValueAtPlayhead";
import {
  directEditOutcomeForProperties,
  assertGsapEditPersisted,
} from "../../hooks/gsapEditOutcome";
import { selectionTimeOffset } from "../../hooks/selectionClock";
import { KEYFRAME_PCT_MATCH } from "../../hooks/gsapShared";
import { absoluteToPercentageForAnimation } from "../../utils/globalTimeCompiler";
import { t } from "../../i18n";

/** Source stops only: a sampled pose is never an authored keyframe. */
export function intermediateStop(animation: GsapAnimation, percentage: number) {
  return animation.keyframes?.keyframes.find(
    (stop) => Math.abs(stop.percentage - percentage) <= KEYFRAME_PCT_MATCH,
  );
}

/** The runtime quantizes seeks to output frames; store the frame actually shown. */
export function sampledPercentage(
  selection: DomEditSelection,
  animation: GsapAnimation,
  iframe: HTMLIFrameElement | null,
  requestedTime: number,
): number | null {
  const runtime = iframe?.contentWindow && Reflect.get(iframe.contentWindow, "__player");
  const rendered: unknown =
    typeof runtime?.getTime === "function" ? runtime.getTime() : requestedTime;
  if (
    typeof rendered !== "number" ||
    !Number.isFinite(rendered) ||
    Math.abs(rendered - requestedTime) > 0.05
  )
    return null;
  const pct = absoluteToPercentageForAnimation(
    rendered - selectionTimeOffset(selection),
    animation,
  );
  return pct === null ? null : Math.round(pct * 1000) / 1000;
}

export function planIntermediateKeyframe(
  selection: DomEditSelection,
  animation: GsapAnimation,
  percentage: number,
  time: number,
  iframe: HTMLIFrameElement | null,
): Extract<PlayheadEditPlan, { ok: true }> {
  if (
    !Number.isFinite(percentage) ||
    percentage <= 0 ||
    percentage >= 100 ||
    intermediateStop(animation, percentage)
  )
    throw new Error(t("animation.keyAlreadyExists"));
  const props = new Set([
    ...Object.keys(animation.properties),
    ...Object.keys(animation.fromProperties ?? {}),
    ...(animation.keyframes?.keyframes.flatMap((stop) => Object.keys(stop.properties)) ?? []),
  ]);
  assertGsapEditPersisted(directEditOutcomeForProperties([animation], props));
  if (
    !selection.element.isConnected ||
    !iframe?.contentWindow ||
    selection.element.ownerDocument !== iframe.contentDocument
  )
    throw new Error(t("animation.sampleUnavailable"));
  const actual = sampledPercentage(selection, animation, iframe, time);
  if (actual === null || Math.abs(actual - percentage) > 0.002)
    throw new Error(t("animation.sampleUnavailable"));
  const gsap = Reflect.get(iframe.contentWindow, "gsap");
  if (!gsap || typeof gsap.getProperty !== "function" || !props.size)
    throw new Error(t("animation.sampleUnavailable"));
  const values: Record<string, number> = {};
  for (const property of props) {
    const value: unknown = gsap.getProperty(selection.element, property);
    if (typeof value !== "number" || !Number.isFinite(value))
      throw new Error(t("animation.sampleUnsupported"));
    values[property] = value;
  }
  const plan = planValueEdit(selection, animation, values, iframe, {
    moment: { time: time - selectionTimeOffset(selection), keyframePct: percentage },
  });
  if (!plan.ok) throw new Error(`${t("animation.insertUnsupported")} (${plan.reason})`);
  if (!plan.added) throw new Error(t("animation.keyAlreadyExists"));
  return plan;
}
