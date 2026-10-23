// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { geometryEditScope, EditingScopeNotice } from "./EditingScopeNotice";
import { LayoutTrialLauncher } from "./LayoutTrial";
import { requestLayoutTrial } from "./layoutTrialEvents";
import { makeSelection } from "../../hooks/domSelectionTestHarness";
import { usePlayerStore } from "../../player/store/playerStore";
import { captureLayoutTrial } from "./layoutTrialSnapshot";
import { t } from "../../i18n";
vi.mock("./layoutTrialSnapshot", async (original) => ({
  ...(await original<typeof import("./layoutTrialSnapshot")>()),
  captureLayoutTrial: vi.fn(() => {
    throw new Error("trial captured");
  }),
}));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

it("keeps direct properties independent of keyframe mode and never grants a disabled edit", () => {
  expect(geometryEditScope(false, true, true)).toBe("direct");
  expect(geometryEditScope(false, false, true)).toBe("keyframe");
  expect(geometryEditScope(false, false, false)).toBe("whole");
  expect(geometryEditScope(true, true, false)).toBe("restricted");
  expect(geometryEditScope(true, false, true)).toBe("restricted");
});

it("opens the current preview trial from the inspector, ignores another document, and cleans up", () => {
  const previous = usePlayerStore.getState();
  usePlayerStore.setState({ isPlaying: false });
  const host = document.body.appendChild(document.createElement("div"));
  const frame = document.body.appendChild(document.createElement("iframe"));
  const element = makeSelection("dot", frame.contentDocument!.createElement("div"));
  const root = createRoot(host);
  const capture = vi.mocked(captureLayoutTrial);
  capture.mockClear();
  try {
    act(() =>
      root.render(
        <>
          <EditingScopeNotice element={element} disabled={[false, false, true]} />
          <LayoutTrialLauncher iframeRef={{ current: frame }} selections={[element]} />
        </>,
      ),
    );
    expect(host.querySelector("[data-editing-scope]")?.textContent).toContain(
      t("editingScope.restricted"),
    );
    act(() => requestLayoutTrial(document));
    expect(capture).not.toHaveBeenCalled();
    act(() => host.querySelector<HTMLButtonElement>("[data-editing-scope] button")!.click());
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0]?.[0]).toBe(frame);
    expect(capture.mock.calls[0]?.[1]).toEqual([element]);
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("trial captured");
    act(() => usePlayerStore.setState({ isPlaying: true }));
    expect(host.querySelector<HTMLButtonElement>("[data-editing-scope] button")?.disabled).toBe(
      true,
    );
  } finally {
    act(() => root.unmount());
    act(() => requestLayoutTrial(frame.contentDocument!));
    expect(capture).toHaveBeenCalledTimes(1);
    frame.remove();
    host.remove();
    usePlayerStore.setState(previous, true);
  }
});
