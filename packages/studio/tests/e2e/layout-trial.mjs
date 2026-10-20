// Real browser proof: snapshot movement must never mutate the authored document.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { resolveChromeExecutable } from "./chrome-executable.mjs";

const studio = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = mkdtempSync(join(tmpdir(), "layout-trial-browser-"));
const compiled = await build({
  stdin: {
    resolveDir: studio,
    loader: "tsx",
    contents: `
      import React, { useState } from 'react';
      import { createRoot } from 'react-dom/client';
      import { offerLayoutTrial } from './src/components/editor/layoutTrialEvents';
      import { LayoutTrialLauncher } from './src/components/editor/LayoutTrial';
      import { isTypingTarget } from './src/utils/typingTarget';
      import { liveTime } from './src/player/store/playerStore';
      import { captureLayoutTrial } from './src/components/editor/layoutTrialSnapshot';
      window.mountTrial = (frame) => {
        const doc = frame.contentDocument;
        const selections = ['group', 'child', 'other'].map(id => ({
          element: doc.getElementById(id), id, selector: '#'+id,
          label: id, sourceFile: 'slides/demo.html',
        }));
        liveTime.notify(95);
        window.captureTrial = () => captureLayoutTrial(frame, selections, 95);
        window.offerTrial = () => offerLayoutTrial(doc);
        function PreviewSurface() {
          const [selected, setSelected] = useState(true);
          return <div style={{position:'relative'}} onPointerDown={event => {
            const rect = frame.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
              window.deselectedBySurface = true;
              setSelected(false);
            }
          }}>
            {selected && <LayoutTrialLauncher iframeRef={{current: frame}} selections={selections} />}
          </div>;
        }
        createRoot(document.getElementById('controls')).render(<PreviewSurface />);
      };
      window.isTypingTarget = isTypingTarget;
    `,
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
});
const browser = await puppeteer.launch({
  executablePath: resolveChromeExecutable(),
  headless: true,
  pipe: true,
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.setContent(
    '<div id="controls" style="position:relative"></div><iframe id="source" style="width:800px;height:450px;border:0;margin-top:80px"></iframe>',
  );
  const css = readdirSync(join(studio, "dist/assets")).find((name) => name.endsWith(".css"));
  await page.addStyleTag({ content: readFileSync(join(studio, "dist/assets", css), "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await page.evaluate(async () => {
    const frame = document.getElementById("source");
    await new Promise((resolve) => {
      frame.onload = resolve;
      frame.srcdoc = `<html><body style="margin:0"><div data-composition-id="root" data-width="800" style="position:relative;width:800px;height:450px;background:white;color:black">
      <h1 style="position:absolute;left:40px;top:20px">布局试摆 · 动画对象整体移动</h1>
      <div style="position:absolute;left:150px;top:150px;transform:rotate(20deg) scale(.8)">
        <div id="group" style="width:240px;height:120px;background:#16c79a;transform:translate(15px, 10px)"><span id="child">父子对象仅移动一次</span></div>
      </div>
      <div id="other" style="position:absolute;left:480px;top:240px;width:160px;height:80px;background:#ffd15c">另一个选中对象</div>
      <script>window.scriptRuns = (window.scriptRuns || 0) + 1;</script>
      </div></body></html>`;
    });
    window.sourceBefore = frame.contentDocument.documentElement.outerHTML;
    window.mountTrial(frame);
  });
  await page.waitForSelector("#controls button");
  await page.evaluate(() => window.offerTrial());
  await page.waitForFunction(() =>
    document
      .querySelector('#controls [role="status"]')
      ?.textContent.includes("当前动画无法直接移动"),
  );
  await page.screenshot({ path: join(output, "before.png") });
  await page.click("#controls button");
  await page.waitForSelector('[data-layout-trial-selection="true"]');
  const before = await page.evaluate(() => {
    const doc = document.querySelector("dialog iframe").contentDocument;
    window.trialBefore = ["group", "child", "other"].map((id) => {
      const r = doc.getElementById(id).getBoundingClientRect();
      return { x: r.x, y: r.y };
    });
    return {
      targets: doc.querySelectorAll("[data-layout-trial-target]").length,
      scripts: doc.querySelectorAll("script").length,
      typing: window.isTypingTarget(document.activeElement),
    };
  });
  assert.deepEqual(before, { targets: 2, scripts: 0, typing: true });
  await page.$eval('input[aria-label="X (px)"]', (input) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(input, "40");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.$eval('input[aria-label="Y (px)"]', (input) => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
    set.call(input, "-30");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForFunction(() => {
    const r = document
      .querySelector("dialog iframe")
      .contentDocument.getElementById("other")
      .getBoundingClientRect();
    return (
      Math.abs(r.x - window.trialBefore[2].x - 40) < 0.1 &&
      Math.abs(r.y - window.trialBefore[2].y + 30) < 0.1
    );
  });
  const result = await page.evaluate(() => {
    const doc = document.querySelector("dialog iframe").contentDocument;
    return ["group", "child", "other"].map((id, index) => {
      const r = doc.getElementById(id).getBoundingClientRect();
      return { x: r.x - window.trialBefore[index].x, y: r.y - window.trialBefore[index].y };
    });
  });
  for (const position of result) {
    assert.ok(Math.abs(position.x - 40) < 0.1);
    assert.ok(Math.abs(position.y + 30) < 0.1);
  }
  // Dragging the box updates the entire selected set as well.
  const box = await page.$('[data-layout-trial-selection="true"]');
  const bounds = await box.boundingBox();
  await page.mouse.move(bounds.x + 15, bounds.y + 15);
  await page.mouse.down();
  await page.mouse.move(bounds.x + 65, bounds.y + 15, { steps: 4 });
  await page.mouse.up();
  await page.screenshot({ path: join(output, "drag.png") });
  assert.ok(
    await page.$eval('input[aria-label="X (px)"]', (input) => Number(input.value) > 40),
    output,
  );
  await page.screenshot({ path: join(output, "after.png") });
  assert.equal(
    await page.evaluate(
      () =>
        document.getElementById("source").contentDocument.documentElement.outerHTML ===
        window.sourceBefore,
    ),
    true,
  );
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedTrial = text;
        },
      },
    });
    Array.from(document.querySelectorAll("dialog button"))
      .find((button) => button.textContent.includes("复制调整说明"))
      .click();
  });
  await page.waitForFunction(() => window.copiedTrial);
  const instructions = await page.evaluate(() => window.copiedTrial);
  assert.match(instructions, /95.000/);
  assert.match(instructions, /slides\/demo.html/);
  assert.match(instructions, /尚未应用到作品/);
  assert.match(instructions, /#group/);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !document.querySelector("dialog"));
  assert.equal(
    await page.evaluate(
      () =>
        document.getElementById("source").contentDocument.documentElement.outerHTML ===
        window.sourceBefore,
    ),
    true,
  );
  // Unsupported canvas fails explicitly instead of creating a misleading blank copy.
  assert.match(
    await page.evaluate(() => {
      document
        .getElementById("source")
        .contentDocument.body.append(document.createElement("canvas"));
      try {
        window.captureTrial();
      } catch (e) {
        return e.message;
      }
    }),
    /Canvas/,
  );
  assert.equal(await page.evaluate(() => Boolean(window.deselectedBySurface)), false);
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      status: "passed",
      evidence: output,
      checks: [
        "rotated-scaled-parent",
        "nested-selection",
        "drag",
        "numeric-offset",
        "source-unchanged",
        "cancel",
        "scripts-disabled",
        "keyboard-isolation",
        "canvas-refusal",
      ],
    }),
  );
} finally {
  await browser.close();
}
