// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";
import { buildPageTimeGroup, commitPageTimeGroup } from "./pageTimeGroup";
const source =
  '<!doctype html><html><head><title>Hello &amp; world</title><script src="assets/gsap.js"></script></head><body><div id="root" data-composition-id="letters" data-width="1920" data-height="1080" data-duration="5"><span id="a" data-start="0.4">a</span></div><script>window.__timelines["letters"] = tl;</script></body></html>';
describe("page time groups", () => {
  it("replaces the page with one timed composition host and escapes labels", () => {
    const result = buildPageTimeGroup(source, "group.html", 9, "test");
    const doc = new DOMParser().parseFromString(result, "text/html");
    expect(doc.querySelectorAll(".clip")).toHaveLength(1);
    const host = doc.querySelector(".clip")!;
    expect(host.getAttribute("data-duration")).toBe("5");
    expect(host.getAttribute("data-composition-src")).toBe("group.html");
    expect(host.getAttribute("data-composition-id")).toBe("letters");
    expect(host.getAttribute("data-label")).toBe("Hello & world");
    expect(doc.querySelector("script")).toBeNull();
  });
  it("rejects unsupported roots instead of damaging the original", () => {
    expect(() => buildPageTimeGroup("<p>plain</p>", "g.html", 5, "test")).toThrow();
  });
  it("preserves the complete child source and records a created file for undo/redo", async () => {
    const writes: string[] = [];
    const writeFile = vi.fn(async (path: string) => {
      writes.push(path);
    });
    const recordEdit = vi.fn(async () => {});
    await commitPageTimeGroup({
      path: "scenes/page.html",
      childPath: "scenes/g.html",
      key: "test",
      duration: 5,
      readFile: async () => source,
      readOptionalFile: async () => "",
      writeFile,
      recordEdit,
    });
    expect(writes).toEqual(["scenes/g.html", "scenes/page.html"]);
    expect(writeFile.mock.calls[0]).toEqual(["scenes/g.html", source]);
    expect(recordEdit.mock.calls[0]?.[0]).toMatchObject({
      created: ["scenes/g.html"],
      files: { "scenes/page.html": { before: source } },
    });
  });
  it("restores the page if recording history fails", async () => {
    const writeFile = vi.fn(async () => {});
    await expect(
      commitPageTimeGroup({
        path: "index.html",
        childPath: "g.html",
        key: "test",
        duration: 5,
        readFile: async () => source,
        readOptionalFile: async () => "",
        writeFile,
        recordEdit: async () => {
          throw new Error("history offline");
        },
      }),
    ).rejects.toThrow("history offline");
    expect(writeFile.mock.calls.at(-1)?.slice(0, 2)).toEqual(["index.html", source]);
  });
  it("does not write when a child already exists", async () => {
    const writeFile = vi.fn(async () => {});
    await expect(
      commitPageTimeGroup({
        path: "index.html",
        childPath: "g.html",
        key: "test",
        duration: 5,
        readFile: async () => source,
        readOptionalFile: async () => source,
        writeFile,
        recordEdit: async () => {},
      }),
    ).rejects.toThrow();
    expect(writeFile).not.toHaveBeenCalled();
  });
});
