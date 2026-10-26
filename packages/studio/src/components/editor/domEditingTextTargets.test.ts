// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { buildStableSelector } from "./domEditingDom";
import { resolveVisualDomEditSelectionTarget } from "./domEditingElement";
import { collectDomEditLayerItems, resolveDomEditSelection } from "./domEditingLayers";

const options = { activeCompositionPath: "index.html", isMasterView: true, skipSourceProbe: true };
afterEach(() => document.body.replaceChildren());

function fixture(tag: string) {
  const container = document.createElement("div");
  container.className = "explain";
  const section = document.createElement("section");
  section.setAttribute("data-hf-id", "section-1");
  const text = document.createElement(tag);
  text.setAttribute("data-hf-id", "text-1");
  text.textContent = "明确生成要求";
  section.append(text);
  container.append(section);
  document.body.append(container);
  for (const el of [text, section, container]) {
    el.getBoundingClientRect = () => new DOMRect(20, 30, 200, 40);
  }
  return { container, section, text };
}

describe("text nodes identified only by data-hf-id", () => {
  it.each(["h2", "p", "b", "span"])(
    "picks the %s rather than its ordinary container",
    async (tag) => {
      const { container, section, text } = fixture(tag);
      const hit = resolveVisualDomEditSelectionTarget([text, section, container], options);
      expect(hit).toBe(text);
      const selected = await resolveDomEditSelection(hit, options);
      expect(selected?.element).toBe(text);
      expect(selected?.hfId).toBe("text-1");
      expect(selected?.textContent).toBe("明确生成要求");
      if (tag === "h2" || tag === "p") expect(selected?.textFields[0]?.value).toBe("明确生成要求");
      expect(
        collectDomEditLayerItems(container, options).some((item) => item.element === text),
      ).toBe(true);
    },
  );

  it("still selects an explicit group as a unit and supports drill-in", async () => {
    const { container, text } = fixture("p");
    container.setAttribute("data-hf-group", "Explanation");
    expect((await resolveDomEditSelection(text, options))?.element).toBe(container);
    expect(
      (await resolveDomEditSelection(text, { ...options, activeGroupElement: container }))?.element,
    ).toBe(text);
  });

  it("preserves existing class selectors and escapes source identifiers", () => {
    const { container, text } = fixture("p");
    container.setAttribute("data-hf-id", "container-1");
    expect(buildStableSelector(container)).toBe(".explain");
    text.setAttribute("data-hf-id", 'text"quoted');
    const selector = buildStableSelector(text);
    expect(selector).toBeDefined();
    expect(document.querySelector(selector!)).toBe(text);
    text.setAttribute("data-hf-id", "   ");
    expect(buildStableSelector(text)).toBeUndefined();
  });
});
