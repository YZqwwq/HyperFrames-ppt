import type { DomEditSelection } from "./domEditing";

export interface TrialTarget {
  label: string;
  sourceFile: string;
  selector: string;
  id?: string;
}
export interface LayoutTrialSnapshot {
  html: string;
  width: number;
  height: number;
  scale: number;
  time: number;
  targets: TrialTarget[];
}

/** A disposable copy: never add attributes or styles to the authored preview. */
export function captureLayoutTrial(
  iframe: HTMLIFrameElement,
  selections: DomEditSelection[],
  time: number,
): LayoutTrialSnapshot {
  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win || !doc.body) throw new Error("预览尚未就绪，请稍后再试。");
  if (doc.querySelector("canvas, video, iframe"))
    throw new Error("当前画面含视频、Canvas 或嵌套网页，暂不支持静态布局试摆。");
  const unique: Element[] = [...new Set(selections.map((selection) => selection.element))];
  if (
    !unique.length ||
    unique.some((element) => element.ownerDocument !== doc || !element.isConnected)
  )
    throw new Error("所选对象已变化，请重新选择后试摆。");
  // Moving both an ancestor and its child would apply the same offset twice.
  const roots = unique.filter(
    (element) => !unique.some((parent) => parent !== element && parent.contains(element)),
  );
  for (const root of roots) {
    for (let parent: Element | null = root; parent; parent = parent.parentElement) {
      const style = win.getComputedStyle(parent);
      if (
        style.transform.startsWith("matrix3d") ||
        (style.perspective && style.perspective !== "none")
      )
        throw new Error("三维变换暂不支持布局试摆，请选择二维对象。");
    }
  }
  const clone = document.importNode(doc.documentElement, true);
  const originals = [doc.documentElement, ...doc.documentElement.querySelectorAll("*")];
  const copies = [clone, ...clone.querySelectorAll("*")];
  originals.forEach((element, index) => {
    const copy = copies[index];
    const style = win.getComputedStyle(element);
    const declarations = Array.from(
      style,
      (name) => `${name}:${style.getPropertyValue(name)};`,
    ).join("");
    copy.setAttribute(
      "style",
      declarations + "animation:none!important;transition:none!important;",
    );
    copy.removeAttribute("data-layout-trial-target");
    const targetIndex = roots.indexOf(element);
    if (targetIndex >= 0) copy.setAttribute("data-layout-trial-target", String(targetIndex));
    for (const attribute of Array.from(copy.attributes)) {
      if (attribute.name.startsWith("on")) copy.removeAttribute(attribute.name);
    }
  });
  clone.querySelectorAll("script, base, meta[http-equiv]").forEach((element) => element.remove());
  const base = doc.createElement("base");
  base.href = doc.baseURI;
  clone.querySelector("head")?.prepend(base);
  const freeze = doc.createElement("style");
  freeze.textContent =
    "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }";
  clone.querySelector("head")?.append(freeze);
  const root = doc.querySelector("[data-composition-id]");
  const designWidth = Number(root?.getAttribute("data-width"));
  const scale = designWidth > 0 && root ? root.getBoundingClientRect().width / designWidth : 1;
  if (!(scale > 0)) throw new Error("当前画面不可见，无法开始试摆。");
  return {
    html: "<!doctype html>" + clone.outerHTML,
    width: iframe.clientWidth,
    height: iframe.clientHeight,
    scale,
    time,
    targets: roots.map((element) => {
      const selection = selections.find((entry) => entry.element === element)!;
      return {
        label: selection.label,
        sourceFile: selection.sourceFile,
        selector: selection.selector ?? "",
        id: selection.id ?? undefined,
      };
    }),
  };
}

export interface TrialMotion {
  element: HTMLElement | SVGElement;
  transform: string;
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Measure parent axes in the isolated document, including rotated/scaled groups. */
export function measureTrialMotion(doc: Document): TrialMotion[] {
  return Array.from(
    doc.querySelectorAll<HTMLElement | SVGElement>("[data-layout-trial-target]"),
  ).map((element) => {
    const transform = element.style.transform === "none" ? "" : element.style.transform;
    const measure = (x: number, y: number) => {
      element.style.transform = `translate(${x}px, ${y}px) ${transform}`;
      return element.getBoundingClientRect();
    };
    const origin = measure(0, 0);
    const x = measure(100, 0);
    const y = measure(0, 100);
    measure(0, 0);
    const result = {
      element,
      transform,
      a: (x.left - origin.left) / 100,
      b: (x.top - origin.top) / 100,
      c: (y.left - origin.left) / 100,
      d: (y.top - origin.top) / 100,
    };
    if (Math.abs(result.a * result.d - result.b * result.c) < 0.00001)
      throw new Error("所选对象的变换无法用于试摆，请换一个可见对象。");
    return result;
  });
}

export function trialLocalOffset(
  motion: Pick<TrialMotion, "a" | "b" | "c" | "d">,
  x: number,
  y: number,
) {
  const determinant = motion.a * motion.d - motion.b * motion.c;
  return {
    x: (motion.d * x - motion.c * y) / determinant,
    y: (motion.a * y - motion.b * x) / determinant,
  };
}

export function moveTrial(motions: TrialMotion[], x: number, y: number) {
  for (const motion of motions) {
    const local = trialLocalOffset(motion, x, y);
    motion.element.style.transform = `translate(${local.x}px, ${local.y}px) ${motion.transform}`;
  }
}

export function describeLayoutTrial(snapshot: LayoutTrialSnapshot, x: number, y: number): string {
  return `布局试摆（尚未应用到作品）\n时间：${snapshot.time.toFixed(3)} 秒\n整体位移：X ${x}px，Y ${y}px（作品坐标，右/下为正）\n请将以下对象整体移动，保留内部布局、动画时序、缓动及无关内容；不要只改当前帧。\n${JSON.stringify(snapshot.targets, null, 2)}`;
}
