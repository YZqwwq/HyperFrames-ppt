import type { PresentationAsset } from "./presentationExportAssets.js";
import type { PresentationRange } from "./presentationExportCues.js";

export interface PresentationPackage {
  title: string;
  html: string;
  assets: PresentationAsset[];
  width: number;
  height: number;
  ranges: PresentationRange[];
}

/** Serialized into the download; no editor, server, imports, or network required. */
function presentationPlayer(data: PresentationPackage): void {
  interface Player {
    play(): void;
    pause(): void;
    seek(time: number): void;
    getTime(): number;
  }
  function isPlayer(value: unknown): value is Player {
    return (
      typeof value === "object" &&
      value !== null &&
      ["play", "pause", "seek", "getTime"].every(
        (key) => typeof Reflect.get(value, key) === "function",
      )
    );
  }
  const frame = document.querySelector("iframe");
  const start = document.querySelector("#start");
  const cover = document.querySelector("#cover");
  const status = document.querySelector("#status");
  const counter = document.querySelector("#counter");
  const menu = document.querySelector("select");
  const stage = document.querySelector("#stage");
  if (
    !(frame instanceof HTMLIFrameElement) ||
    !(start instanceof HTMLButtonElement) ||
    !(cover instanceof HTMLElement) ||
    !(status instanceof HTMLElement) ||
    !(counter instanceof HTMLElement) ||
    !(menu instanceof HTMLSelectElement) ||
    !(stage instanceof HTMLElement)
  )
    return;
  let player: Player | null = null;
  let page = 0;
  let active = false;
  let target: number | null = null;
  let idle = 0;
  const urls: string[] = [];
  function wake() {
    document.body.classList.remove("idle");
    window.clearTimeout(idle);
    idle = window.setTimeout(() => {
      if (active) document.body.classList.add("idle");
    }, 2500);
  }
  function paint() {
    if (!menu || !counter) return;
    counter.textContent = `${page + 1} / ${data.ranges.length + 1}`;
    counter.setAttribute(
      "aria-label",
      `${counter.textContent}${target === null ? "" : " · 动画播放中"}`,
    );
    if (menu instanceof HTMLSelectElement) menu.value = String(page);
    const previous = document.querySelector("#previous"),
      next = document.querySelector("#next");
    if (previous instanceof HTMLButtonElement) previous.disabled = page === 0 && target === null;
    if (next instanceof HTMLButtonElement)
      next.disabled = target !== null || page >= data.ranges.length;
  }
  function jump(index: number) {
    if (!player) return;
    player.pause();
    target = null;
    page = Math.max(0, Math.min(data.ranges.length, index));
    player.seek(page === 0 ? data.ranges[0]!.start : data.ranges[page - 1]!.end);
    paint();
  }
  function next() {
    if (!active || !player || target !== null) return;
    const range = data.ranges[page];
    if (!range) return;
    player.pause();
    if (range.transition === "cut") {
      jump(page + 1);
      return;
    }
    player.seek(range.start);
    target = range.end;
    player.play();
    paint();
  }
  function previous() {
    if (!player || !active) return;
    if (target !== null) {
      player.pause();
      target = null;
      player.seek(data.ranges[page]!.start);
      paint();
    } else jump(page - 1);
  }
  function leave() {
    if (!player) return;
    if (target !== null) jump(page);
    player.pause();
    active = false;
    if (cover instanceof HTMLElement) cover.hidden = false;
    if (start instanceof HTMLButtonElement) start.textContent = "继续放映";
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    wake();
  }
  async function fullscreen() {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    } catch {
      if (status)
        status.textContent = "当前浏览器未允许全屏，已使用窗口放映。可按 F 或点击全屏重试。";
    }
  }
  function fail(message: string) {
    player?.pause();
    active = false;
    if (cover instanceof HTMLElement) cover.hidden = false;
    if (status) status.textContent = message;
    if (start instanceof HTMLButtonElement) start.disabled = true;
  }
  const labels = ["开始画面", ...data.ranges.map((range) => range.label)];
  labels.forEach((label, index) => menu.add(new Option(`${index + 1}. ${label}`, String(index))));
  menu.addEventListener("change", () => jump(Number(menu.value)));
  document.querySelector("#previous")?.addEventListener("click", previous);
  document.querySelector("#next")?.addEventListener("click", next);
  document.querySelector("#restart")?.addEventListener("click", () => jump(0));
  document.querySelector("#fullscreen")?.addEventListener("click", () => void fullscreen());
  document.querySelector("#leave")?.addEventListener("click", leave);
  stage.addEventListener("click", next);
  start.addEventListener("click", () => {
    if (!player) return;
    active = true;
    cover.hidden = true;
    start.blur();
    document.body.classList.add("idle");
    void fullscreen();
    paint();
  });
  document.addEventListener("fullscreenchange", () => {
    if (!document.fullscreenElement && active) leave();
  });
  document.addEventListener("mousemove", (event) => {
    if (event.clientY >= innerHeight - 120) wake();
  });
  document.querySelector("#toolbar")?.addEventListener("focusin", wake);
  document.addEventListener("keydown", (event) => {
    if (
      !active ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.target instanceof HTMLSelectElement
    )
      return;
    if (
      ![
        " ",
        "Enter",
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "ArrowUp",
        "Home",
        "End",
        "Escape",
        "f",
        "F",
      ].includes(event.key)
    )
      return;
    // A focused toolbar button owns Enter/Space, preventing a double advance.
    if (event.target instanceof HTMLButtonElement && [" ", "Enter"].includes(event.key)) return;
    event.preventDefault();
    if (event.repeat) return;
    if (["ArrowLeft", "ArrowUp"].includes(event.key)) previous();
    else if (event.key === "Home") jump(0);
    else if (event.key === "End") jump(data.ranges.length);
    else if (event.key === "Escape") leave();
    else if (event.key.toLowerCase() === "f") void fullscreen();
    else next();
  });
  const fit = () => {
    const scale = Math.min(innerWidth / data.width, innerHeight / data.height);
    frame.style.width = `${data.width}px`;
    frame.style.height = `${data.height}px`;
    frame.style.transform = `translate(-50%, -50%) scale(${scale})`;
  };
  window.addEventListener("resize", fit);
  fit();
  frame.addEventListener("load", () => {
    const win = frame.contentWindow;
    win?.addEventListener("error", (event) => fail(`作品脚本加载失败：${event.message}`));
    const deadline = performance.now() + 30000;
    const boot = () => {
      const candidate: unknown = win && Reflect.get(win, "__player");
      if (isPlayer(candidate) && win && Reflect.get(win, "__renderReady") === true) {
        player = candidate;
        player.pause();
        jump(0);
        start.disabled = false;
        start.textContent = "开始放映";
        status.textContent = "单击画面 / 空格 / → 下一步　← 上一步　Esc 退出全屏";
        const tick = () => {
          if (player && target !== null && player.getTime() >= target) {
            const end = target;
            player.pause();
            target = null;
            player.seek(end);
            page += 1;
            paint();
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      } else if (performance.now() < deadline) requestAnimationFrame(boot);
      else fail("作品未能完成加载。请重新打开，或返回编辑器检查素材及动画后重新导出。");
    };
    boot();
  });
  let html = data.html;
  for (const asset of data.assets) {
    const bytes = Uint8Array.from(atob(asset.base64), (character) => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: asset.mime }));
    urls.push(url);
    html = html.split(asset.token).join(url);
  }
  frame.srcdoc = html;
  window.addEventListener("pagehide", () => urls.forEach((url) => URL.revokeObjectURL(url)), {
    once: true,
  });
}

