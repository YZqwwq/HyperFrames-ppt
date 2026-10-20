import { readFileSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  bundleToSingleHtml,
  insertRuntimeTag,
  stripEmbeddedRuntimeScripts,
  AFTER_FONTS_SCRIPT_TYPE,
  RUNTIME_BOOTSTRAP_ATTR,
} from "@hyperframes/core/compiler";
import { getHyperframeRuntimeScript } from "@hyperframes/core";
import {
  createStudioManualEditsRenderBodyScript,
  createStudioPositionSeekReapplyScript,
  STUDIO_MANUAL_EDITS_PATH,
} from "./manualEditsRenderScript.js";
import {
  createStudioMotionRenderBodyScript,
  STUDIO_MOTION_PATH,
} from "./studioMotionRenderScript.js";
import { ProjectExportError } from "./editableProjectExport.js";
import { embedPresentationAssets } from "./presentationExportAssets.js";
import { resolvePresentationExportCues } from "./presentationExportCues.js";
import { buildPresentationPlayer } from "./presentationExportPlayer.js";

export async function exportPresentation(dir: string, title: string): Promise<string> {
  const snapshots = new Map<string, { size: number; mtime: number }>();
  let total = 0;
  function onRead(path: string) {
    if (snapshots.has(path)) return;
    if (!existsSync(path)) throw new ProjectExportError("作品资源缺失，请确认素材已保存后重试。");
    const stat = statSync(path);
    if (!stat.isFile()) throw new ProjectExportError("作品引用了非文件资源。");
    total += stat.size;
    if (total > 256 * 1024 * 1024)
      throw new ProjectExportError("放映文件素材超过 256 MB，请压缩素材后重试。");
    snapshots.set(path, { size: stat.size, mtime: stat.mtimeMs });
  }
  function read(path: string) {
    const full = join(dir, path);
    onRead(full);
    return readFileSync(full, "utf8");
  }
  if (!existsSync(join(dir, "presentation-cues.json")))
    throw new ProjectExportError("请先设置演示打点，再导出 PPT 浏览器放映。");
  const cues = read("presentation-cues.json");
  // Large assets are packed once by our resource table, rather than duplicated per scene.
  let html = await bundleToSingleHtml(dir, { inlineAssets: false, runtime: "inline", onRead });
  // An environment-configured CDN runtime must never turn this offline export into an online file.
  html = insertRuntimeTag(
    stripEmbeddedRuntimeScripts(html),
    `<script ${RUNTIME_BOOTSTRAP_ATTR}="1">${getHyperframeRuntimeScript().replace(/<\/script/gi, "<\\/script")}</script>`,
  );
  const scripts: string[] = [];
  if (existsSync(join(dir, STUDIO_MANUAL_EDITS_PATH))) {
    const script = createStudioManualEditsRenderBodyScript(read(STUDIO_MANUAL_EDITS_PATH), {
      activeCompositionPath: "index.html",
    });
    if (script) scripts.push(script);
  }
  if (existsSync(join(dir, STUDIO_MOTION_PATH))) {
    const script = createStudioMotionRenderBodyScript(read(STUDIO_MOTION_PATH), {
      activeCompositionPath: "index.html",
    });
    if (script) scripts.push(script);
  }
  scripts.push(createStudioPositionSeekReapplyScript());
  html = html.replace(
    /<\/body>/i,
    `${scripts.map((script) => `<script type="${AFTER_FONTS_SCRIPT_TYPE}">${script.replace(/<\/script/gi, "<\\/script")}</script>`).join("\n")}</body>`,
  );
  let timing: ReturnType<typeof resolvePresentationExportCues>;
  try {
    timing = resolvePresentationExportCues(cues, html);
  } catch (error) {
    if (error instanceof ProjectExportError) throw error;
    throw new ProjectExportError("演示打点文件无效，请在编辑器中检查后重试。");
  }
  const embedded = embedPresentationAssets(html, dir, onRead);
  for (const [path, before] of snapshots) {
    const after = statSync(path);
    if (after.size !== before.size || after.mtimeMs !== before.mtime)
      throw new ProjectExportError("导出期间作品发生变化，请保存完成后重试。");
  }
  return buildPresentationPlayer({ title, ...timing, ...embedded });
}
