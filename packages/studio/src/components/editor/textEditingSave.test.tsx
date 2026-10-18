// @vitest-environment happy-dom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect, vi } from "vitest";
import { TextAreaField } from "./propertyPanelSections";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe("text editing saves", () => {
  it("keeps edits as drafts even after a pause and saves only once on blur", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const save = vi.fn();
    act(() => root.render(<TextAreaField label="Content" value="" flat onCommit={save} />));
    const input = host.querySelector("textarea")!;
    const change = (value: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(
          input,
          value,
        );
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    act(() => input.focus());
    change("a");
    act(() => vi.advanceTimersByTime(400));
    change("ab");
    act(() => vi.advanceTimersByTime(699));
    expect(save).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(save).not.toHaveBeenCalled();
    act(() => input.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })));
    change("abzhong");
    act(() => vi.advanceTimersByTime(1000));
    expect(save).not.toHaveBeenCalled();
    change("ab中");
    act(() => input.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })));
    act(() => vi.advanceTimersByTime(60000));
    expect(save).not.toHaveBeenCalled();
    change("ab中文");
    act(() => input.blur());
    expect(save).toHaveBeenLastCalledWith("ab中文");
    act(() => vi.advanceTimersByTime(1000));
    expect(save).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });
});
