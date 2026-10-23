import { t } from "../../i18n";
import { usePlayerStore } from "../../player/store/playerStore";
import { editsPlainCss, type EditGesture } from "../../hooks/gsapRuntimeKeyframes";
import type { DomEditSelection } from "./domEditingTypes";
import { requestLayoutTrial } from "./layoutTrialEvents";

export type GeometryEditScope = "direct" | "keyframe" | "whole" | "restricted";

/** Describe the existing geometry route, never grant permission to write. */
export function geometryEditScope(
  disabled: boolean,
  plain: boolean,
  keyframes: boolean,
): GeometryEditScope {
  if (disabled) return "restricted";
  if (plain) return "direct";
  return keyframes ? "keyframe" : "whole";
}

function scopeLabel(scope: GeometryEditScope) {
  switch (scope) {
    case "direct":
      return t("editingScope.direct");
    case "keyframe":
      return t("editingScope.keyframe");
    case "whole":
      return t("editingScope.whole");
    case "restricted":
      return t("editingScope.restricted");
  }
}

export function EditingScopeNotice({
  element,
  disabled,
}: {
  element: DomEditSelection;
  disabled: [boolean, boolean, boolean];
}) {
  const keyframes = usePlayerStore((s) => s.autoKeyframeEnabled);
  const playing = usePlayerStore((s) => s.isPlaying);
  const gestures: EditGesture[] = ["move", "resize", "rotate"];
  const labels = [t("editingScope.position"), t("editingScope.size"), t("editingScope.rotation")];
  const scopes = gestures.map((gesture, i) =>
    geometryEditScope(
      disabled[i] || element.capabilities.commitCheckPending === true,
      editsPlainCss(element.element, gesture),
      keyframes,
    ),
  );
  return (
    <details open className="shrink-0 border-b border-panel-hairline px-4 py-2" data-editing-scope>
      <summary className="cursor-pointer text-xs text-panel-text-2">
        {t("editingScope.title")}
      </summary>
      <dl className="my-2 grid grid-cols-2 gap-1 text-xs">
        {scopes.map((scope, i) => (
          <div key={gestures[i]} className="contents">
            <dt>{labels[i]}</dt>
            <dd>{scopeLabel(scope)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-panel-text-2">{t("editingScope.hint")}</p>
      {scopes.includes("restricted") && element.capabilities.reasonIfDisabled && (
        <p className="mt-1 text-xs text-panel-text-2">{element.capabilities.reasonIfDisabled}</p>
      )}
      <button
        type="button"
        disabled={playing}
        className="mt-2 rounded border border-panel-hairline px-2 py-1 text-xs disabled:opacity-50"
        onClick={() => requestLayoutTrial(element.element.ownerDocument)}
      >
        {t("layoutTrial.enter")}
      </button>
    </details>
  );
}
