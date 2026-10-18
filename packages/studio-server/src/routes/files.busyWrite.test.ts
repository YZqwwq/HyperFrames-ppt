// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Hono } from "hono";
import { registerFileRoutes } from "./files";
import { stubAdapter } from "./stubAdapter.test-helpers";

vi.mock("@hyperframes/core/atomic-file", async (original) => ({
  ...(await original<typeof import("@hyperframes/core/atomic-file")>()),
  replaceFileAtomically: () => {
    throw Object.assign(new Error("locked"), { code: "EPERM" });
  },
}));
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
it("returns an actionable JSON error and keeps source bytes when the target remains locked", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hf-busy-save-"));
  dirs.push(dir);
  const source =
    '<div id="title">Title</div><script>const tl = gsap.timeline(); tl.to("#title", {x: 10, duration: 1}, 0);</script>';
  writeFileSync(join(dir, "index.html"), source);
  const app = new Hono();
  registerFileRoutes(app, stubAdapter(dir));
  const result = await app.request(
    "http://localhost/projects/demo/file-mutations/patch-element/index.html",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        target: { id: "title" },
        operations: [{ type: "inline-style", property: "color", value: "red" }],
      }),
    },
  );
  expect(result.status).toBe(423);
  expect(await result.json()).toMatchObject({ code: "FILE_WRITE_BLOCKED", path: "index.html" });
  expect(readFileSync(join(dir, "index.html"), "utf-8")).toBe(source);
});
