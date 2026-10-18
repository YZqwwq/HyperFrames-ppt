import fs from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
const html = await fs.readFile(
  process.argv[2] ?? "presentations/probation-review/subjects/case-circle-08-10.html",
  "utf8",
);
const body = html.match(/<template>([\s\S]*)<script>/)[1];
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const browser = await puppeteer.launch({
  executablePath: process.env.HYPERFRAMES_BROWSER_PATH,
  headless: true,
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });
  await page.setContent('<body style="margin:0;width:1280px;height:720px">' + body + "</body>");
  await page.addScriptTag({ path: fileURLToPath(import.meta.resolve("gsap/dist/gsap.js")) });
  await page.evaluate(() => {
    window.__timelines = {};
  });
  await page.addScriptTag({ content: script });
  const result = await page.evaluate(() => {
    const tl = window.__timelines["case-circle-08-10"];
    const el = document.getElementById("slide-08-case-visual");
    const read = (t) => {
      tl.seek(t, false);
      return ["x", "y", "scaleX", "scaleY"].map((k) => Number(gsap.getProperty(el, k)));
    };
    const times = [2.1, 2.9, 14.35, 15.05, 15.95];
    const baseline = times.map(read);
    const diameter = parseFloat(getComputedStyle(el).width);
    const positionTweens = tl
      .getChildren(false, true, false)
      .filter(
        (t) => t.targets().includes(el) && t.duration() > 0 && ("x" in t.vars || t.vars.keyframes),
      );
    const spans = positionTweens
      .map((t) => [t.startTime(), t.endTime()])
      .sort((a, b) => a[0] - b[0]);
    const samples = Array.from({ length: 81 }, (_, i) => read(2.1 + i / 100));
    const repetitions = Array.from({ length: 20 }, () =>
      [...times].reverse().map((t) => ({ t, pose: read(t) })),
    ).flat();
    return { times, baseline, repetitions, diameter, spans, samples };
  });
  assert.equal(result.spans.length, 3);
  for (let i = 1; i < result.spans.length; i++)
    assert.ok(
      result.spans[i][0] >= result.spans[i - 1][1] - 0.0001,
      "overlapping position writers",
    );
  assert.ok(
    Math.abs(result.diameter * result.baseline[1][2] - 604) < 0.01,
    "large circle diameter",
  );
  assert.ok(Math.abs(result.diameter * result.baseline[3][2] - 64) < 0.01, "split circle diameter");
  for (let i = 1; i < result.samples.length; i++)
    assert.ok(result.samples[i][2] >= result.samples[i - 1][2], "growth must not reverse");
  for (const item of result.repetitions)
    assert.deepEqual(item.pose, result.baseline[result.times.indexOf(item.t)]);
  console.log("PASS: 100 endpoint seeks, no cumulative drift", JSON.stringify(result.baseline));
} finally {
  await browser.close();
}
