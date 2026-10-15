const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validate, evaluate } = require("../src/engine");
const sample = require("../src/sample");
const traveler = (doc, t) => evaluate(doc, t).objects.find((o) => o.id === "traveler");
const clone = () => structuredClone(sample);
test("sample is valid with two segments and four object types", () => {
  assert.equal(validate(sample), sample);
  assert.equal(sample.segments.length, 2);
  assert.equal(new Set(sample.objects.map((o) => o.type)).size, 4);
});
test("absolute expected positions and local times across the page boundary", () => {
  assert.equal(traveler(sample, 50000).x, 100);
  assert.equal(traveler(sample, 60000).x, 590);
  assert.equal(traveler(sample, 70000).x, 1080);
  assert.equal(traveler(sample, 60000).localTime, 10000);
  assert.equal(evaluate(sample, 59999).segmentId, "intro");
  assert.equal(evaluate(sample, 60000).segmentId, "detail");
  assert.ok(Math.abs(traveler(sample, 60001).x - traveler(sample, 59999).x - 0.098) < 1e-9);
});
test("seeking backward or forward gives the same state without mutating input", () => {
  const before = JSON.stringify(sample);
  const expected = evaluate(sample, 60500);
  for (const t of [0, 120000, 10000, 60500, 70000, 59999]) evaluate(sample, t);
  assert.deepEqual(evaluate(sample, 60500), expected);
  assert.equal(JSON.stringify(sample), before);
});
test("binding clamps independently of visibility and holds the endpoint", () => {
  assert.equal(traveler(sample, 0).x, 100);
  assert.equal(traveler(sample, 119000).x, 1080);
  assert.equal(traveler(sample, 119000).visible, true);
  assert.equal(evaluate(sample, 60000).objects.find((o) => o.id === "title").visible, false);
  assert.equal(traveler(sample, 120000).visible, true);
  assert.equal(evaluate(sample, -100).time, 0);
  assert.equal(evaluate(sample, 999999).time, 120000);
});
test("speed and local offset map to the expected local time", () => {
  const doc = clone();
  const b = doc.objects.find((o) => o.id === "traveler").animation.binding;
  b.speed = 2;
  b.localOffset = 2000;
  assert.equal(traveler(validate(doc), 54000).localTime, 10000);
  assert.equal(traveler(doc, 54000).x, 590);
});
test("moving baseline by -5 translates the entire motion, leaving tracks and peers intact", () => {
  const doc = clone();
  doc.objects.find((o) => o.id === "traveler").layout.x -= 5;
  for (const t of [0, 50000, 55000, 60000, 70000, 120000]) {
    assert.equal(traveler(doc, t).x, traveler(sample, t).x - 5);
    assert.deepEqual(
      evaluate(doc, t).objects.filter((o) => o.id !== "traveler"),
      evaluate(sample, t).objects.filter((o) => o.id !== "traveler"),
    );
  }
  assert.deepEqual(
    doc.objects.find((o) => o.id === "traveler").animation,
    sample.objects.find((o) => o.id === "traveler").animation,
  );
});
test("text change preserves animation and endpoint edit changes only the desired track", () => {
  const doc = clone();
  doc.objects.find((o) => o.id === "title").text = "2026 年产品介绍";
  assert.deepEqual(evaluate(doc, 1000), evaluate(sample, 1000));
  doc.objects.find((o) => o.id === "traveler").animation.tracks.x.at(-1).value = 1000;
  assert.equal(traveler(doc, 70000).x, 1100);
  assert.equal(traveler(doc, 50000).x, 100);
});
test("duration stretching retains the endpoint with deterministic intermediate states", () => {
  const doc = clone();
  const b = doc.objects.find((o) => o.id === "traveler").animation.binding;
  b.duration = 40000;
  b.speed = 0.5;
  validate(doc);
  assert.equal(traveler(doc, 70000).x, 590);
  assert.equal(traveler(doc, 90000).x, 1080);
});
test("JSON round trip preserves the whole document and evaluated frames", () => {
  const restored = validate(JSON.parse(JSON.stringify(sample)));
  assert.deepEqual(restored, sample);
  for (const t of [0, 1500, 59999, 60000, 60001, 120000])
    assert.deepEqual(evaluate(restored, t), evaluate(sample, t));
});
test("validation rejects ambiguous or broken animation data", () => {
  const mutations = [
    (d) => {
      d.objects[1].id = d.objects[0].id;
    },
    (d) => {
      d.segments[1].start = 59000;
    },
    (d) => {
      d.objects.find((o) => o.id === "traveler").animation.binding.speed = 0;
    },
    (d) => {
      d.objects.find((o) => o.id === "traveler").animation.tracks.x[1].time = 0;
    },
    (d) => {
      d.objects.find((o) => o.id === "traveler").animation.tracks.x[1].easing = "unknown";
    },
    (d) => {
      d.objects.find((o) => o.id === "badge").parentId = "badge";
    },
    (d) => {
      d.objects[0].layout.x = NaN;
    },
    (d) => {
      d.objects[0].visible = [100, 50];
    },
  ];
  for (const mutate of mutations) {
    const doc = clone();
    mutate(doc);
    assert.throws(() => validate(doc));
  }
  assert.throws(() => evaluate(sample, NaN));
});
