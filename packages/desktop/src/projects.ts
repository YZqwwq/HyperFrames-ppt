import { mkdir, readFile, writeFile, rename, realpath, stat, copyFile } from "node:fs/promises";
import { join, basename, dirname } from "node:path";
import { constants } from "node:fs";
export interface RecentProject {
  path: string;
  name: string;
  openedAt: string;
}
export async function validateProject(path: string): Promise<string> {
  const resolved = await realpath(path);
  if (!(await stat(join(resolved, "index.html"))).isFile())
    throw new Error("请选择含 index.html 的项目文件夹。");
  return resolved;
}
export async function readRecents(file: string): Promise<RecentProject[]> {
  try {
    const value: unknown = JSON.parse(await readFile(file, "utf8"));
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (item): item is RecentProject =>
          item &&
          typeof item.path === "string" &&
          typeof item.name === "string" &&
          typeof item.openedAt === "string",
      )
      .slice(0, 12);
  } catch (error) {
    if (
      error instanceof SyntaxError ||
      (error instanceof Error && "code" in error && error.code === "ENOENT")
    )
      return [];
    throw error;
  }
}
export async function rememberProject(file: string, path: string): Promise<void> {
  const current = await readRecents(file);
  const next = [
    { path, name: basename(path), openedAt: new Date().toISOString() },
    ...current.filter((p) => p.path !== path),
  ].slice(0, 12);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2), "utf8");
  await rename(`${file}.tmp`, file);
}
export async function createProject(path: string, template: string): Promise<string> {
  // An existing directory is never reused or overwritten by New Project.
  await mkdir(path);
  await copyFile(template, join(path, "index.html"), constants.COPYFILE_EXCL);
  return validateProject(path);
}
