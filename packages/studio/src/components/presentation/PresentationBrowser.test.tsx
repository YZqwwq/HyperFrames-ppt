// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PresentationBrowser } from "./PresentationBrowser";
const { seek, pause } = vi.hoisted(() => ({ seek: vi.fn(() => true), pause: vi.fn() }));
vi.mock("../nle/NLEContext", () => ({ useNLEContext: () => ({ seek, pause, projectId: "demo" }) }));
vi.mock("./PresentationThumbnail", () => ({
  PresentationThumbnail: ({ time }: { time: number }) => (
    <img src={`thumbnail/index.html?t=${time}`} />
  ),
}));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
it("selects master states and presents from the selected endpoint", () => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const present = vi.fn();
  const close = vi.fn();
  const ranges = [
    {
      cue: {
        id: "a",
        label: "Example",
        start: { clipId: null, offset: 10 },
        end: { clipId: null, offset: 12 },
      },
      start: 10,
      end: 12,
    },
  ];
  try {
    act(() =>
      root.render(<PresentationBrowser ranges={ranges} onClose={close} onPresent={present} />),
    );
    expect(seek).toHaveBeenLastCalledWith(10);
    const states = host.querySelectorAll<HTMLButtonElement>("button[aria-pressed]");
    act(() => states[1].click());
    expect(seek).toHaveBeenLastCalledWith(12);
    expect(states[1].getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelectorAll("img")[1].src).toContain("thumbnail/index.html?t=12");
    act(() => host.querySelectorAll<HTMLButtonElement>("header button")[1].click());
    expect(present).toHaveBeenLastCalledWith(0, true);
    act(() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(close).toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("waits for a pending player and enables presenting once it becomes ready", () => {
  vi.useFakeTimers();
  seek.mockReturnValue(false);
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const ranges = [
    {
      cue: {
        id: "a",
        label: "Test",
        start: { clipId: null, offset: 1 },
        end: { clipId: null, offset: 2 },
      },
      start: 1,
      end: 2,
    },
  ];
  try {
    act(() =>
      root.render(<PresentationBrowser ranges={ranges} onClose={() => {}} onPresent={() => {}} />),
    );
    const play = host.querySelectorAll<HTMLButtonElement>("header button")[1];
    expect(play.disabled).toBe(true);
    seek.mockReturnValue(true);
    act(() => vi.advanceTimersByTime(150));
    expect(play.disabled).toBe(false);
    expect(seek).toHaveBeenLastCalledWith(1);
  } finally {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  }
});
