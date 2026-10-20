// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { EditableProjectExport } from "./EditableProjectExport";
import { studioApiFetch } from "../../utils/studioApiFetch";
import { flushStudioPendingEdits } from "../../utils/studioPendingEdits";
vi.mock("../../utils/studioApiFetch", () => ({ studioApiFetch: vi.fn() }));
vi.mock("../../utils/studioPendingEdits", () => ({
  flushStudioPendingEdits: vi.fn(async () => ({ status: "clean" })),
}));
vi.mock("../ui/Select", () => ({
  Select: ({ onCommit }: { onCommit: (value: string) => void }) => (
    <>
      <button onClick={() => onCommit("editable")}>可编辑演示项目（ZIP）</button>
      <button data-format="presentation" onClick={() => onCommit("presentation")}>
        PPT 浏览器放映（HTML）
      </button>
    </>
  ),
}));
Reflect.set(globalThis, "IS_REACT_ACT_ENVIRONMENT", true);
let root: Root;
let host: HTMLDivElement;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});
function mount(beforeExport?: () => Promise<void>) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() =>
    root.render(
      <EditableProjectExport projectId="中文项目" beforeExport={beforeExport}>
        <div>FFmpeg not found</div>
      </EditableProjectExport>,
    ),
  );
  act(() => host.querySelector("button")!.click());
}
it("offers project export without encoder controls and waits for saving before download", async () => {
  let finish = () => {};
  const save = new Promise<void>((resolve) => {
    finish = resolve;
  });
  vi.mocked(studioApiFetch).mockResolvedValue(new Response(new Uint8Array([80, 75])));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:archive");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  mount(() => save);
  expect(host.textContent).not.toContain("FFmpeg not found");
  const button = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === "导出可编辑项目",
  )!;
  await act(async () => {
    button.click();
  });
  expect(studioApiFetch).not.toHaveBeenCalled();
  await act(async () => {
    finish();
    await save;
  });
  expect(flushStudioPendingEdits).toHaveBeenCalled();
  expect(studioApiFetch).toHaveBeenCalledWith(
    "/api/projects/%E4%B8%AD%E6%96%87%E9%A1%B9%E7%9B%AE/export/editable",
  );
  expect(click).toHaveBeenCalledOnce();
});
it("does not export after a failed save and allows retry", async () => {
  mount(async () => {
    throw new Error("保存冲突");
  });
  const button = Array.from(host.querySelectorAll("button")).find(
    (b) => b.textContent === "导出可编辑项目",
  )!;
  await act(async () => {
    button.click();
  });
  expect(studioApiFetch).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("保存冲突");
  expect(button.disabled).toBe(false);
});

it("downloads the standalone HTML format without video controls", async () => {
  vi.mocked(studioApiFetch).mockResolvedValue(new Response("<!doctype html>"));
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:presentation");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  let filename = "";
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function (this: HTMLAnchorElement) {
      filename = this.download;
    },
  );
  mount();
  act(() => host.querySelector<HTMLButtonElement>('[data-format="presentation"]')!.click());
  const button = [...host.querySelectorAll("button")].find(
    (b) => b.textContent === "导出 PPT 放映文件",
  )!;
  await act(async () => button.click());
  expect(studioApiFetch).toHaveBeenCalledWith(
    "/api/projects/%E4%B8%AD%E6%96%87%E9%A1%B9%E7%9B%AE/export/presentation",
  );
  expect(filename).toBe("中文项目-presentation.html");
  expect(host.textContent).not.toContain("FFmpeg not found");
});
