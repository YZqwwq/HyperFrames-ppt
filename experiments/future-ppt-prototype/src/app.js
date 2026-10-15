"use strict";
const $ = (id) => document.getElementById(id);
let doc = structuredClone(demoDocument),
  time = 3000,
  selected = "traveler",
  playing = false,
  anchorTime = 0,
  anchorClock = 0;
let nodes = new Map(),
  history = [],
  future = [],
  drag = null;
FuturePpt.validate(doc);
function object() {
  return doc.objects.find((o) => o.id === selected);
}
function stop() {
  playing = false;
  $("play").textContent = "播放";
}
function change(edit) {
  stop();
  const before = structuredClone(doc);
  try {
    edit();
    FuturePpt.validate(doc);
    history.push(before);
    future = [];
    rebuild();
  } catch (error) {
    doc = before;
    $("status").textContent = error.message;
    render();
  }
}
function resize() {
  const scale = Math.min(
    $("viewport").clientWidth / doc.stage.width,
    $("viewport").clientHeight / doc.stage.height,
  );
  $("stage").style.transform = `scale(${scale})`;
  $("stage").style.left = `${($("viewport").clientWidth - doc.stage.width * scale) / 2}px`;
  $("stage").style.top = `${($("viewport").clientHeight - doc.stage.height * scale) / 2}px`;
}
function rebuild() {
  $("stage").replaceChildren();
  nodes = new Map();
  $("stage").style.width = `${doc.stage.width}px`;
  $("stage").style.height = `${doc.stage.height}px`;
  for (const obj of doc.objects) {
    const el = document.createElement(obj.type === "image" ? "img" : "div");
    el.className = "object";
    el.dataset.id = obj.id;
    Object.assign(el.style, { width: `${obj.layout.width}px`, height: `${obj.layout.height}px` });
    const s = obj.style || {};
    if (obj.type === "text") {
      el.textContent = obj.text;
      Object.assign(el.style, {
        color: s.color || "#fff",
        fontSize: `${s.fontSize || 24}px`,
        fontWeight: s.fontWeight || 400,
      });
    }
    if (obj.type === "shape")
      Object.assign(el.style, { background: s.fill || "#fff", borderRadius: `${s.radius || 0}px` });
    if (obj.type === "image") {
      el.src = obj.src;
      el.draggable = false;
      el.alt = obj.id;
    }
    el.addEventListener("pointerdown", (event) => {
      if (document.fullscreenElement) return;
      event.stopPropagation();
      stop();
      selected = obj.id;
      render();
      const scale = $("stage").getBoundingClientRect().width / doc.stage.width;
      drag = {
        id: obj.id,
        x: event.clientX,
        y: event.clientY,
        scale,
        before: structuredClone(doc),
        startX: obj.layout.x,
        startY: obj.layout.y,
      };
      // Group transforms require inverse matrix mapping; numerical editing remains available.
      if (obj.parentId) drag = null;
      el.setPointerCapture(event.pointerId);
    });
    el.addEventListener("dblclick", () => {
      if (document.fullscreenElement || obj.type !== "text") return;
      const value = prompt("编辑文字（保留动画）", obj.text);
      if (value !== null)
        change(() => {
          obj.text = value;
        });
    });
    nodes.set(obj.id, el);
  }
  for (const obj of doc.objects)
    (obj.parentId ? nodes.get(obj.parentId) : $("stage")).append(nodes.get(obj.id));
  $("segments").replaceChildren();
  for (const segment of doc.segments) {
    const button = document.createElement("button");
    button.textContent = `${segment.title} · ${segment.start / 1000}s`;
    button.dataset.segment = segment.id;
    button.onclick = () => seek(segment.start);
    $("segments").append(button);
  }
  $("scrubber").max = doc.duration;
  if (!object()) selected = doc.objects[0]?.id;
  resize();
  render();
}
function render() {
  const frame = FuturePpt.evaluate(doc, time);
  $("stage").style.background = frame.background || "#101a2b";
  for (const state of frame.objects) {
    const el = nodes.get(state.id);
    Object.assign(el.style, {
      left: `${state.x}px`,
      top: `${state.y}px`,
      transform: `rotate(${state.rotation}deg) scale(${state.scale})`,
      opacity: state.opacity,
      display: state.visible ? "" : "none",
    });
    el.classList.toggle("selected", state.id === selected);
  }
  $("clock").textContent = `${(time / 1000).toFixed(3)} / ${(doc.duration / 1000).toFixed(0)} s`;
  $("scrubber").value = time;
  $("segment-name").textContent = doc.segments.find((s) => s.id === frame.segmentId).title;
  for (const button of $("segments").children)
    button.classList.toggle("active", button.dataset.segment === frame.segmentId);
  const obj = object();
  $("selected-name").textContent = obj?.id || "未选中";
  for (const axis of ["x", "y"]) {
    $("layout-" + axis).disabled = !obj;
    $("layout-" + axis).value = obj?.layout[axis] ?? "";
  }
  $("text").disabled = obj?.type !== "text";
  $("text").value = obj?.text || "";
  $("start").disabled = $("duration").disabled = !obj?.animation;
  $("start").value = obj?.animation ? obj.animation.binding.start / 1000 : "";
  $("duration").value = obj?.animation ? obj.animation.binding.duration / 1000 : "";
  $("endpoint").disabled = !obj?.animation?.tracks.x;
  $("endpoint").value = obj?.animation?.tracks.x?.at(-1).value ?? "";
  $("state").textContent = JSON.stringify(
    frame.objects.find((o) => o.id === selected),
    null,
    2,
  );
  $("undo").disabled = !history.length;
  $("redo").disabled = !future.length;
}
function seek(value) {
  stop();
  time = Math.min(doc.duration, Math.max(0, value));
  render();
}
function toggle() {
  if (playing) stop();
  else {
    if (time >= doc.duration) time = 0;
    playing = true;
    anchorTime = time;
    anchorClock = performance.now();
    $("play").textContent = "暂停";
  }
}
function tick(now) {
  if (playing) {
    time = Math.min(doc.duration, anchorTime + (now - anchorClock) * Number($("speed").value));
    if (time >= doc.duration) stop();
    render();
  }
  requestAnimationFrame(tick);
}
window.addEventListener("pointermove", (event) => {
  if (!drag) return;
  const obj = object();
  obj.layout.x = drag.startX + (event.clientX - drag.x) / drag.scale;
  obj.layout.y = drag.startY + (event.clientY - drag.y) / drag.scale;
  render();
});
function finishDrag() {
  if (drag) {
    if (JSON.stringify(doc) !== JSON.stringify(drag.before)) {
      history.push(drag.before);
      future = [];
    }
    drag = null;
    render();
  }
}
window.addEventListener("pointerup", finishDrag);
window.addEventListener("pointercancel", finishDrag);
$("play").onclick = toggle;
$("restart").onclick = () => seek(0);
$("boundary").onclick = () => {
  seek(57000);
  toggle();
};
$("scrubber").oninput = (event) => seek(Number(event.target.value));
$("speed").onchange = () => {
  anchorTime = time;
  anchorClock = performance.now();
};
for (const axis of ["x", "y"])
  $("layout-" + axis).onchange = (event) =>
    change(() => {
      object().layout[axis] = Number(event.target.value);
    });
