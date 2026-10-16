import { serializeStudioFileMutation } from "./studioFileMutationCoordinator";
import type { RecordEditInput } from "./studioFileHistory";

/** Keep the child beside its source: relative assets and nested composition URLs stay valid. */
export function buildPageTimeGroup(
  source: string,
  fileName: string,
  duration: number,
  key: string,
) {
  const doc = new DOMParser().parseFromString(source, "text/html");
  const root = doc.body.querySelector(":scope > [data-composition-id]");
  if (!root || doc.querySelector("template"))
    throw new Error("请先在总时间轴打开一个完整页面，再将页面打组。");
  const compId = root.getAttribute("data-composition-id");
  const width = Number(root.getAttribute("data-width"));
  const height = Number(root.getAttribute("data-height"));
  const length = Number(root.getAttribute("data-duration")) || duration;
  if (!compId || ![width, height, length].every((n) => Number.isFinite(n) && n > 0))
    throw new Error("页面缺少有效的画布尺寸或时长。");
  const parent = document.implementation.createHTMLDocument(doc.title || "时间组");
  const style = parent.createElement("style");
  style.textContent = `html,body{margin:0;width:${width}px;height:${height}px;overflow:hidden}#timeline-${key}{position:relative;width:100%;height:100%;overflow:hidden}`;
  parent.head.appendChild(style);
  const stage = parent.createElement("div");
  stage.id = "timeline-" + key;
  stage.setAttribute("data-no-timeline", "");
  for (const [name, value] of Object.entries({
    "data-composition-id": stage.id,
    "data-start": "0",
    "data-duration": String(length),
    "data-width": String(width),
    "data-height": String(height),
  }))
    stage.setAttribute(name, value);
  const host = parent.createElement("div");
  host.id = compId;
  host.className = "clip";
  host.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
  for (const [name, value] of Object.entries({
    "data-composition-id": compId,
    "data-composition-src": fileName,
    "data-start": "0",
    "data-duration": String(length),
    "data-track-index": "0",
    "data-label": doc.title || "时间组",
  }))
    host.setAttribute(name, value);
  stage.appendChild(host);
  parent.body.appendChild(stage);
  return "<!doctype html>\n" + parent.documentElement.outerHTML;
}

export async function commitPageTimeGroup(input: {
  path: string;
  childPath: string;
  key: string;
  duration: number;
  readFile: (path: string) => Promise<string>;
  readOptionalFile: (path: string) => Promise<string>;
  writeFile: (path: string, content: string, expected?: string) => Promise<void>;
  recordEdit: (entry: RecordEditInput) => Promise<void>;
}) {
  return serializeStudioFileMutation(input.writeFile, input.path, async () => {
    const before = await input.readFile(input.path);
    if (await input.readOptionalFile(input.childPath))
      throw new Error("时间组文件已存在，请重试。");
    const name = input.childPath.slice(input.childPath.lastIndexOf("/") + 1);
    const after = buildPageTimeGroup(before, name, input.duration, input.key);
    await input.writeFile(input.childPath, before);
    await input.writeFile(input.path, after, before);
    try {
      await input.recordEdit({
        label: "页面打组",
        files: { [input.path]: { before, after } },
        created: [input.childPath],
      });
    } catch (error) {
      await input.writeFile(input.path, before, after);
      throw error;
    }
    return after;
  });
}
