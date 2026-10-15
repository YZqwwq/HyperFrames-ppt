(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FuturePpt = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const properties = ["x", "y", "scale", "opacity", "rotation"];
  const easing = { linear: (t) => t, easeInOut: (t) => t * t * (3 - 2 * t) };
  const finite = Number.isFinite;
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  function validate(doc) {
    const fail = (message) => {
      throw new Error(message);
    };
    if (!doc || doc.version !== 1) fail("Unsupported document version");
    if (!finite(doc.duration) || doc.duration <= 0) fail("Invalid duration");
    if (
      !doc.stage ||
      !finite(doc.stage.width) ||
      !finite(doc.stage.height) ||
      doc.stage.width <= 0 ||
      doc.stage.height <= 0
    )
      fail("Invalid stage");
    if (!Array.isArray(doc.segments) || !doc.segments.length || !Array.isArray(doc.objects))
      fail("Missing segments or objects");
    const segmentIds = new Set();
    let end = 0;
    for (const segment of doc.segments) {
      if (!segment.id || segmentIds.has(segment.id)) fail("Duplicate or missing segment id");
      segmentIds.add(segment.id);
      if (
        segment.start !== end ||
        !finite(segment.end) ||
        segment.end <= segment.start ||
        segment.end > doc.duration
      )
        fail("Segments must cover the duration without gaps or overlaps");
      end = segment.end;
    }
    if (end !== doc.duration) fail("Segments must cover the duration");
    const ids = new Set();
    for (const obj of doc.objects) {
      if (!obj.id || ids.has(obj.id)) fail("Duplicate or missing object id");
      ids.add(obj.id);
      if (!["text", "shape", "image", "group"].includes(obj.type)) fail("Unsupported object type");
      if (
        !obj.layout ||
        !["x", "y", "width", "height"].every((key) => finite(obj.layout[key])) ||
        obj.layout.width <= 0 ||
        obj.layout.height <= 0
      )
        fail("Invalid layout");
      if (
        !Array.isArray(obj.visible) ||
        obj.visible.length !== 2 ||
        !obj.visible.every(finite) ||
        obj.visible[0] < 0 ||
        obj.visible[1] <= obj.visible[0] ||
        obj.visible[1] > doc.duration
      )
        fail("Invalid visibility");
      if (obj.type === "text" && typeof obj.text !== "string") fail("Invalid text");
      if (
        obj.type === "image" &&
        (typeof obj.src !== "string" || !/^data:image\/(png|jpeg|webp);base64,/.test(obj.src))
      )
        fail("Prototype images must be embedded PNG/JPEG/WebP");
      if (!obj.animation) continue;
      const { binding, tracks } = obj.animation;
      if (
        !binding ||
        ![binding.start, binding.duration, binding.speed, binding.localOffset].every(finite) ||
        binding.start < 0 ||
        binding.duration <= 0 ||
        binding.start + binding.duration > doc.duration ||
        binding.speed <= 0 ||
        binding.localOffset < 0
      )
        fail("Invalid binding");
      if (!tracks || typeof tracks !== "object" || Array.isArray(tracks)) fail("Invalid tracks");
      for (const [property, keys] of Object.entries(tracks)) {
        if (!properties.includes(property) || !Array.isArray(keys) || !keys.length)
          fail("Invalid track");
        let previous = -1;
        for (const key of keys) {
          if (
            !finite(key.time) ||
            key.time < 0 ||
            key.time <= previous ||
            !finite(key.value) ||
            (key.easing && !Object.hasOwn(easing, key.easing))
          )
            fail("Invalid keyframe");
          if (property === "opacity" && (key.value < 0 || key.value > 1)) fail("Invalid opacity");
          if (property === "scale" && key.value <= 0) fail("Invalid scale");
          previous = key.time;
        }
      }
    }
    const byId = new Map(doc.objects.map((obj) => [obj.id, obj]));
    for (const obj of doc.objects) {
      const visited = new Set([obj.id]);
      let current = obj;
      while (current.parentId != null) {
        const parent = byId.get(current.parentId);
        if (!parent || parent.type !== "group" || visited.has(parent.id))
          fail("Invalid group hierarchy");
        visited.add(parent.id);
        current = parent;
      }
    }
    return doc;
  }
  function interpolate(keys, time) {
    if (time <= keys[0].time) return keys[0].value;
    for (let i = 1; i < keys.length; i++) {
      const a = keys[i - 1],
        b = keys[i];
      if (time <= b.time) {
        const progress = (time - a.time) / (b.time - a.time);
        return a.value + (b.value - a.value) * easing[b.easing || "linear"](progress);
      }
    }
    return keys[keys.length - 1].value;
  }
  // Milliseconds throughout. Layout is a baseline; x/y tracks are offsets.
  // Bindings hold their first/last states outside their active interval.
  function evaluate(doc, time) {
    if (!finite(time)) throw new Error("Invalid time");
    const t = clamp(time, 0, doc.duration);
    const segment = doc.segments.find((s) => t >= s.start && t < s.end) || doc.segments.at(-1);
    const objects = doc.objects.map((obj) => {
      const state = {
        id: obj.id,
        x: obj.layout.x,
        y: obj.layout.y,
        scale: 1,
        opacity: 1,
        rotation: 0,
        visible:
          t >= obj.visible[0] &&
          (t < obj.visible[1] || (t === doc.duration && obj.visible[1] === doc.duration)),
        localTime: null,
      };
      if (obj.animation) {
        const { binding, tracks } = obj.animation;
        state.localTime =
          clamp(t - binding.start, 0, binding.duration) * binding.speed + binding.localOffset;
        for (const [prop, keys] of Object.entries(tracks)) {
          const value = interpolate(keys, state.localTime);
          state[prop] = prop === "x" || prop === "y" ? obj.layout[prop] + value : value;
        }
      }
      return state;
    });
    return { time: t, segmentId: segment.id, background: segment.background, objects };
  }
  return { validate, evaluate, interpolate };
});
