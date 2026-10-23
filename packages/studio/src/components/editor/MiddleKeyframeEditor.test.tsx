// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { IntermediateKeyframe } from "./MiddleKeyframeEditor";
import { makeSelection } from "../../hooks/domSelectionTestHarness";
import { usePlayerStore } from "../../player/store/playerStore";
import { t } from "../../i18n";
import type { CommitMutationOptions } from "../../hooks/gsapScriptCommitTypes";

const mocks = vi.hoisted(() => ({ commit: vi.fn() }));
vi.mock("../../contexts/DomEditContext", () => ({
  useDomEditActionsContextOptional: () => ({
    previewIframeRef: { current: null },
    commitMutation: mocks.commit,
  }),
}));
vi.mock("./planIntermediateKeyframe", async (original) => ({
  ...(await original<typeof import("./planIntermediateKeyframe")>()),
  planIntermediateKeyframe: () => ({ mutation: { type: "replace-with-keyframes" } }),
}));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

it("requires a located sample, prevents duplicate clicks, and reports an unconfirmed save", async () => {
  const previous = usePlayerStore.getState();
  const host = document.createElement("div");
  const root = createRoot(host);
  let finish: (() => void) | undefined;
  mocks.commit.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  try {
    usePlayerStore.setState({ timelineReady: true, isPlaying: false, currentTime: 0 });
    act(() =>
      root.render(
        <IntermediateKeyframe
          element={makeSelection("dot", document.createElement("div"))}
          animation={{
            id: "move",
            targetSelector: "#dot",
            method: "to",
            duration: 4,
            position: 2,
            properties: { x: 100 },
          }}
          percentage={50}
          onEdit={vi.fn()}
        />,
      ),
    );
    expect(host.querySelector("button")?.disabled).toBe(true);
    act(() => usePlayerStore.setState({ currentTime: 4 }));
    act(() => {
      host.querySelector("button")?.click();
      host.querySelector("button")?.click();
    });
    expect(mocks.commit).toHaveBeenCalledTimes(1);
    expect(host.querySelector("button")?.disabled).toBe(true);
    await act(async () => {
      finish?.();
    });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t("animation.insertNotSaved"));
    mocks.commit.mockImplementation(async (_mutation: unknown, options: CommitMutationOptions) =>
      options.onResult?.({ ok: true, changed: true, before: "before", after: "after" }),
    );
    await act(async () => host.querySelector("button")?.click());
    expect(host.querySelector('[role="alert"]')).toBeNull();
  } finally {
    act(() => root.unmount());
    usePlayerStore.setState(previous, true);
  }
});

it("lists source keyframes and opens an existing stop without creating a mutation", () => {
  const previous = usePlayerStore.getState();
  usePlayerStore.setState({ timelineReady: true, isPlaying: false, currentTime: 4 });
  const host = document.createElement("div");
  const root = createRoot(host);
  const edit = vi.fn();
  mocks.commit.mockClear();
  try {
    act(() =>
      root.render(
        <IntermediateKeyframe
          element={makeSelection("dot", document.createElement("div"))}
          animation={{
            id: "move",
            targetSelector: "#dot",
            method: "to",
            duration: 4,
            position: 2,
            properties: {},
            keyframes: {
              format: "percentage",
              keyframes: [{ percentage: 50, properties: { x: 50 } }],
            },
          }}
          percentage={50}
          onEdit={edit}
        />,
      ),
    );
    expect(host.textContent).toContain(t("animation.authoredKeyframe", { percentage: 50 }));
    expect(host.textContent).not.toContain(t("animation.insertMiddle"));
    act(() => host.querySelector("button")?.click());
    expect(edit).toHaveBeenCalledWith(50);
    expect(mocks.commit).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    usePlayerStore.setState(previous, true);
  }
});
