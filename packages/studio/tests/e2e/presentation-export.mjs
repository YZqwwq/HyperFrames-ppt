import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { exportPresentation } from "../../../studio-server/dist/index.js";
import { launchStudioChrome } from "./chrome-executable.mjs";
const require = createRequire(import.meta.url);
const dir = mkdtempSync(join(tmpdir(), "hf-offline-presentation-"));
copyFileSync(require.resolve("gsap/dist/gsap.min.js"), join(dir, "gsap.js"));
writeFileSync(
  join(dir, "index.html"),
  `<!doctype html><html><head><script src="gsap.js"></script></head><body><div id="root" data-composition-id="root" data-duration="3" data-width="800" data-height="450" style="width:800px;height:450px;background:white"><div id="box" style="position:absolute;left:80px;top:100px;width:100px;height:80px;background:#008260">测试动画</div></div><script>window.__timelines={root:gsap.timeline({paused:true}).to('#box',{x:240,duration:3,ease:'none'})};</script></body></html>`,
);
writeFileSync(
  join(dir, "presentation-cues.json"),
  JSON.stringify({
    version: 1,
    segments: [
      {
        id: "animated",
        label: "动画",
        start: { clipId: null, offset: 0 },
        end: { clipId: null, offset: 1 },
        transition: "animate",
      },
      {
        id: "cut",
        label: "静态直达",
        start: { clipId: null, offset: 1 },
        end: { clipId: null, offset: 2 },
        transition: "cut",
      },
    ],
  }),
);
const file = join(dir, "presentation.html");
writeFileSync(file, await exportPresentation(dir, "离线演示测试"));
const { browser } = await launchStudioChrome();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 800 });
  const errors = [],
    network = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) {
      network.push(request.url());
      void request.abort();
    } else void request.continue();
  });
  await page.setOfflineMode(true);
  await page.goto(pathToFileURL(file).href, { waitUntil: "load" });
  await page.waitForFunction(() => !document.querySelector("#start").disabled);
  const frame = page.frames().find((item) => item !== page.mainFrame());
  const time = () => frame.evaluate(() => window.__player.getTime());
  await page.click("#start");
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  assert.equal(await page.$eval("#toolbar", (el) => getComputedStyle(el).pointerEvents), "none");
  const toolbarBox = () =>
    page.$eval("#toolbar", (el) => {
      const { x, y, width, height } = el.getBoundingClientRect();
      return { x, y, width, height };
    });
  const initialBox = await toolbarBox();
  await page.keyboard.press("ArrowRight");
  assert.deepEqual(await toolbarBox(), initialBox);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#counter").textContent === "2 / 3");
  assert.ok(Math.abs((await time()) - 1) < 0.002);
  assert.deepEqual(await toolbarBox(), initialBox);
  assert.equal(await page.$eval("#toolbar", (el) => getComputedStyle(el).pointerEvents), "none");
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.querySelector("#counter").textContent === "3 / 3");
  assert.ok(Math.abs((await time()) - 2) < 0.002);
  await page.keyboard.press("ArrowRight");
  assert.ok(Math.abs((await time()) - 2) < 0.002);
  await page.keyboard.press("ArrowLeft");
  assert.ok(Math.abs((await time()) - 1) < 0.002);
  await page.mouse.move(600, 790);
  await page.select("select", "0");
  assert.ok(Math.abs(await time()) < 0.002);
  await page.click("#stage");
  await page.waitForFunction(() =>
    document.querySelector("#counter").getAttribute("aria-label").includes("动画播放中"),
  );
  await page.mouse.move(10, 10);
  await page.click("#previous");
  assert.ok(Math.abs(await time()) < 0.002);
  await page.select("select", "2");
  await page.screenshot({ path: join(dir, "standalone.png") });
  await page.click("#leave");
  await page.waitForFunction(() => !document.querySelector("#cover").hidden);
  await page.click("#start");
  assert.ok(Math.abs((await time()) - 2) < 0.002);
  assert.deepEqual(network, []);
  assert.deepEqual(errors, []);
  console.log(
    "PASS offline file, fullscreen, animated/cut stops, repeated clicks, previous, directory, resume:",
    dir,
  );
} finally {
  await browser.close();
}
