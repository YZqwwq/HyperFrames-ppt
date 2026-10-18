export interface CueAnchor {
  clipId: string | null;
  offset: number;
}
export interface PresentationCue {
  transition?: "cut" | "animate";
  id: string;
  label: string;
  start: CueAnchor;
  end: CueAnchor;
}
export interface CueClip {
  id: string;
  start: number;
  duration: number;
  compositionSrc?: string;
}
export const CUE_FILE = "presentation-cues.json";
function isAnchor(value: unknown): value is CueAnchor {
  return (
    typeof value === "object" &&
    value !== null &&
    "clipId" in value &&
    (value.clipId === null || typeof value.clipId === "string") &&
    "offset" in value &&
    typeof value.offset === "number" &&
    Number.isFinite(value.offset) &&
    value.offset >= 0
  );
}
export function parseCues(source: string | null): PresentationCue[] {
  if (source === null) return [];
  const data: unknown = JSON.parse(source);
  if (
    typeof data !== "object" ||
    data === null ||
    !("version" in data) ||
    data.version !== 1 ||
    !("segments" in data) ||
    !Array.isArray(data.segments)
  )
    throw new Error("Invalid presentation-cues.json");
  const result: PresentationCue[] = [];
  for (const cue of data.segments) {
    if (
      !cue ||
      typeof cue.id !== "string" ||
      typeof cue.label !== "string" ||
      !isAnchor(cue.start) ||
      !isAnchor(cue.end) ||
      result.some((item) => item.id === cue.id) ||
      (cue.transition !== undefined && cue.transition !== "cut" && cue.transition !== "animate")
    )
      throw new Error("Invalid presentation cue");
    result.push({
      id: cue.id,
      label: cue.label,
      start: cue.start,
      end: cue.end,
      ...(cue.transition ? { transition: cue.transition } : {}),
    });
  }
  return result;
}
export function anchorAt(time: number, clips: CueClip[]): CueAnchor {
  // Background compositions span pages and must never become presentation anchors.
  const clip = clips
    .filter(
      (item) =>
        item.compositionSrc &&
        !/(^|\/)backgrounds\//.test(item.compositionSrc) &&
        time >= item.start &&
        time < item.start + item.duration,
    )
    .sort((a, b) => a.duration - b.duration)[0];
  return { clipId: clip?.id ?? null, offset: time - (clip?.start ?? 0) };
}
export function resolveAnchor(
  anchor: CueAnchor,
  clips: CueClip[],
  duration: number,
): number | null {
  if (anchor.clipId === null) return anchor.offset <= duration ? anchor.offset : null;
  const clip = clips.find((item) => item.id === anchor.clipId);
  if (!clip || anchor.offset > clip.duration) return null;
  const time = clip.start + anchor.offset;
  return time <= duration ? time : null;
}
export function resolveCue(cue: PresentationCue, clips: CueClip[], duration: number) {
  const start = resolveAnchor(cue.start, clips, duration);
  const end = resolveAnchor(cue.end, clips, duration);
  return start !== null && end !== null && end > start ? { start, end } : null;
}
