import { afterEach, expect, it } from "vitest";
import { Hono } from "hono";
import { mkdtemp, mkdir, writeFile, rm, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { unzipSync, strFromU8 } from "fflate";
import { createHash } from "node:crypto";
import { stubAdapter } from "./stubAdapter.test-helpers";
import { registerProjectExportRoutes } from "./projectExport";

const dirs: string[] = [];
afterEach(async () => {
  for (const dir of dirs.splice(0)) await rm(dir, { recursive: true, force: true });
});
async function setup() {
  const dir = await mkdtemp(join(tmpdir(), "hf-export-"));
  dirs.push(dir);
  const app = new Hono();
  registerProjectExportRoutes(app, stubAdapter(dir));
  async function put(path: string, data: string | Uint8Array) {
    const full = join(dir, path);
    await mkdir(join(full, ".."), { recursive: true });
    await writeFile(full, data);
  }
  return { dir, app, put };
}
it("exports editable sources, Unicode assets, cues and edit state, excluding private/cache files", async () => {
  const { app, put } = await setup();
  await put("index.html", '<div data-composition-id="root">可编辑</div>');
  await put("assets/字体.ttf", new Uint8Array([0, 1, 2, 3]));
  await put("presentation-cues.json", '{"segments":[]}');
  await put(".hyperframes/studio-motion.json", '{"motions":[]}');
  await put(".hyperframes/studio-manual-edits.json", "{}");
  await put(".hyperframes/prepared-assets/image.png", "image");
  for (const path of [
    ".env",
    ".git/config",
    ".hyperframes/chat.json",
    ".hyperframes/requests/prompt.txt",
    ".thumbnails/x.png",
    "node_modules/a.js",
  ])
    await put(path, "private");
  const response = await app.request("/projects/demo/export/editable");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("application/zip");
  const files = unzipSync(new Uint8Array(await response.arrayBuffer()));
  expect(strFromU8(files["project/index.html"]!)).toContain("可编辑");
  expect(files["project/assets/字体.ttf"]).toEqual(new Uint8Array([0, 1, 2, 3]));
  expect(files["project/.hyperframes/studio-motion.json"]).toBeDefined();
  expect(files["project/.hyperframes/studio-manual-edits.json"]).toBeDefined();
  expect(files["project/.hyperframes/prepared-assets/image.png"]).toBeDefined();
  expect(
    Object.keys(files).some((path) =>
      /\.env|chat.json|requests|thumbnails|node_modules|\.git\//.test(path),
    ),
  ).toBe(false);
  const manifest = JSON.parse(strFromU8(files["future-ppt-project.json"]!));
  expect(manifest.entry).toBe("project/index.html");
  for (const file of manifest.files)
    expect(createHash("sha256").update(files[`project/${file.path}`]!).digest("hex")).toBe(
      file.sha256,
    );
  expect(files["START_HERE_AI.txt"]).toBeDefined();
  expect(files["PRESENTATION_RULES.md"]).toBeDefined();
});
it("rejects missing entry and unfetched LFS assets instead of exporting an unusable project", async () => {
  const { app, put } = await setup();
  expect((await app.request("/projects/demo/export/editable")).status).toBe(422);
  await put("index.html", "<html></html>");
  await put("assets/font.ttf", "version https://git-lfs.github.com/spec/v1\noid sha256:abc");
  const response = await app.request("/projects/demo/export/editable");
  expect(response.status).toBe(422);
  expect(await response.text()).toContain("git lfs pull");
});
it("refuses linked directories rather than following them outside the project", async () => {
  const { app, put, dir } = await setup();
  await put("index.html", "<html></html>");
  const outside = await mkdtemp(join(tmpdir(), "hf-outside-"));
  dirs.push(outside);
  await symlink(outside, join(dir, "assets"), "junction");
  expect((await app.request("/projects/demo/export/editable")).status).toBe(422);
});