$("nudge").onclick = () => {
  if (object())
    change(() => {
      object().layout.x -= 5;
    });
};
$("text").onchange = (event) =>
  change(() => {
    object().text = event.target.value;
  });
$("start").onchange = (event) =>
  change(() => {
    object().animation.binding.start = Number(event.target.value) * 1000;
  });
$("duration").onchange = (event) =>
  change(() => {
    const b = object().animation.binding;
    const value = Number(event.target.value) * 1000;
    b.speed *= b.duration / value;
    b.duration = value;
  });
$("endpoint").onchange = (event) =>
  change(() => {
    object().animation.tracks.x.at(-1).value = Number(event.target.value);
  });
$("undo").onclick = () => {
  if (history.length) {
    stop();
    future.push(structuredClone(doc));
    doc = history.pop();
    rebuild();
  }
};
$("redo").onclick = () => {
  if (future.length) {
    stop();
    history.push(structuredClone(doc));
    doc = future.pop();
    rebuild();
  }
};
$("save").onclick = () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "future-ppt.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  $("status").textContent = "已导出完整作品，可重新导入继续编辑。";
};
$("load").onclick = () => $("file").click();
$("file").onchange = async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const next = FuturePpt.validate(JSON.parse(await file.text()));
    stop();
    history.push(structuredClone(doc));
    future = [];
    doc = next;
    time = 0;
    rebuild();
    $("status").textContent = "作品已加载。";
  } catch (error) {
    $("status").textContent = `导入失败：${error.message}`;
  }
  event.target.value = "";
};
$("fullscreen").onclick = async () => {
  try {
    await $("viewport").requestFullscreen();
  } catch (error) {
    $("status").textContent = error.message;
  }
};
document.addEventListener("fullscreenchange", () => {
  $("stage").classList.toggle("presenting", !!document.fullscreenElement);
  resize();
});
document.addEventListener("keydown", (event) => {
  if (["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(event.target.tagName)) return;
  if (event.code === "Space") {
    event.preventDefault();
    toggle();
  }
  if (
    !document.fullscreenElement &&
    object() &&
    ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
  ) {
    event.preventDefault();
    const step = event.shiftKey ? 10 : 1;
    change(() => {
      const o = object();
      if (event.key === "ArrowLeft") o.layout.x -= step;
      if (event.key === "ArrowRight") o.layout.x += step;
      if (event.key === "ArrowUp") o.layout.y -= step;
      if (event.key === "ArrowDown") o.layout.y += step;
    });
  }
});
new ResizeObserver(resize).observe($("viewport"));
rebuild();
requestAnimationFrame(tick);
// Stop before editing numeric/text controls so frame updates do not overwrite typing.
document.querySelector(".inspector").addEventListener("focusin", (event) => {
  if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) stop();
});
