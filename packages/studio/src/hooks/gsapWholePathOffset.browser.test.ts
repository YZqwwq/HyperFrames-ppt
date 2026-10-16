// @vitest-environment happy-dom
import { parseGsapScriptAcorn } from "@hyperframes/parsers/gsap-parser-acorn";
import { replaceTweenWithKeyframesInScript } from "@hyperframes/parsers/gsap-writer-acorn";
import { expect, it, vi } from "vitest";
import { launchTestChrome, showWithRuntime } from "../../tests/chromeTestUtils";
import type { DomEditSelection } from "../components/editor/domEditingTypes";
import { commitWholePathOffset } from "./gsapDragCommit";

vi.setConfig({ testTimeout: 60_000 });

const html = (script: string) => `<!doctype html><html><body>
<div data-composition-id="main" data-start="0" data-duration="2" data-width="1280" data-height="720">
<div id="target" class="clip" data-start="0" data-duration="2" data-track-index="1"
style="position:absolute;width:100px;height:100px;left:300px;top:200px;background:blue"></div>
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>window.__timelines = {}; ${script}</script></body></html>`;

it("saved whole-path edits preserve forward and reverse playback in Chromium", async () => {
  const browser = await launchTestChrome();
  try {
    for (const method of ["from", "to", "fromTo"] as const) {
      for (const ease of ["none", "power2.out"]) {
        const source = `var tl = gsap.timeline({ paused: true });
          tl.${method}("#target", ${method === "fromTo" ? "{ x: 80 }," : ""}
          { x: -260, duration: 2, ease: "${ease}" }, 0);
          window.__timelines.main = tl;`;
        const animation = parseGsapScriptAcorn(source).animations[0]!;
        const element = document.createElement("div");
        element.id = "target";
        const selection = { id: "target", selector: "#target", element } as DomEditSelection;
        let written: string | null = null;
        await commitWholePathOffset(
          selection,
          animation,
          { x: -5, y: 10 },
          { x: 0, y: 0 },
          null,
          "#target",
          {
            commitMutation: async (_selection, mutation) => {
              if (mutation.type !== "replace-with-keyframes")
                throw new Error("unexpected mutation");
              written = replaceTweenWithKeyframesInScript(
                source,
                animation.id,
                mutation as Parameters<typeof replaceTweenWithKeyframesInScript>[2],
              );
            },
          },
        );
        expect(written).not.toBeNull();
        const samples: number[][][] = [];
        for (const script of [source, written!]) {
          const page = await browser.newPage();
          try {
            await showWithRuntime(page, html(script));
            samples.push(
              await page.evaluate(() => {
                const w = window as unknown as { __player: { seek(t: number): void } };
                return [0, 0.5, 1, 1.5, 2, 1, 0].map((time) => {
                  w.__player.seek(time);
                  const r = document.getElementById("target")!.getBoundingClientRect();
                  return [r.x, r.y];
                });
              }),
            );
          } finally {
            await page.close();
          }
        }
        for (let i = 0; i < samples[0].length; i++) {
          expect(
            samples[1][i][0] - samples[0][i][0],
            `${method}/${ease} sample ${i} x`,
          ).toBeCloseTo(-5, 1);
          expect(
            samples[1][i][1] - samples[0][i][1],
            `${method}/${ease} sample ${i} y`,
          ).toBeCloseTo(10, 1);
        }
      }
    }
  } finally {
    await browser.close();
  }
});
