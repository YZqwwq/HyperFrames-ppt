import { parseHTML } from "linkedom";
import { ProjectExportError } from "./editableProjectExport.js";

export interface PresentationRange {
  label: string;
  start: number;
  end: number;
  transition: "cut" | "animate";
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Resolve the same clip-relative anchors used by Studio, against compiled master timing. */
export function resolvePresentationExportCues(source: string, html: string) {
  const { document } = parseHTML(html);
  const root = document.querySelector("[data-composition-id]");
  const duration = Number(root?.getAttribute("data-duration"));
  const width = Number(root?.getAttribute("data-width"));
  const height = Number(root?.getAttribute("data-height"));
  if (![duration, width, height].every((n) => Number.isFinite(n) && n > 0))
    throw new ProjectExportError("作品缺少有效时长或画布尺寸。");
  const data: unknown = JSON.parse(source);
  if (!record(data) || data.version !== 1 || !Array.isArray(data.segments) || !data.segments.length)
    throw new ProjectExportError("请先在编辑器中设置演示打点，再导出 PPT 浏览器放映。");
  function anchor(value: unknown): number {
    if (
      !record(value) ||
      typeof value.offset !== "number" ||
      !Number.isFinite(value.offset) ||
      value.offset < 0
    )
      throw new ProjectExportError("演示打点格式无效。");
    if (value.clipId === null) return value.offset;
    if (typeof value.clipId !== "string") throw new ProjectExportError("演示打点缺少元素引用。");
    const matches = [...document.querySelectorAll("[id]")].filter((el) => el.id === value.clipId);
    const el = matches[0];
    if (matches.length !== 1 || !el)
      throw new ProjectExportError(`演示打点引用缺失或重复：${value.clipId}`);
    const start = Number(el.getAttribute("data-start"));
    const length = Number(el.getAttribute("data-duration"));
    if (
      !el.hasAttribute("data-start") ||
      !el.hasAttribute("data-duration") ||
      !Number.isFinite(start) ||
      !Number.isFinite(length) ||
      value.offset > length
    )
      throw new ProjectExportError(`演示打点已超出元素时长：${value.clipId}`);
    return start + value.offset;
  }
  const ids = new Set<string>();
  const ranges: PresentationRange[] = data.segments.map((cue) => {
    if (
      !record(cue) ||
      typeof cue.id !== "string" ||
      ids.has(cue.id) ||
      typeof cue.label !== "string" ||
      (cue.transition !== undefined && cue.transition !== "cut" && cue.transition !== "animate")
    )
      throw new ProjectExportError("演示打点格式无效或重复。");
    ids.add(cue.id);
    const start = anchor(cue.start),
      end = anchor(cue.end);
    if (end <= start || start < 0 || end > duration)
      throw new ProjectExportError(`演示区间无效：${cue.label}`);
    return { label: cue.label, start, end, transition: cue.transition ?? "animate" };
  });
  return { ranges, width, height };
}
