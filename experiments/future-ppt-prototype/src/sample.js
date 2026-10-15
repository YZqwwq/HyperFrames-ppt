(function (root) {
  const key = (time, value, easing = "easeInOut") => ({ time, value, easing });
  const animate = (start, duration, tracks) => ({
    binding: { start, duration, speed: 1, localOffset: 0 },
    tracks,
  });
  const doc = {
    version: 1,
    title: "Future / 连续演示实验",
    duration: 120000,
    stage: { width: 1280, height: 720 },
    segments: [
      { id: "intro", title: "01 / 从想法开始", start: 0, end: 60000, background: "#101a2b" },
      {
        id: "detail",
        title: "02 / 让想法持续运动",
        start: 60000,
        end: 120000,
        background: "#112921",
      },
    ],
    objects: [
      {
        id: "eyebrow",
        type: "text",
        text: "FUTURE PPT   /   RUNTIME EXPERIMENT 01",
        layout: { x: 80, y: 65, width: 1050, height: 40 },
        visible: [0, 120000],
        style: { color: "#8cafa7", fontSize: 17 },
      },
      {
        id: "title",
        type: "text",
        text: "让想法，\n自然流动。",
        layout: { x: 80, y: 170, width: 850, height: 220 },
        visible: [0, 60000],
        style: { color: "#f1f5ee", fontSize: 76, fontWeight: 700 },
        animation: animate(0, 2200, {
          y: [key(0, 38), key(2200, 0)],
          opacity: [key(0, 0), key(2200, 1)],
        }),
      },
      {
        id: "subtitle",
        type: "text",
        text: "同一份作品数据，驱动每一帧。\n可暂停、可跳转，也可精确修改。",
        layout: { x: 84, y: 420, width: 800, height: 100 },
        visible: [0, 60000],
        style: { color: "#b1bdc9", fontSize: 25 },
        animation: animate(800, 1800, { opacity: [key(0, 0), key(1800, 1)] }),
      },
      {
        id: "second-title",
        type: "text",
        text: "页面改变，\n运动继续。",
        layout: { x: 80, y: 170, width: 900, height: 220 },
        visible: [60000, 120000],
        style: { color: "#f1f5ee", fontSize: 76, fontWeight: 700 },
        animation: animate(60000, 2000, {
          opacity: [key(0, 0), key(2000, 1)],
          y: [key(0, 24), key(2000, 0)],
        }),
      },
      {
        id: "second-copy",
        type: "text",
        text: "绿色方块跨越 60 秒边界，不会重置。\n拖动时间滑块，检查任意一帧。",
        layout: { x: 84, y: 420, width: 850, height: 100 },
        visible: [60000, 120000],
        style: { color: "#afc8bd", fontSize: 25 },
      },
      {
        id: "traveler",
        type: "shape",
        layout: { x: 100, y: 580, width: 64, height: 64 },
        visible: [0, 120000],
        style: { fill: "#b7f56b", radius: 18 },
        animation: animate(50000, 20000, {
          x: [key(0, 0, "linear"), key(20000, 980, "linear")],
          rotation: [key(0, 0, "linear"), key(20000, 180, "linear")],
          scale: [key(0, 1), key(10000, 1.4), key(20000, 1)],
        }),
      },
      {
        id: "badge",
        type: "group",
        layout: { x: 1030, y: 90, width: 150, height: 150 },
        visible: [0, 120000],
        animation: animate(0, 3000, {
          scale: [key(0, 0.7), key(3000, 1)],
          opacity: [key(0, 0), key(3000, 1)],
        }),
      },
      {
        id: "badge-bg",
        parentId: "badge",
        type: "shape",
        layout: { x: 0, y: 0, width: 150, height: 150 },
        visible: [0, 120000],
        style: { fill: "#ffffff12", radius: 75 },
      },
      {
        id: "badge-label",
        parentId: "badge",
        type: "text",
        text: "LIVE\n120 s",
        layout: { x: 30, y: 38, width: 110, height: 90 },
        visible: [0, 120000],
        style: { color: "#b7f56b", fontSize: 26, fontWeight: 600 },
      },
      {
        id: "image",
        type: "image",
        src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5XcAAAAASUVORK5CYII=",
        layout: { x: 80, y: 560, width: 1100, height: 2 },
        visible: [0, 120000],
        animation: animate(0, 1800, { opacity: [key(0, 0), key(1800, 0.18)] }),
      },
    ],
  };
  if (typeof module === "object" && module.exports) module.exports = doc;
  else root.demoDocument = doc;
})(typeof globalThis !== "undefined" ? globalThis : this);
