// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PresentationControls } from "./PresentationControls";
import { usePlayerStore } from "../../player/store/playerStore";
import { t } from "../../i18n";

vi.mock("../dock/PreviewToolbarSlot", () => ({ usePreviewToolbarSlot: () => null }));
vi.mock("../../contexts/FileManagerContext", () => ({
  useFileManagerContext: () => ({
    readOptionalProjectFile: async () =>
      JSON.stringify({
        version: 1,
        segments: [
          {
            id: "cue",
            label: "Test cue",
            start: { clipId: "missing", offset: 1 },
            end: { clipId: "missing", offset: 2 },
          },
        ],
      }),
  }),
}));
vi.mock("../../contexts/StudioContext", () => ({ useStudioShellContext: () => ({}) }));
vi.mock("../nle/NLEContext", () => ({
  useNLEContext: () => ({
    projectId: "test",
    compositionStack: ["main"],
    pause: vi.fn(),
    seek: vi.fn(),
  }),
}));
vi.mock("./useCuePlayback", () => ({ useCuePlayback: () => ({ session: null }) }));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

it("does not report cue validity before the timeline is ready", async () => {
  const previous = usePlayerStore.getState();
  const host = document.createElement("div");
  const root = createRoot(host);
  try {
    usePlayerStore.setState({ timelineReady: false, duration: 0, elements: [] });
    await act(async () =>
      root.render(
        <PresentationControls
          stage={{ current: null }}
          onActiveChange={() => {}}
          browsing={false}
          onBrowseChange={() => {}}
        />,
      ),
    );
    expect(host.textContent).not.toContain(t("presentation.invalid"));
    expect(host.querySelector("select")?.disabled).toBe(true);
    expect(host.querySelector("select")?.textContent).toContain(t("presentation.loading"));
    act(() => usePlayerStore.setState({ timelineReady: true, duration: 10 }));
    expect(host.querySelector("select")?.textContent).toContain(t("presentation.invalid"));
  } finally {
    act(() => root.unmount());
    usePlayerStore.setState(previous, true);
  }
});
