import { existsSync, readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { findTimelineScript, parseGsapScriptAcorn } from "@hyperframes/parsers/gsap-parser-acorn";
import { updateAnimationInScript } from "@hyperframes/parsers/gsap-writer-acorn";
import { pinWithinProject } from "./safePath.js";
import type { FileMutationInput } from "./applyFileMutations.js";

interface TweenRef {
  file: string;
  selector: string;
  ordinal: number;
}
interface TimingLink {
  source: TweenRef & { clipId: string };
  content: {
    file: string;
    clipId: string;
    enter: TweenRef;
    exit: TweenRef;
    exitAt: number;
    endAt: number;
  };
  previous: { clipId: string; exit: TweenRef };
  cueId: string;
  nextCueId: string;
  delay: number;
  settle: number;
}
const rounded = (n: number) => Math.round(n * 10000) / 10000;
function finite(n: number) {
  if (!Number.isFinite(n)) throw new Error("Invalid linked animation timing");
  return n;
}

/** Compile explicit cross-composition dependencies, without shifting unrelated animations. */
export function planPresentationTimingLinks(
  projectDir: string,
  editedPath: string,
  after: string,
): FileMutationInput[] {
  const manifest = pinWithinProject(projectDir, "presentation-timing-links.json");
  if (!manifest || !existsSync(manifest)) return [];
  const config = JSON.parse(readFileSync(manifest, "utf8"));
  if (config.version !== 1 || !Array.isArray(config.links))
    throw new Error("Invalid presentation timing links");
  const files = new Map<string, FileMutationInput>();
  const read = (file: string) => {
    if (files.has(file)) return files.get(file)!;
    if (typeof file !== "string" || (!file.endsWith(".html") && file !== "presentation-cues.json"))
      throw new Error("Invalid timing link file");
    const absPath = pinWithinProject(projectDir, file);
    if (!absPath) throw new Error("Timing link path escapes project");
    const before = readFileSync(absPath, "utf8");
    const entry = {
      sourceFile: file,
      absPath,
      before,
      after: file === editedPath ? after : before,
    };
    files.set(file, entry);
    return entry;
  };
  const tween = (ref: TweenRef) => {
    if (!Number.isInteger(ref.ordinal) || ref.ordinal < 0)
      throw new Error("Invalid linked tween ordinal");
    const file = read(ref.file);
    const { document } = parseHTML(file.after);
    const script = findTimelineScript([
      ...document.querySelectorAll("script:not([src])"),
      ...Array.from(document.querySelectorAll("template")).flatMap((template) =>
        Array.from(template.querySelectorAll("script:not([src])")),
      ),
    ]);
    if (!script) throw new Error(`Missing timeline: ${ref.file}`);
    const text = script.textContent ?? "";
    const animation = parseGsapScriptAcorn(text).animations.filter(
      (a) => a.targetSelector === ref.selector && !a.global,
    )[ref.ordinal];
    if (
      !animation ||
      typeof animation.position !== "number" ||
      typeof animation.duration !== "number"
    )
      throw new Error(`Unresolved linked animation: ${ref.file}`);
    return { file, animation, text };
  };
  const move = (ref: TweenRef, position: number) => {
    const { file, animation, text } = tween(ref);
    const next = updateAnimationInScript(text, animation.id, { position: rounded(position) });
    file.after = file.after.replace(text, next);
  };
  for (const link of config.links as TimingLink[]) {
    if (![link.source.file, link.content.enter.file, link.content.exit.file].includes(editedPath))
      continue;
    const master = read("index.html");
    const { document } = parseHTML(master.after);
    const clip = (id: string) => {
      const node = document.getElementById(id);
      if (!node) throw new Error(`Missing linked clip: ${id}`);
      return node;
    };
    const sourceClip = clip(link.source.clipId);
    const contentClip = clip(link.content.clipId);
    const previousClip = clip(link.previous.clipId);
    const source = tween(link.source).animation;
    const start = finite(Number(sourceClip.getAttribute("data-start")) + Number(source.position));
    const enterAt = rounded(finite(start + Number(source.duration) + link.delay));
    const enterDuration = Number(tween(link.content.enter).animation.duration);
    const stopAt = rounded(finite(enterAt + enterDuration + link.settle));
    const previousStart = Number(previousClip.getAttribute("data-start"));
    const previousExit = tween(link.previous.exit).animation;
    if (
      Number(source.duration) <= 0 ||
      enterDuration <= 0 ||
      link.delay < 0 ||
      link.settle < 0 ||
      enterAt <= previousStart ||
      stopAt >= link.content.exitAt ||
      link.content.exitAt >= link.content.endAt ||
      start + Number(previousExit.duration) > enterAt
    )
      throw new Error(
        "Linked timing overlaps the next animation or preceding fade; shorten the transition or adjust its dependencies",
      );
    const oldDuration = Number(contentClip.getAttribute("data-duration"));
    const duration = rounded(link.content.endAt - enterAt);
    contentClip.setAttribute("data-start", String(enterAt));
    contentClip.setAttribute("data-duration", String(duration));
    previousClip.setAttribute("data-duration", String(rounded(enterAt - previousStart)));
    for (const frame of document.querySelectorAll("[data-background-frame][data-linked-clip]")) {
      const owner = document.getElementById(frame.getAttribute("data-linked-clip") ?? "");
      if (!owner) continue;
      frame.setAttribute("data-start", owner.getAttribute("data-start") ?? "0");
      frame.setAttribute("data-duration", owner.getAttribute("data-duration") ?? "0");
    }
    master.after = document.toString();
    move(link.previous.exit, start - previousStart);
    move(link.content.enter, 0);
    move(link.content.exit, link.content.exitAt - enterAt);
    const content = read(link.content.file);
    // Extend the content's local lifetime while preserving its independently pinned exit.
    content.after = content.after.replace(/data-duration="([\d.]+)"/g, (match, value) =>
      Math.abs(Number(value) - oldDuration) < 0.0001 ? `data-duration="${duration}"` : match,
    );
    const cueFile = read("presentation-cues.json");
    const cues = JSON.parse(cueFile.after);
    const cue = cues.segments.find((c: { id: string }) => c.id === link.cueId);
    const nextCue = cues.segments.find((c: { id: string }) => c.id === link.nextCueId);
    if (!cue || !nextCue) throw new Error("Missing linked presentation cue");
    cue.start = { clipId: link.previous.clipId, offset: rounded(start - previousStart) };
    cue.end = { clipId: link.content.clipId, offset: rounded(enterDuration + link.settle) };
    nextCue.start = { clipId: link.content.clipId, offset: rounded(link.content.exitAt - enterAt) };
    cueFile.after = JSON.stringify(cues, null, 2) + "\n";
  }
  return [...files.values()].filter((file) => file.after !== file.before);
}
