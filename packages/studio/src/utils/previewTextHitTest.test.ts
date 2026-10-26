// @vitest-environment happy-dom
import { afterEach, expect, it } from "vitest";
import { withPickablePreviewText } from "./previewTextHitTest";

afterEach(() => {
  document.body.replaceChildren();
  document.adoptedStyleSheets = [];
});

function fixture() {
  document.body.innerHTML =
    '<div class="labels" style="pointer-events:none"><div data-hf-id="count" style="pointer-events:none">3 个<br>生产环节</div><svg id="arrows"></svg></div>';
  const text = document.querySelector<HTMLElement>('[data-hf-id="count"]')!;
  text.getBoundingClientRect = () => new DOMRect(20, 30, 100, 60);
  return text;
}

it("temporarily includes text with line breaks without changing source or its wrapper", () => {
  fixture();
  const source = document.body.innerHTML;
  const result = withPickablePreviewText(document, 40, 50, () => {
    expect(document.adoptedStyleSheets).toHaveLength(1);
    const rules = Array.from(document.adoptedStyleSheets[0].cssRules)
      .map((r) => r.cssText)
      .join("");
    expect(rules).toContain('[data-hf-id="count"]');
    expect(rules).not.toContain(".labels");
    expect(rules).not.toContain("#arrows");
    return "picked";
  });
  expect(result).toBe("picked");
  expect(document.adoptedStyleSheets).toHaveLength(0);
  expect(document.body.innerHTML).toBe(source);
});

it("restores existing sheets even if hit testing throws", () => {
  fixture();
  const existing = new CSSStyleSheet();
  document.adoptedStyleSheets = [existing];
  expect(() =>
    withPickablePreviewText(document, 40, 50, () => {
      throw new Error("hit failed");
    }),
  ).toThrow("hit failed");
  expect(document.adoptedStyleSheets).toEqual([existing]);
});

it.each(["outside", "hidden", "transparent ancestor"])("does not enable %s text", (kind) => {
  const text = fixture();
  if (kind === "hidden") text.style.display = "none";
  if (kind === "transparent ancestor") text.parentElement!.style.opacity = "0";
  withPickablePreviewText(document, kind === "outside" ? 300 : 40, 50, () => {
    expect(document.adoptedStyleSheets).toHaveLength(0);
  });
});
