import { afterEach, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { exportPresentation } from "./presentationExport";
import { embedPresentationAssets } from "./presentationExportAssets";
import { resolvePresentationExportCues } from "./presentationExportCues";
const dirs: string[] = [];
afterEach(() => dirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true })));
const scene =
  '<html><head></head><body><div id="root" data-composition-id="root" data-no-timeline data-width="800" data-height="450" data-duration="4"><div id="a" class="clip" data-start="0" data-duration="2">A</div><div id="b" class="clip" data-start="2" data-duration="2">B</div></div></body></html>';
const cues = JSON.stringify({
  version: 1,
  segments: [
    {
      id: "one",
      label: "A → B",
      transition: "cut",
      start: { clipId: "a", offset: 0.5 },
      end: { clipId: "b", offset: 0.5 },
    },
  ],
});
function setup() {
  const dir = mkdtempSync(join(tmpdir(), "hf-presentation-"));
  dirs.push(dir);
  writeFileSync(join(dir, "index.html"), scene);
  writeFileSync(join(dir, "presentation-cues.json"), cues);
  return dir;
}
it("resolves clip-relative anchors and preserves cut transitions", () => {
  expect(resolvePresentationExportCues(cues, scene)).toEqual({
    width: 800,
    height: 450,
    ranges: [{ label: "A → B", start: 0.5, end: 2.5, transition: "cut" }],
  });
  expect(() => resolvePresentationExportCues(cues.replace('"b"', '"missing"'), scene)).toThrow(
    /缺失/,
  );
  expect(() =>
    resolvePresentationExportCues(cues.replace('"offset":0.5', '"offset":20'), scene),
  ).toThrow(/超出/);
});
it("embeds large fonts once, rewrites CSS-relative resources and retains media", () => {
  const dir = setup();
  mkdirSync(join(dir, "assets"));
  writeFileSync(join(dir, "assets", "font.woff2"), Buffer.alloc(3 * 1024 * 1024, 4));
  writeFileSync(
    join(dir, "assets", "style.css"),
    '@font-face{font-family:demo;src:url("font.woff2")}',
  );
  writeFileSync(join(dir, "assets", "sound.mp3"), Buffer.from([1, 2, 3]));
  const result = embedPresentationAssets(
    '<html><head><link rel="stylesheet" href="assets/style.css"><style>@font-face{font-family:other;src:url("assets/font.woff2")}</style></head><body><audio src="assets/sound.mp3"></audio></body></html>',
    dir,
    () => {},
  );
  expect(result.assets).toHaveLength(2);
  expect(result.assets[0]?.mime).toBe("font/woff2");
  expect(result.html).not.toContain('href="assets/');
  expect(result.html).not.toContain('src="assets/');
  expect(result.html.match(/hf-export-asset-0-end/g)).toHaveLength(2);
});
it("rejects external resources, private paths and missing cues", async () => {
  const dir = setup();
  expect(() =>
    embedPresentationAssets('<img src="https://example.org/x.png">', dir, () => {}),
  ).toThrow(/外链/);
  expect(() => embedPresentationAssets('<img src="../private.png">', dir, () => {})).toThrow();
  expect(() => embedPresentationAssets('<img src=".env">', dir, () => {})).toThrow();
  rmSync(join(dir, "presentation-cues.json"));
  await expect(exportPresentation(dir, "Title")).rejects.toThrow(/打点/);
});
it("exports one HTML with inline runtime and safely escaped title and labels", async () => {
  const dir = setup();
  const before = readFileSync(join(dir, "index.html"), "utf8");
  const html = await exportPresentation(dir, "Title </script><img src=x>");
  expect(html).toContain('id="start"');
  expect(html).toContain('id="toolbar"');
  expect(html).toContain("data-hyperframes-preview-runtime");
  expect(html).toContain('"start":0.5,"end":2.5');
  expect(html).not.toContain("Title </script>");
  expect(html).toContain("Title &#60;/script&#62;");
  expect(readFileSync(join(dir, "index.html"), "utf8")).toBe(before);
});
