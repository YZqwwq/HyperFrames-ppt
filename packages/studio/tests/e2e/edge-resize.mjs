import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launchStudioChrome } from "./chrome-executable.mjs";
const studio = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const output = mkdtempSync(join(tmpdir(), "edge-resize-"));
const compiled = await build({
  stdin: {
    resolveDir: studio,
    loader: "tsx",
    contents: `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {usePlayerStore} from './src/player/store/playerStore';
import {DomEditOverlay} from './src/components/editor/DomEditOverlay';
import {useCropPresetBarStore} from './src/components/editor/cropPresetStore';
window.mount = (iframe) => {
 usePlayerStore.setState({previewBooted:true});
 const element = iframe.contentDocument.getElementById('target');
 const selection = {element, id:'target', selector:'#target', label:'Text', tagName:'div', sourceFile:'demo.html', compositionPath:'demo.html',
 boundingBox:{x:200,y:150,width:300,height:100}, textContent:element.textContent, dataAttributes:{}, inlineStyles:{}, computedStyles:{},textFields:[],
 capabilities:{canCrop:true,canApplyManualOffset:true,canApplyManualSize:true,canApplyManualRotation:true,canEditStyles:true,canSelect:true}};
 window.commits=[];
 window.closeCrop=()=>useCropPresetBarStore.getState().close();
 createRoot(document.getElementById('controls')).render(<DomEditOverlay iframeRef={{current:iframe}} activeCompositionPath='demo.html' selection={selection} hoverSelection={null}
 onCanvasMouseDown={()=>{}} onCanvasPointerMove={async()=>null} onCanvasPointerLeave={()=>{}} onSelectionChange={()=>{}} onBlockedMove={()=>{}}
 onPathOffsetCommit={()=>{}} onGroupPathOffsetCommit={()=>{}} onRotationCommit={()=>{}}
 onBoxSizeCommit={(sel,size)=>{window.commits.push(size);sel.element.style.width=size.width+'px';sel.element.style.height=size.height+'px';}}
 onStyleCommit={(property,value)=>element.style.setProperty(property,value)} />);
};
`,
  },
  external: ["os"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  define: { "process.env.NODE_ENV": '"production"', "import.meta.env": "{}" },
});
const { browser } = await launchStudioChrome();
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 700 });
  const errors = [];
  page.on("pageerror", (e) => (console.error(String(e)), errors.push(String(e))));
  await page.setContent(
    '<div style="position:relative;width:900px;height:600px"><iframe id="frame" style="width:900px;height:600px;border:0"></iframe><div id="controls" style="position:absolute;inset:0"></div></div>',
  );
  const css = readdirSync(join(studio, "dist/assets")).find((f) => f.endsWith(".css"));
  await page.addStyleTag({ content: readFileSync(join(studio, "dist/assets", css), "utf8") });
  await page.addScriptTag({ content: compiled.outputFiles[0].text });
  await page.evaluate(async () => {
    const frame = document.getElementById("frame");
    await new Promise((resolve) => {
      frame.onload = resolve;
      frame.srcdoc =
        '<body style="margin:0"><div data-composition-id="root" data-width="900" data-height="600" style="width:900px;height:600px;position:relative"><div id="target" class="clip" data-start="0" data-duration="5" style="position:absolute;left:200px;top:150px;width:300px;height:100px;box-sizing:border-box;background:#e0f0eb;font:24px sans-serif;clip-path:inset(0px 60px 0px 0px)">Adjust container width and height independently.</div></div></body>';
    });
    window.mount(frame);
  });
  await page.waitForSelector('[data-dom-edit-resize-handle="e"]');
  assert.equal(await page.$("[data-dom-edit-crop-frame]"), null);
  const size = () =>
    page.evaluate(() => {
      const e = document.getElementById("frame").contentDocument.getElementById("target");
      return { width: e.offsetWidth, height: e.offsetHeight, clip: e.style.clipPath };
    });
  const drag = async (handle, dx, dy) => {
    const box = await (
      await page.$('[data-dom-edit-resize-handle="' + handle + '"]')
    ).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 10 });
    await page.mouse.up();
  };
  await page.screenshot({ path: join(output, "normal.png") });
  await drag("e", 40, 20);
  await page.waitForFunction(() => window.commits.length === 1);
  const wider = await size();
  assert.equal(wider.height, 100);
  assert.ok(wider.width > 350, JSON.stringify(wider));
  assert.equal(wider.clip, "inset(0px 60px 0px 0px)");
  await drag("s", 30, 20);
  await page.waitForFunction(() => window.commits.length === 2);
  const taller = await size();
  assert.equal(taller.width, wider.width);
  assert.ok(taller.height > 120, JSON.stringify(taller));
  await page.click("[data-dom-edit-crop-entry]");
  await page.waitForSelector("[data-dom-edit-crop-frame]");
  assert.equal(await page.$("[data-dom-edit-resize-handle]"), null);
  await page.screenshot({ path: join(output, "crop.png") });
  await page.click("[data-dom-edit-crop-bar] button:last-child");
  await page.waitForSelector('[data-dom-edit-resize-handle="e"]');
  assert.equal(await page.$("[data-dom-edit-crop-frame]"), null);
  assert.equal((await size()).clip, taller.clip);
  await page.click("[data-dom-edit-crop-entry]");
  await page.click("[data-dom-edit-crop-bar] button:nth-last-child(2)");
  assert.equal((await size()).clip, "");
  await page.click("[data-dom-edit-crop-bar] button:last-child");
  await page.evaluate(() => {
    document.getElementById("frame").contentDocument.getElementById("target").style.rotate =
      "30deg";
  });
  await page.waitForFunction(() =>
    document.querySelector("[data-dom-edit-chrome]")?.style.transform.includes("30"),
  );
  const beforeRotated = await size();
  await drag("e", 30 * Math.cos(Math.PI / 6), 30 * Math.sin(Math.PI / 6));
  await page.waitForFunction(() => window.commits.length === 3);
  const afterRotated = await size();
  assert.equal(afterRotated.height, beforeRotated.height);
  assert.ok(afterRotated.width > beforeRotated.width + 40);
  assert.deepEqual(errors, []);
  console.log("PASS width/height gestures, commit routing, crop mode and retained crop:", output);
} finally {
  await browser.close();
}
