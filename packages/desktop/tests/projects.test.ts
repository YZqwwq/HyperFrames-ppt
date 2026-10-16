import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, expect, it } from "vitest";
import { createProject, readRecents, rememberProject, validateProject } from "../src/projects.js";
const owned: string[] = [];
async function temporary() {
  const path = await mkdtemp(join(tmpdir(), "future-ppt-desktop-"));
  owned.push(path);
  return path;
}
afterEach(async () => {
  for (const path of owned.splice(0)) {
    if (!resolve(path).startsWith(resolve(tmpdir()) + sep))
      throw new Error("Unexpected test cleanup path");
    await rm(path, { recursive: true, force: true });
  }
});
it("rejects folders without a composition and preserves existing projects on New", async () => {
  const root = await temporary();
  await expect(validateProject(root)).rejects.toThrow();
  const template = join(root, "template.html");
  await writeFile(template, "<!doctype html><title>Template</title>");
  const project = join(root, "中文 project");
  expect(await createProject(project, template)).toBe(await validateProject(project));
  await writeFile(join(project, "index.html"), "user changes");
  await expect(createProject(project, template)).rejects.toThrow();
  expect(await readFile(join(project, "index.html"), "utf8")).toBe("user changes");
});
it("rejects an index.html directory", async () => {
  const root = await temporary();
  await mkdir(join(root, "index.html"));
  await expect(validateProject(root)).rejects.toThrow("index.html");
});
it("keeps recent projects unique, ordered and bounded across reloads", async () => {
  const root = await temporary();
  const file = join(root, "settings", "recents.json");
  for (let i = 0; i < 15; i++) await rememberProject(file, join(root, `project-${i}`));
  await rememberProject(file, join(root, "project-8"));
  const recents = await readRecents(file);
  expect(recents).toHaveLength(12);
  expect(recents[0].name).toBe("project-8");
  expect(new Set(recents.map((p) => p.path)).size).toBe(12);
});
it("recovers a malformed recents file without accepting malformed entries", async () => {
  const root = await temporary();
  const file = join(root, "recents.json");
  expect(await readRecents(file)).toEqual([]);
  await writeFile(file, "broken JSON");
  expect(await readRecents(file)).toEqual([]);
  await writeFile(
    file,
    JSON.stringify([null, { path: 1 }, { path: "ok", name: "ok", openedAt: "today" }]),
  );
  expect(await readRecents(file)).toEqual([{ path: "ok", name: "ok", openedAt: "today" }]);
});
