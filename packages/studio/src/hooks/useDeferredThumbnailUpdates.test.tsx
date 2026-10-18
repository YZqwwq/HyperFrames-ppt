// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { useDeferredThumbnailUpdates } from "./useDeferredThumbnailUpdates";

Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

it("batches changes while a shadow inspector has focus and flushes after leaving", () => {
  vi.useFakeTimers();
  const host = document.createElement("div");
  document.body.append(host);
  const shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = '<div data-flat-panel-body="true"><input /></div><div id="root"></div>';
  const input = shadow.querySelector("input")!;
  const root = createRoot(shadow.querySelector("#root")!);
  const update = vi.fn();
  let queue!: (paths: readonly string[] | null) => void;
  function Fixture() {
    queue = useDeferredThumbnailUpdates("demo", update);
    return null;
  }
  act(() => root.render(<Fixture />));
  input.focus();
  queue(["slide-08.html"]);
  queue(["slide-08.html", "slide-09.html"]);
  act(() => vi.advanceTimersByTime(2400));
  expect(update).not.toHaveBeenCalled();
  input.blur();
  act(() => vi.advanceTimersByTime(800));
  expect(update).toHaveBeenCalledExactlyOnceWith(["slide-08.html", "slide-09.html"]);
  queue(null);
  queue(["slide-10.html"]);
  act(() => vi.advanceTimersByTime(800));
  expect(update).toHaveBeenLastCalledWith(null);
  queue(["slide-11.html"]);
  act(() => root.unmount());
  act(() => vi.advanceTimersByTime(800));
  expect(update).toHaveBeenCalledTimes(2);
});
