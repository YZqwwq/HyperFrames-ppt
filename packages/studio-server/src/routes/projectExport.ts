import { exportPresentation } from "../helpers/presentationExport.js";
import type { Hono } from "hono";
import type { StudioApiAdapter } from "../types.js";
import { exportEditableProject, ProjectExportError } from "../helpers/editableProjectExport.js";

export function registerProjectExportRoutes(api: Hono, adapter: StudioApiAdapter): void {
  const exporting = new Set<string>();
  api.get("/projects/:id/export/:format", async (c) => {
    const format = c.req.param("format");
    if (format !== "editable" && format !== "presentation")
      return c.json({ error: "未知导出格式。" }, 404);
    const presentation = format === "presentation";
    const project = await adapter.resolveProject(c.req.param("id"));
    if (!project) return c.json({ error: "项目不存在。" }, 404);
    if (exporting.has(project.dir)) return c.json({ error: "项目正在导出，请稍候。" }, 409);
    exporting.add(project.dir);
    try {
      const data = presentation
        ? await exportPresentation(project.dir, project.title ?? project.id)
        : await exportEditableProject(project.dir, project.title ?? project.id);
      const name = Array.from(project.title ?? project.id, (char) =>
        char.charCodeAt(0) < 32 ? "-" : char,
      )
        .join("")
        .replace(/[<>:"/\\|?*]/g, "-")
        .slice(0, 100);
      return new Response(typeof data === "string" ? data : new Uint8Array(data), {
        headers: {
          "Content-Type": presentation ? "text/html; charset=utf-8" : "application/zip",
          "Content-Disposition": presentation
            ? `attachment; filename="presentation.html"; filename*=UTF-8''${encodeURIComponent(name)}-presentation.html`
            : `attachment; filename="editable-presentation.zip"; filename*=UTF-8''${encodeURIComponent(name)}-editable.zip`,
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      if (error instanceof ProjectExportError) return c.json({ error: error.message }, 422);
      return c.json({ error: "导出失败，请确认项目文件可读取并重试。" }, 500);
    } finally {
      exporting.delete(project.dir);
    }
  });
}
