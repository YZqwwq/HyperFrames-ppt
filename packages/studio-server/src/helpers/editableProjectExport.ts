import { readdir, lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { zip, strToU8, type Zippable } from "fflate";
import { resolveWithinProject } from "./safePath.js";

const MAX_BYTES = 256 * 1024 * 1024;
const MAX_FILES = 10000;
const OMIT = new Set(["node_modules", "dist", "renders", "output", "tmp", "coverage"]);
const EDIT_STATE = new Set([
  ".hyperframes/studio-manual-edits.json",
  ".hyperframes/studio-motion.json",
]);

export class ProjectExportError extends Error {}

function include(path: string, directory: boolean): boolean {
  if (path === ".hyperframes") return directory;
  if (EDIT_STATE.has(path)) return !directory;
  if (path === ".hyperframes/prepared-assets" || path.startsWith(".hyperframes/prepared-assets/"))
    return true;
  return (
    !path.split("/").some((part) => part.startsWith(".") || OMIT.has(part)) &&
    !/\.(?:log|tmp|bak|pem|key|p12|pfx)$/i.test(path)
  );
}

const RULES = `# Future PPT 可编辑项目规范

- 本包是 HTML / CSS / GSAP 原生演示工程，不是 PowerPoint PPTX。
- 以连续对象动画为基础，再建立点击播放区间和演示停留帧。
- 跨页复用主体只保留一个拥有者；同一时刻同一属性不能由多条动画覆盖。
- 保留元素 ID、相对路径、背景与正文分层、字体、演示打点和时序依赖。
- 修改起止状态应仅改变所选动画端点；修改时长需要检查关联内容。
- 保留 .hyperframes 中随包导出的手动编辑与动画数据。
- 若项目内存在 PRESENTATION_RULES.md / AGENTS.md，继续遵守其项目特定规范。
- 修改后使用应用预览验证起止帧、反复定位、点击放映及内容完整性。
`;

/** Capture an authored project, including runtime-relevant edit state, without private host records. */
export async function exportEditableProject(dir: string, title: string): Promise<Uint8Array> {
  const files: string[] = [];
  async function walk(prefix = "") {
    const entries = await readdir(join(dir, prefix), { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!include(path, entry.isDirectory())) continue;
      if (entry.isSymbolicLink())
        throw new ProjectExportError(`请先将链接资源复制到项目目录：${path}`);
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) files.push(path);
      if (files.length > MAX_FILES)
        throw new ProjectExportError("项目文件过多，请移除无关文件后重试。");
    }
  }
  await walk();
  if (!files.includes("index.html")) throw new ProjectExportError("项目缺少 index.html 入口。");
  const archive: Zippable = Object.create(null);
  const manifest: Array<{ path: string; bytes: number; sha256: string }> = [];
  const snapshots: Array<{ path: string; size: number; mtime: number }> = [];
  const names = new Set<string>();
  let total = 0;
  for (const path of files) {
    const normalized = path.normalize("NFC").toLowerCase();
    if (names.has(normalized)) throw new ProjectExportError(`文件名在其他设备上可能冲突：${path}`);
    names.add(normalized);
    const safe = resolveWithinProject(dir, path);
    if (!safe) throw new ProjectExportError(`无法读取项目内资源：${path}`);
    const before = await lstat(safe);
    if (!before.isFile()) throw new ProjectExportError(`资源已变化，请重试：${path}`);
    total += before.size;
    if (total > MAX_BYTES) throw new ProjectExportError("项目超过 256 MB，请移除无关素材后重试。");
    const bytes = await readFile(safe);
    if (bytes.subarray(0, 80).toString().startsWith("version https://git-lfs.github.com/spec/")) {
      throw new ProjectExportError(`资源尚未下载，请先运行 git lfs pull：${path}`);
    }
    archive[`project/${path}`] = bytes;
    manifest.push({
      path,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    snapshots.push({ path: safe, size: before.size, mtime: before.mtimeMs });
  }
  // Do not label a moving project as a coherent export; the user can retry after saving.
  for (const snapshot of snapshots) {
    const after = await lstat(snapshot.path);
    if (after.size !== snapshot.size || after.mtimeMs !== snapshot.mtime) {
      throw new ProjectExportError("导出期间项目发生变化，请等待保存完成后重试。");
    }
  }
  archive["future-ppt-project.json"] = strToU8(
    JSON.stringify(
      {
        format: "future-ppt-editable",
        schemaVersion: 1,
        title,
        entry: "project/index.html",
        projectRoot: "project",
        files: manifest,
      },
      null,
      2,
    ),
  );
  archive["PRESENTATION_RULES.md"] = strToU8(RULES);
  archive["START_HERE_AI.txt"] = strToU8(
    `Future PPT 可编辑演示项目\n\n解压完整 ZIP，在本应用中打开 project 文件夹（含 index.html）。不要只打开单个页面文件。\n\n交给 AI：先阅读 future-ppt-project.json、PRESENTATION_RULES.md 和项目自身的规范，继续编辑现有 HTML / GSAP 源文件。保留资源相对路径、元素 ID 和演示打点。\n\nWindows / macOS 均使用同一份素材。字体、图片及本地素材包含在 project 内；外部 URL 资源仍需联网，本导出不会下载外部资源。\n本包不含应用程序、依赖安装目录、聊天记录或撤销历史。请使用兼容的 Future PPT 应用版本打开。无需 FFmpeg。\n清单包含 SHA-256 校验值，可用于核对文件完整性。\n`,
  );
  return new Promise((resolve, reject) =>
    zip(archive, { level: 6 }, (error, data) => (error ? reject(error) : resolve(data))),
  );
}
