import { useState } from "react";
import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import type { GsapAnimationEditCallbacks } from "./gsapAnimationCallbacks";
import { resolveTweenDuration, resolveTweenStart } from "../../utils/globalTimeCompiler";
import { MetricField } from "./propertyPanelPrimitives";
import { t } from "../../i18n";
import {
  compileMotionExpression,
  MOTION_SPEEDS,
  readMotionSpeeds,
  saveMotionSpeeds,
} from "./motionSpeed";

const speedLabels = () => ({
  "motion.linear": t("motion.linear"),
  "motion.both": t("motion.both"),
  "motion.in": t("motion.in"),
  "motion.out": t("motion.out"),
});

export function MotionTimingEditor({
  animation,
  offset,
  onUpdateMeta,
  onSetAllKeyframeEases,
}: {
  animation: GsapAnimation;
  offset: number;
  onUpdateMeta?: GsapAnimationEditCallbacks["onUpdateMeta"];
  onSetAllKeyframeEases?: GsapAnimationEditCallbacks["onSetAllKeyframeEases"];
}) {
  const [presets, setPresets] = useState(readMotionSpeeds);
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("t => t * t * (3 - 2 * t)");
  const [error, setError] = useState("");
  const duration = resolveTweenDuration(animation);
  const start = resolveTweenStart(animation);
  const ease = animation.keyframes?.easeEach ?? animation.ease ?? "power1.out";
  const mixed = animation.keyframes?.keyframes.some((k) => k.ease && k.ease !== ease);
  const builtIn = MOTION_SPEEDS.find(
    (p) => p.ease === ease || (p.ease === "none" && ease === "linear"),
  );
  const saved = presets.find((p) => p.ease === ease);
  const label = mixed
    ? t("motion.segmentSpeeds")
    : builtIn
      ? speedLabels()[builtIn.key]
      : (saved?.name ?? t("motion.direct"));
  const apply = (value: string) => {
    if (animation.keyframes && onSetAllKeyframeEases) onSetAllKeyframeEases(animation.id, value);
    else onUpdateMeta?.(animation.id, { ease: value });
  };
  const applyCustom = (save: boolean) => {
    try {
      const value = compileMotionExpression(code);
      if (save) {
        if (!name.trim()) throw new Error("name");
        const next = [
          ...presets.filter((p) => p.name !== name.trim()),
          { name: name.trim(), ease: value },
        ];
        saveMotionSpeeds(next);
        setPresets(next);
      }
      apply(value);
      setError("");
    } catch {
      setError(t("motion.invalid"));
    }
  };
  return (
    <div className="mb-3 space-y-3" data-motion-timing>
      <div className="grid grid-cols-2 gap-2">
        <MetricField
          label={t("motion.start")}
          value={start === null ? "—" : String(start)}
          disabled={!onUpdateMeta || start === null}
          onCommit={(v) => {
            const n = Number(v);
            if (v.trim() && Number.isFinite(n) && n >= 0)
              onUpdateMeta?.(animation.id, { position: n });
          }}
        />
        <MetricField
          label={t("motion.duration")}
          value={String(duration)}
          disabled={!onUpdateMeta}
          onCommit={(v) => {
            const n = Number(v);
            if (v.trim() && Number.isFinite(n) && n > 0)
              onUpdateMeta?.(animation.id, { duration: n });
          }}
        />
      </div>
      <p className="text-xs text-panel-text-2">
        {t("motion.globalRange")}:{" "}
        {start === null
          ? "—"
          : `${(start + offset).toFixed(2)} – ${(start + offset + duration).toFixed(2)} s`}
      </p>
      <label className="block text-sm">
        {t("motion.speed")}
        <select
          className="mt-1 w-full rounded border border-panel-hairline bg-panel-bg p-2"
          value={
            custom
              ? "custom"
              : mixed
                ? "current"
                : (builtIn?.ease ?? (saved ? `saved:${saved.name}` : "current"))
          }
          disabled={!onUpdateMeta}
          onChange={(e) => {
            const v = e.target.value;
            setCustom(v === "custom");
            if (v === "custom") {
              if (ease.startsWith("__raw:")) setCode(ease.slice(6));
              return;
            }
            if (v === "current") return;
            const next = presets.find((p) => `saved:${p.name}` === v)?.ease ?? v;
            apply(next);
          }}
        >
          <option value="current">
            {t("motion.current")}: {label}
          </option>
          {MOTION_SPEEDS.map((p) => (
            <option key={p.ease} value={p.ease}>
              {speedLabels()[p.key]}
            </option>
          ))}
          {presets.map((p) => (
            <option key={p.name} value={`saved:${p.name}`}>
              {p.name}
            </option>
          ))}
          <option value="custom">{t("motion.custom")}</option>
        </select>
      </label>
      <div className="text-xs text-panel-text-2 break-words">
        {t("motion.current")}: {label}
        <code className="mt-1 block whitespace-pre-wrap">{ease.replace(/^__raw:/, "")}</code>
      </div>
      {custom && (
        <div className="space-y-2 rounded border border-panel-hairline p-2">
          <p className="text-xs text-panel-text-2">{t("motion.expressionHint")}</p>
          <textarea
            aria-label={t("motion.expression")}
            className="w-full rounded bg-panel-bg-inset p-2 font-mono text-xs"
            rows={3}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            aria-label={t("motion.name")}
            placeholder={t("motion.name")}
            className="w-full rounded border border-panel-hairline bg-panel-bg p-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              className="rounded border border-panel-hairline p-2"
              onClick={() => applyCustom(false)}
            >
              {t("motion.apply")}
            </button>
            <button
              className="rounded border border-panel-hairline p-2"
              onClick={() => applyCustom(true)}
            >
              {t("motion.save")}
            </button>
          </div>
          <p className="text-xs text-panel-text-2">{t("motion.local")}</p>
          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
