// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { MotionTimingEditor } from "./MotionTimingEditor";
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

it("shows authored speed and replaces all segment overrides only on explicit selection", () => {
  const host = document.body.appendChild(document.createElement("div"));
  const root = createRoot(host);
  const update = vi.fn();
  const all = vi.fn();
  try {
    act(() =>
      root.render(
        <MotionTimingEditor
          offset={56}
          onUpdateMeta={update}
          onSetAllKeyframeEases={all}
          animation={{
            id: "move",
            method: "to",
            targetSelector: "#dot",
            duration: 2,
            position: 3,
            ease: "back.out(1.7)",
            properties: { x: 10 },
            keyframes: {
              format: "percentage",
              keyframes: [
                { percentage: 0, properties: { x: 0 } },
                { percentage: 100, properties: { x: 10 }, ease: "none" },
              ],
            },
          }}
        />,
      ),
    );
    expect(host.textContent).toContain("59.00 – 61.00 s");
    expect(host.textContent).toContain("各段独立速度");
    expect(host.textContent).toContain("back.out(1.7)");
    expect(update).not.toHaveBeenCalled();
    const select = host.querySelector("select")!;
    act(() => {
      select.value = "power2.inOut";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(all).toHaveBeenCalledWith("move", "power2.inOut");
    expect(update).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
