import { describe, it, expect } from "vitest";
import { anchorAt, parseCues, resolveCue } from "./presentationCues";
const clips = [
  { id: "page-09", compositionSrc: "slides/slide-09.html", start: 64, duration: 8 },
  { id: "page-10", compositionSrc: "slides/slide-10.html", start: 72, duration: 8 },
];
const cue = {
  id: "transition",
  label: "09 to 10",
  start: { clipId: "page-09", offset: 4.5 },
  end: { clipId: "page-10", offset: 1.05 },
};
describe("presentation cue references", () => {
  it("preserves static cuts and rejects unsupported transitions", () => {
    const cut = { ...cue, transition: "cut" };
    expect(parseCues(JSON.stringify({ version: 1, segments: [cut] }))).toEqual([cut]);
    expect(() =>
      parseCues(JSON.stringify({ version: 1, segments: [{ ...cue, transition: "unknown" }] })),
    ).toThrow();
  });
  it("resolves a cross-page range and follows preceding page edits", () => {
    expect(resolveCue(cue, clips, 136)).toEqual({ start: 68.5, end: 73.05 });
    expect(
      resolveCue(
        cue,
        clips.map((c) => ({ ...c, start: c.start + 4 })),
        140,
      ),
    ).toEqual({ start: 72.5, end: 77.05 });
  });
  it("anchors a page boundary to the following page", () => {
    expect(anchorAt(72, clips)).toEqual({ clipId: "page-10", offset: 0 });
  });
  it("invalidates deleted, shortened, or reordered references", () => {
    expect(resolveCue(cue, clips.slice(1), 136)).toBeNull();
    expect(resolveCue(cue, [{ ...clips[0], duration: 4 }, clips[1]], 136)).toBeNull();
    expect(resolveCue(cue, [clips[0], { ...clips[1], start: 0 }], 136)).toBeNull();
  });
  it("rejects malformed and duplicate saved segments without dropping data", () => {
    expect(parseCues(null)).toEqual([]);
    expect(parseCues(JSON.stringify({ version: 1, segments: [cue] }))).toEqual([cue]);
    expect(() => parseCues('{"version":2,"segments":[]}')).toThrow();
    expect(() => parseCues(JSON.stringify({ version: 1, segments: [cue, cue] }))).toThrow();
    expect(() =>
      parseCues(
        JSON.stringify({ version: 1, segments: [{ ...cue, start: { clipId: null, offset: -1 } }] }),
      ),
    ).toThrow();
  });
});

it("anchors foreground pages instead of a shared background", () => {
  expect(
    anchorAt(68.5, [
      {
        id: "background",
        compositionSrc: "backgrounds/background-08-10.html",
        start: 56,
        duration: 24,
      },
      ...clips,
    ]),
  ).toEqual({ clipId: "page-09", offset: 4.5 });
});
