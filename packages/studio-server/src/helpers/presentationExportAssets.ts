import { readFileSync } from "node:fs";
import { dirname, posix, relative } from "node:path";
import { parseHTML } from "linkedom";
import { getMimeType } from "./mime.js";
import { resolveWithinProject } from "./safePath.js";
import { ProjectExportError } from "./editableProjectExport.js";

export interface PresentationAsset {
  token: string;
  mime: string;
  base64: string;
}

/** Resource blobs are embedded once, even when many scenes reference the same font. */
export function embedPresentationAssets(html: string, dir: string, onRead: (path: string) => void) {
  const { document } = parseHTML(html);
  const assets: PresentationAsset[] = [];
  const tokens = new Map<string, string>();
  function localPath(url: string, base = "") {
    if (/^(?:[a-z][\w+.-]*:|\/\/|\/)/i.test(url))
      throw new ProjectExportError(
        `离线放映暂不支持外链资源，请先保存到项目内：${url.slice(0, 180)}`,
      );
    const path = posix.normalize(posix.join(base, decodeURIComponent(url.split(/[?#]/)[0]!)));
    if (path.split("/").some((part) => part.startsWith(".") && part !== ".hyperframes"))
      throw new ProjectExportError(`无法打包资源：${path}`);
    const safe = resolveWithinProject(dir, path);
    if (!safe) throw new ProjectExportError(`资源不在项目内：${path}`);
    onRead(safe);
    return safe;
  }
  function resource(url: string, base = ""): string {
    if (!url || /^(data:|#)/i.test(url)) return url;
    const path = localPath(url, base);
    let token = tokens.get(path);
    if (!token) {
      const bytes = readFileSync(path);
      if (bytes.subarray(0, 80).toString().startsWith("version https://git-lfs.github.com/spec/"))
        throw new ProjectExportError(`资源尚未下载：${url}`);
      token = `hf-export-asset-${assets.length}-end`;
      tokens.set(path, token);
      assets.push({ token, mime: getMimeType(path), base64: bytes.toString("base64") });
    }
    const hash = url.indexOf("#");
    return token + (hash < 0 ? "" : url.slice(hash));
  }
  function css(source: string, base = "", stack: string[] = []): string {
    const imports = source.replace(
      /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?\s*([^;]*);/gi,
      (_all, url: string, condition: string) => {
        const path = localPath(url, base);
        if (stack.includes(path)) throw new ProjectExportError(`样式循环引用：${url}`);
        if (/\b(layer|supports)\b/.test(condition))
          throw new ProjectExportError("请将带 layer/supports 的外部样式合并后再导出。");
        const content = css(
          readFileSync(path, "utf8"),
          dirname(relative(dir, path)).split("\\").join("/"),
          [...stack, path],
        );
        return condition.trim() ? `@media ${condition}{${content}}` : content;
      },
    );
    return imports.replace(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi, (_all, a, b, c) => {
      const url = String(a ?? b ?? c).trim();
      if (url.startsWith("hf-export-asset-")) return `url("${url}")`;
      return `url("${resource(url, base)}")`;
    });
  }
  for (const link of document.querySelectorAll('link[rel="stylesheet"][href]')) {
    const path = localPath(link.getAttribute("href")!);
    const style = document.createElement("style");
    style.textContent = css(
      readFileSync(path, "utf8"),
      dirname(relative(dir, path)).split("\\").join("/"),
      [path],
    );
    if (link.hasAttribute("media")) style.setAttribute("media", link.getAttribute("media")!);
    link.replaceWith(style);
  }
  for (const script of document.querySelectorAll("script[src]")) {
    if (script.getAttribute("type") === "module")
      throw new ProjectExportError("暂不支持外部模块脚本，请先打包为本地普通脚本。");
    const path = localPath(script.getAttribute("src")!);
    script.textContent = readFileSync(path, "utf8").replace(/<\/script/gi, "<\\/script");
    script.removeAttribute("src");
    script.removeAttribute("integrity");
  }
  for (const style of document.querySelectorAll("style"))
    style.textContent = css(style.textContent ?? "");
  for (const element of document.querySelectorAll("[style]"))
    element.setAttribute("style", css(element.getAttribute("style")!));
  for (const element of document.querySelectorAll(
    "[src], [poster], image[href], use[href], [xlink\\:href]",
  )) {
    for (const attr of ["src", "poster", "href", "xlink:href"]) {
      const value = element.getAttribute(attr);
      if (value) element.setAttribute(attr, resource(value));
    }
  }
  // A local file must not silently retain URL-relative responsive candidates.
  for (const element of document.querySelectorAll("[srcset]")) {
    const value = element.getAttribute("srcset")!;
    if (value.includes("data:")) continue;
    element.setAttribute(
      "srcset",
      value
        .split(",")
        .map((part) => {
          const [url, ...descriptor] = part.trim().split(/\s+/);
          return [resource(url ?? ""), ...descriptor].join(" ");
        })
        .join(", "),
    );
  }
  if (document.querySelector("iframe, object, embed"))
    throw new ProjectExportError("项目包含嵌入网页，无法导出为离线放映文件。");
  document
    .querySelectorAll(
      "base, link[rel=preconnect], link[rel=dns-prefetch], link[rel=preload], link[rel=modulepreload]",
    )
    .forEach((node) => node.remove());
  return { html: document.toString(), assets };
}
