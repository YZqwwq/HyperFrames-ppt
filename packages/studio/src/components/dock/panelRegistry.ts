import { t } from "../../i18n";
import type { Direction } from "dockview-react";

export const PANEL_IDS = [
  "preview",
  "timeline",
  "compositions",
  "assets",
  "code",
  "catalog",
  "design",
  "layers",
  "renders",
  "variables",
  "slideshow",
] as const;

export type PanelId = (typeof PANEL_IDS)[number];
export type PanelZone = "left" | "center" | "right";

export interface PanelDefinition {
  title: string;
  zone: PanelZone;
  /** Where Window > <panel> puts it when it has no saved place: next to `near`. */
  reopen: { near: PanelId; direction: Direction };
  /** Content stays mounted while its tab is hidden (the preview iframe must not reload). */
  keepMounted?: true;
}

export const PANEL_DEFINITIONS = {
  preview: {
    title: t("panel.preview"),
    zone: "center",
    reopen: { near: "timeline", direction: "above" },
    keepMounted: true,
  },
  timeline: {
    title: t("panel.timeline"),
    zone: "center",
    reopen: { near: "preview", direction: "below" },
    keepMounted: true,
  },
  compositions: {
    title: t("panel.compositions"),
    zone: "left",
    reopen: { near: "preview", direction: "left" },
  },
  assets: {
    title: t("panel.assets"),
    zone: "left",
    reopen: { near: "compositions", direction: "within" },
  },
  code: {
    title: t("panel.code"),
    zone: "left",
    reopen: { near: "compositions", direction: "within" },
  },
  catalog: {
    title: t("panel.catalog"),
    zone: "left",
    reopen: { near: "compositions", direction: "within" },
  },
  design: {
    title: t("panel.design"),
    zone: "right",
    reopen: { near: "preview", direction: "right" },
  },
  layers: {
    title: t("panel.layers"),
    zone: "right",
    reopen: { near: "design", direction: "within" },
  },
  renders: {
    title: t("panel.renders"),
    zone: "right",
    reopen: { near: "design", direction: "within" },
  },
  variables: {
    title: t("panel.variables"),
    zone: "right",
    reopen: { near: "design", direction: "within" },
  },
  slideshow: {
    title: t("panel.slideshow"),
    zone: "right",
    reopen: { near: "design", direction: "within" },
  },
} as const satisfies Record<PanelId, PanelDefinition>;

export function isPanelId(value: unknown): value is PanelId {
  return typeof value === "string" && (PANEL_IDS as readonly string[]).includes(value);
}

export function panelsInZone(zone: PanelZone): PanelId[] {
  return PANEL_IDS.filter((id) => PANEL_DEFINITIONS[id].zone === zone);
}
