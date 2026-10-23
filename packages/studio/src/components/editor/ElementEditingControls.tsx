import type { ComponentProps } from "react";
import { AnimationEndpoints } from "./AnimationEndpoints";
import { EditingScopeNotice } from "./EditingScopeNotice";
import { resolveTweenDuration } from "../../utils/globalTimeCompiler";
import { t } from "../../i18n";

/** Keep editing scope and motion controls together, before long typography panels. */
export function ElementEditingControls({
  disabled,
  ...props
}: ComponentProps<typeof AnimationEndpoints> & {
  disabled: [boolean, boolean, boolean];
}) {
  const hasMotion =
    props.element.capabilities.canEditStyles &&
    props.animations.some(
      (animation) =>
        !animation.global && animation.method !== "set" && resolveTweenDuration(animation) > 0,
    );
  return (
    <>
      <EditingScopeNotice element={props.element} disabled={disabled} />
      {hasMotion && (
        <details className="shrink-0 border-b border-panel-hairline">
          <summary className="cursor-pointer px-4 py-3 text-sm">{t("animation.states")}</summary>
          <AnimationEndpoints {...props} />
        </details>
      )}
    </>
  );
}
