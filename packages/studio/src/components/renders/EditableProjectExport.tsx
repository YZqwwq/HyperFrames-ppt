import { useRef, useState, type ReactNode } from "react";
import { Select } from "../ui/Select";
import { Button } from "../ui/Button";
import { studioApiFetch } from "../../utils/studioApiFetch";
import { buildProjectApiPath } from "../../utils/projectRouting";
import { readServerError } from "./serverError";
import { flushStudioPendingEdits } from "../../utils/studioPendingEdits";

export function EditableProjectExport({
  projectId,
  beforeExport,
  children,
}: {
  projectId: string;
  beforeExport?: () => Promise<void>;
  children: ReactNode;
}) {
  const [type, setType] = useState("video");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const presentation = type === "presentation";
  async function download() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    setMessage("正在保存并打包项目…");
    try {
      await beforeExport?.();
      const drain = await flushStudioPendingEdits();
      if (drain.status !== "clean") throw new Error("当前编辑未保存成功，请处理保存错误后再导出。");
      const response = await studioApiFetch(
        buildProjectApiPath(projectId, presentation ? "/export/presentation" : "/export/editable"),
      );
      if (!response.ok) throw new Error(await readServerError(response));
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `${projectId.replace(/[<>:"/\\|?*]/g, "-")}-${presentation ? "presentation.html" : "editable.zip"}`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setMessage(
        presentation
          ? "放映文件已下载。双击 HTML，在浏览器中点击“开始放映”，无需安装编辑器。"
          : "项目已打包，已发起下载。解压后打开 project 文件夹继续编辑。",
      );
    } catch (failure) {
      setMessage("");
      setError(failure instanceof Error ? failure.message : "导出失败，请重试。");
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <label className="text-step-10 text-text-4">导出类型</label>
      <Select
        label="导出类型"
        value={type}
        disabled={busy}
        options={[
          { value: "video", label: "视频" },
          { value: "editable", label: "可编辑演示项目（ZIP）" },
          { value: "presentation", label: "PPT 浏览器放映（HTML）" },
        ]}
        onCommit={setType}
      />
      {type === "video" ? (
        children
      ) : (
        <>
          <p className="text-step-10 text-text-4">
            {presentation
              ? "单个 HTML 文件，包含本地素材、字体、动画和演示停留点，可离线打开。"
              : "保留页面、文字、动画、素材、字体和演示打点，并附开发规范与 AI 接手说明。"}
          </p>
          <p className="text-step-10 text-text-4">
            {presentation
              ? "接收方无需安装编辑器。打开后点击“开始放映”进入全屏，单击或方向键翻页。外链资源需先保存到项目内。"
              : "应用原生项目格式，解压后可继续编辑；不需要 FFmpeg。外链资源仍需联网。"}
          </p>
          <Button variant="primary" size="md" loading={busy} onClick={() => void download()}>
            {busy ? "正在打包…" : presentation ? "导出 PPT 放映文件" : "导出可编辑项目"}
          </Button>
          {message && (
            <p role="status" className="text-step-10 text-text-4">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-step-10 text-danger-ink">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
