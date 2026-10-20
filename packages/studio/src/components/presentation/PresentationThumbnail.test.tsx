// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PresentationThumbnail } from "./PresentationThumbnail";
const { useStill } = vi.hoisted(() => ({ useStill: vi.fn(() => ({ status: "loading" })) }));
vi.mock("../../hooks/useThumbnailStill", () => ({ useThumbnailStill: useStill }));
vi.mock("../../player/store/playerStore", () => ({ usePlayerStore: () => 0 }));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
it("prefetches within the sidebar, prioritizes visible frames, and retains requests on scroll", () => {
  let notify = (_visible: boolean) => {};
  let options: IntersectionObserverInit | undefined;
  const disconnect = vi.fn();
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: (entries: { isIntersecting: boolean }[]) => void,
        init: IntersectionObserverInit,
      ) {
        options = init;
        notify = (visible) => callback([{ isIntersecting: visible }]);
      }
      observe() {}
      disconnect = disconnect;
    },
  );
  const host = document.body.appendChild(document.createElement("aside"));
  const root = createRoot(host);
  try {
    act(() =>
      root.render(
        <PresentationThumbnail projectId="demo" time={10} selected={false} label="Frame" />,
      ),
    );
    expect(options?.root).toBe(host);
    expect(options?.rootMargin).toBe("320px");
    expect(useStill).toHaveBeenLastCalledWith(null, "demo", { priority: "overscan" });
    expect(host.querySelector('[aria-busy="true"]')).toBeNull();
    act(() => notify(true));
    const url = "/api/projects/demo/thumbnail/index.html?t=10&output=preview&revision=0&retry=0";
    expect(useStill).toHaveBeenLastCalledWith(url, "demo", { priority: "interaction" });
    act(() => notify(false));
    expect(useStill).toHaveBeenLastCalledWith(url, "demo", { priority: "overscan" });
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
  }
  expect(disconnect).toHaveBeenCalledOnce();
});
