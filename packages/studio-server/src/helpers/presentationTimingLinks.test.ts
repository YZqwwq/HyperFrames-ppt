import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { planPresentationTimingLinks } from "./presentationTimingLinks";
import { applyFileMutations } from "./applyFileMutations";
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const timeline = (code: string) =>
  `<html><body><template><div data-duration="8"></div><script>const tl=gsap.timeline();${code}</script></template></body></html>`;
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "timing-links-"));
  dirs.push(dir);
  const write = (path: string, text: string) => writeFileSync(join(dir, path), text);
  const circle = (duration: number) =>
    timeline(
      `tl.to("#circle", {scale:10,duration:${duration}},2.1);tl.to("#circle",{scale:1,duration:0.7},14.35);`,
    );
  write("circle.html", circle(2.2));
  write("previous.html", timeline('tl.to("#old",{opacity:0,duration:0.4},2.1);'));
  write(
    "content.html",
    timeline(
      'tl.to("#text",{opacity:1,duration:0.6},0);tl.to("#text",{opacity:0,duration:0.35},6);',
    ),
  );
  write(
    "index.html",
    '<html><body><div id="subject" data-start="56" data-duration="24"></div><div id="old" data-start="56" data-duration="8"></div><div id="content" data-start="64" data-duration="8"></div><div id="background" data-background-frame data-linked-clip="content" data-start="64" data-duration="8"></div><div id="next" data-start="72" data-duration="8"></div></body></html>',
  );
  write(
    "presentation-cues.json",
    JSON.stringify({ version: 1, segments: [{ id: "first" }, { id: "next" }] }),
  );
  write(
    "presentation-timing-links.json",
    JSON.stringify({
      version: 1,
      links: [
        {
          source: { file: "circle.html", selector: "#circle", ordinal: 0, clipId: "subject" },
          content: {
            file: "content.html",
            clipId: "content",
            enter: { file: "content.html", selector: "#text", ordinal: 0 },
            exit: { file: "content.html", selector: "#text", ordinal: 1 },
            exitAt: 70,
            endAt: 72,
          },
          previous: {
            clipId: "old",
            exit: { file: "previous.html", selector: "#old", ordinal: 0 },
          },
          cueId: "first",
          nextCueId: "next",
          delay: 0,
          settle: 0.05,
        },
      ],
    }),
  );
  return { dir, circle };
}
it("moves content, its lifetime and stops after the source; retains unrelated global times", () => {
  const { dir, circle } = fixture();
  const plan = planPresentationTimingLinks(dir, "circle.html", circle(0.8));
  const master = parseHTML(plan.find((f) => f.sourceFile === "index.html")!.after).document;
  expect(master.getElementById("content")?.getAttribute("data-start")).toBe("58.9");
  expect(master.getElementById("content")?.getAttribute("data-duration")).toBe("13.1");
  expect(master.getElementById("background")?.getAttribute("data-start")).toBe("58.9");
  expect(master.getElementById("background")?.getAttribute("data-duration")).toBe("13.1");
  expect(master.getElementById("old")?.getAttribute("data-duration")).toBe("2.9");
  expect(master.getElementById("next")?.getAttribute("data-start")).toBe("72");
  const content = plan.find((f) => f.sourceFile === "content.html")!.after;
  expect(content).toContain('data-duration="13.1"');
  expect(content).toMatch(/11\.1\)/);
  expect(circle(0.8)).toContain("14.35");
  const cues = JSON.parse(plan.find((f) => f.sourceFile === "presentation-cues.json")!.after);
  expect(cues.segments[0].end).toEqual({ clipId: "content", offset: 0.65 });
  expect(cues.segments[1].start.offset).toBe(11.1);
  applyFileMutations(dir, plan);
  const second = planPresentationTimingLinks(dir, "circle.html", circle(1.2));
  expect(second.find((f) => f.sourceFile === "content.html")!.after).toContain(
    'data-duration="12.7"',
  );
  expect(readFileSync(join(dir, "circle.html"), "utf8")).toBe(circle(0.8));
});
it("refuses an overlapping transition without writing any file", () => {
  const { dir, circle } = fixture();
  expect(() => planPresentationTimingLinks(dir, "circle.html", circle(15))).toThrow(/overlaps/);
  expect(readFileSync(join(dir, "circle.html"), "utf8")).toBe(circle(2.2));
});
it("does nothing to unlinked edits", () => {
  const { dir } = fixture();
  expect(planPresentationTimingLinks(dir, "unrelated.html", "anything")).toEqual([]);
});