export function buildPresentationPlayer(data: PresentationPackage): string {
  const title = data.title.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
  const payload = JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · PPT 放映</title>
<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#111;color:#fff;font:15px system-ui,sans-serif}#stage{position:fixed;inset:0;cursor:pointer}iframe{position:absolute;left:50%;top:50%;border:0;transform-origin:center;pointer-events:none}#toolbar{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;max-width:96vw;padding:10px;border:1px solid #555;border-radius:12px;background:#181818ed;transition:opacity .2s}button,select{font:inherit;border:1px solid #666;border-radius:7px;padding:8px 12px;color:white;background:#282828;cursor:pointer}button:disabled{opacity:.45;cursor:default}button:hover:enabled{background:#444}select{width:30vw;max-width:360px;min-width:0}#counter{width:7ch;flex:none;text-align:center;white-space:nowrap;font-variant-numeric:tabular-nums}#cover{position:fixed;inset:0;display:grid;place-content:center;text-align:center;background:#101214e8;padding:24px}#cover[hidden]{display:none}h1{font-size:clamp(24px,4vw,44px);font-weight:600;margin:0 0 28px}#start{background:#008260;border:0;padding:14px 32px;font-size:20px}#status{max-width:650px;line-height:1.8;color:#ccc}#cover small{color:#aaa}.idle #toolbar{opacity:0;pointer-events:none}.idle #stage{cursor:none}#toolbar:focus-within{opacity:1;pointer-events:auto}@media(max-width:650px){#toolbar{flex-wrap:wrap;justify-content:center;width:96vw;bottom:8px}select{width:50vw;max-width:50vw}button{padding:6px 9px}}</style></head><body>
<div id="stage" aria-label="单击下一步"><iframe title="演示画面" sandbox="allow-scripts allow-same-origin"></iframe></div>
<nav id="toolbar" aria-label="放映控制"><button id="previous">上一步</button><span id="counter"></span><button id="next">下一步</button><select aria-label="演示目录"></select><button id="restart">重播</button><button id="fullscreen">全屏</button><button id="leave">退出</button></nav>
<div id="cover"><h1>${title}</h1><div><button id="start" disabled>正在加载…</button></div><p id="status" role="status">正在准备字体、素材和动画…</p><small>Future PPT 浏览器放映 · 无需安装编辑器</small></div>
<script>${`(${presentationPlayer.toString()})(${payload});`.replace(/<\/script/gi, "<\\/script")}</script></body></html>`;
}
