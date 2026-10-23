// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { ElementEditingControls } from "./ElementEditingControls";
import { makeSelection } from "../../hooks/domSelectionTestHarness";

vi.mock("./AnimationEndpoints", () => ({ AnimationEndpoints: () => <div data-motion-controls /> }));
vi.mock("./EditingScopeNotice", () => ({ EditingScopeNotice: () => <div data-scope /> }));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);

it("only exposes motion controls for an editable timed animation", () => {
  const host = document.createElement("div");
  const root = createRoot(host);
  const element = makeSelection("dot", document.createElement("div"));
  const animation = {
    id: "move",
    method: "to" as const,
    targetSelector: "#dot",
    position: 0,
    duration: 2,
    properties: { x: 100 },
  };
  const render = (animations: (typeof animation)[]) =>
    act(() =>
      root.render(
        <ElementEditingControls
          element={element}
          disabled={[false, false, false]}
          animations={animations}
        />,
      ),
    );
  try {
    render([]);
    expect(host.querySelector("[data-scope]")).not.toBeNull();
    expect(host.querySelector("details")).toBeNull();
    render([{ ...animation, duration: 0 }]);
    expect(host.querySelector("details")).toBeNull();
    render([animation]);
    expect(host.querySelector("details [data-motion-controls]")).not.toBeNull();
    element.capabilities.canEditStyles = false;
    render([animation]);
    expect(host.querySelector("details")).toBeNull();
  } finally {
    act(() => root.unmount());
  }
});
