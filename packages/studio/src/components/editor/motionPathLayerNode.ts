type Point = { x: number; y: number };

const LAYER_BOX = '[data-dom-edit-selection-box="true"]';
export const SELECTION_CHROME = `${LAYER_BOX}, [data-dom-edit-chrome="true"], [data-dom-edit-crop-frame="true"], [data-dom-edit-crop-entry="true"], [data-dom-edit-crop-bar="true"]`;

/** How far a node's dot reaches; a selected node draws it larger. */
export const dotRadius = (r: number, selected: boolean) => (selected ? r * 1.5 : r);

export function controlUnder(e: React.PointerEvent): Element | null {
  const path = e.currentTarget.closest("svg");
  const hits = e.currentTarget.ownerDocument.elementsFromPoint(e.clientX, e.clientY);
  const hit = hits.find((el) => !path?.contains(el));
  return hit?.closest(SELECTION_CHROME) ? hit : null;
}

/** Explicit handles keep priority, but a node inside the selection box remains editable. */
export function controlForNode(
  e: React.PointerEvent,
  _pressed: Point,
  _live: Point | null,
): Element | null {
  const control = controlUnder(e);
  return control?.matches(LAYER_BOX) ? null : control;
}

/** Hands a press to `control`; true when it started a gesture with it. */
export function pressControl(e: React.PointerEvent, control: Element | null): boolean {
  if (!control || getComputedStyle(control).pointerEvents === "none") return false;
  return !control.dispatchEvent(new PointerEvent("pointerdown", e.nativeEvent));
}
