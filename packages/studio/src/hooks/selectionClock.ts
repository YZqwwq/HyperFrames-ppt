import type { DomEditSelection } from "../components/editor/domEditingTypes";

/** Offset of the selected source timeline in the currently displayed preview. */
export function selectionTimeOffset(
  selection?: Pick<DomEditSelection, "element" | "sourceFile">,
): number {
  if (!selection?.element?.closest) return 0;
  let host = selection.element.closest("[data-composition-file]");
  while (host && host.getAttribute("data-composition-file") !== selection.sourceFile) {
    host = host.parentElement?.closest("[data-composition-file]") ?? null;
  }
  let offset = 0;
  while (host) {
    offset += Number.parseFloat(host.getAttribute("data-start") ?? "0") || 0;
    host = host.parentElement?.closest("[data-composition-file]") ?? null;
  }
  return offset;
}
