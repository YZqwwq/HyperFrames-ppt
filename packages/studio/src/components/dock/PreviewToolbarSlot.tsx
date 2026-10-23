import { createContext, useContext, useState, type ReactNode } from "react";
import type { IDockviewHeaderActionsProps } from "dockview-react";
import { Monitor } from "@phosphor-icons/react";
import { DockStripActions } from "./DockStripActions";
import { PANEL_DEFINITIONS } from "./panelRegistry";

const ToolbarContext = createContext<{
  element: HTMLDivElement | null;
  register: (element: HTMLDivElement | null) => void;
} | null>(null);

export function PreviewToolbarProvider({ children }: { children: ReactNode }) {
  const [element, register] = useState<HTMLDivElement | null>(null);
  return (
    <ToolbarContext.Provider value={{ element, register }}>{children}</ToolbarContext.Provider>
  );
}

export function usePreviewToolbarSlot() {
  return useContext(ToolbarContext)?.element ?? null;
}

export function DockHeaderActions(props: IDockviewHeaderActionsProps) {
  const toolbar = useContext(ToolbarContext);
  const preview = props.activePanel?.id === "preview";
  const single = props.panels.length === 1;
  return (
    <div
      className="hf-dock-header-actions"
      data-preview-header={preview ? (single ? "single" : "tabs") : undefined}
    >
      {preview && single && (
        <span className="hf-preview-heading">
          <Monitor size={14} aria-hidden />
          {PANEL_DEFINITIONS.preview.title}
        </span>
      )}
      {preview && <div ref={toolbar?.register} className="hf-preview-toolbar-slot" />}
      <DockStripActions {...props} />
    </div>
  );
}
