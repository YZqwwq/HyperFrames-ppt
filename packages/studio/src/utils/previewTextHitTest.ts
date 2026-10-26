import {
  buildStableSelector,
  isElementVisibleThroughAncestors,
  isTextBearingTag,
} from "../components/editor/domEditingDom";
import { hasOnlyFormattingChildren } from "../components/editor/domEditInlineText";

const sheets = new WeakMap<Document, CSSStyleSheet>();

/** Let the browser resolve paint order, transforms and clipping for visible copy
 * even when playback makes it click-through. The temporary sheet never enters
 * the composition DOM, source, or a rendered frame. */
export function withPickablePreviewText<T>(doc: Document, x: number, y: number, read: () => T): T {
  const win = doc.defaultView;
  if (!win || !doc.adoptedStyleSheets) return read();
  const selectors: string[] = [];
  const visible = new Map<HTMLElement, boolean>();
  for (const el of doc.querySelectorAll<HTMLElement>("[data-hf-id],[id],[class]")) {
    if (!isTextBearingTag(el.tagName.toLowerCase())) continue;
    if (!el.textContent?.trim() || !hasOnlyFormattingChildren(el)) continue;
    const rect = el.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) continue;
    if (!isElementVisibleThroughAncestors(el, visible)) continue;
    if (win.getComputedStyle(el).pointerEvents !== "none") continue;
    const selector = buildStableSelector(el);
    if (selector) selectors.push(selector);
  }
  if (!selectors.length) return read();

  let sheet = sheets.get(doc);
  if (!sheet) {
    // Construct in the iframe's realm: a document cannot adopt another realm's sheet.
    const Sheet = Reflect.get(win, "CSSStyleSheet");
    if (typeof Sheet !== "function") return read();
    sheet = new Sheet();
    if (!sheet || typeof sheet.replaceSync !== "function") return read();
    sheets.set(doc, sheet);
  }
  sheet.replaceSync(`${selectors.join(",")} { pointer-events: auto !important; }`);
  const previous = doc.adoptedStyleSheets;
  try {
    doc.adoptedStyleSheets = [...previous, sheet];
    return read();
  } finally {
    doc.adoptedStyleSheets = previous;
  }
}
