import { useEffect, useRef, useState } from "react";
import type { GsapAnimation } from "@hyperframes/core/gsap-parser";
import type { DomEditSelection } from "./domEditingTypes";
import { useDomEditActionsContextOptional } from "../../contexts/DomEditContext";
import { usePlayerStore } from "../../player/store/playerStore";
import { percentageToAbsoluteForAnimation } from "../../utils/globalTimeCompiler";
import { selectionTimeOffset } from "../../hooks/selectionClock";
import { intermediateStop, planIntermediateKeyframe } from "./planIntermediateKeyframe";
import { t } from "../../i18n";

export function IntermediateKeyframe({
  element,
  animation,
  percentage,
  onEdit,
}: {
  element: DomEditSelection;
  animation: GsapAnimation;
  percentage: number;
  onEdit: (percentage: number) => void;
}) {
  const actions = useDomEditActionsContextOptional();
  const time = usePlayerStore((s) => s.currentTime);
  const playing = usePlayerStore((s) => s.isPlaying);
  const ready = usePlayerStore((s) => s.timelineReady);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  useEffect(() => setError(""), [animation.id, percentage]);
  const stop = intermediateStop(animation, percentage);
  const localTime = percentageToAbsoluteForAnimation(percentage, animation);
  const atSample =
    localTime !== null && Math.abs(time - localTime - selectionTimeOffset(element)) < 0.02;
  async function insert() {
    if (!actions || pending.current || !ready || playing || !atSample || stop) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const plan = planIntermediateKeyframe(
        element,
        animation,
        percentage,
        time,
        actions.previewIframeRef.current,
      );
      let changed = false;
      await actions.commitMutation(
        plan.mutation,
        {
          label: t("animation.insertMiddle"),
          softReload: true,
          keyframeAction: "add",
          onResult: (result) => {
            changed = result.ok && result.changed !== false && result.before !== result.after;
          },
        },
        element,
      );
      if (!changed) throw new Error(t("animation.insertNotSaved"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="mt-2 text-xs" data-intermediate-keyframe>
      {!!animation.keyframes?.keyframes.some(
        (key) => key.percentage > 0 && key.percentage < 100,
      ) && (
        <div
          className="mb-2 flex flex-wrap items-center gap-1"
          aria-label={t("animation.existingKeys")}
        >
          <span>{t("animation.existingKeys")}</span>
          {Array.from(new Set(animation.keyframes?.keyframes.map((key) => key.percentage)))
            .filter((pct) => pct > 0 && pct < 100)
            .sort((a, b) => a - b)
            .map((pct) => (
              <button
                key={pct}
                disabled={!ready || busy}
                className="rounded border border-panel-hairline px-2 py-1"
                onClick={() => onEdit(pct)}
              >
                {pct}%
              </button>
            ))}
        </div>
      )}
      <p role="status">
        {stop
          ? t("animation.authoredKeyframe", { percentage: stop.percentage })
          : t("animation.sampleOnly")}
      </p>
      {stop ? (
        <button
          className="mt-2 rounded border border-panel-hairline px-3 py-2"
          disabled={!ready || busy}
          onClick={() => onEdit(stop.percentage)}
        >
          {t("animation.middleState")}
        </button>
      ) : (
        <>
          <button
            className="mt-2 rounded border border-panel-hairline px-3 py-2 disabled:opacity-50"
            disabled={!actions || !ready || playing || !atSample || busy}
            onClick={() => void insert()}
          >
            {busy ? t("animation.savingKeyframe") : t("animation.insertMiddle")}
          </button>
          <p className="mt-1 text-panel-text-2">{t("animation.insertHint")}</p>
        </>
      )}
      {error && (
        <p role="alert" className="mt-1 text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
