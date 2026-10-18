export const MOTION_SPEEDS = [
  { key: "motion.linear", ease: "none" },
  { key: "motion.both", ease: "power2.inOut" },
  { key: "motion.in", ease: "power2.in" },
  { key: "motion.out", ease: "power2.out" },
] as const;

export interface NamedMotionSpeed {
  name: string;
  ease: string;
}
const storageKey = "hf-named-motion-speeds-v1";
export function readMotionSpeeds(): NamedMotionSpeed[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter(
          (v): v is NamedMotionSpeed => typeof v?.name === "string" && typeof v?.ease === "string",
        )
      : [];
  } catch {
    return [];
  }
}
export function saveMotionSpeeds(values: NamedMotionSpeed[]) {
  localStorage.setItem(storageKey, JSON.stringify(values));
}

/** Accept only a scalar math expression, never arbitrary JavaScript statements. */
export function compileMotionExpression(source: string): string {
  const expression = source.trim().replace(/^\(?t\)?\s*=>\s*/, "");
  const tokens = expression.replace(
    /Math\.(?:pow|sin|cos|abs|min|max|sqrt|exp|log|floor|ceil|round|PI)\b/g,
    "0",
  );
  if (
    !expression ||
    expression.length > 1000 ||
    !/^[\dt\s.eE+*/%()?:,<>=!-]+$/.test(tokens) ||
    /[=!]/.test(tokens) ||
    /(?:\+\+|--|\/\/|\/\*)/.test(tokens) ||
    /[a-su-zA-DF-Z]/.test(tokens.replace(/\d(?:\.\d*)?[eE][+-]?\d+/g, "0"))
  ) {
    throw new Error("invalid expression");
  }
  // The allowlist above excludes property access (except approved Math members),
  // strings, statements, assignment, and any ambient identifiers.
  const evaluate = new Function("t", `"use strict"; return (${expression});`);
  for (let i = 0; i <= 100; i++) {
    const value: unknown = evaluate(i / 100);
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("nonfinite");
    if ((i === 0 && Math.abs(value) > 0.001) || (i === 100 && Math.abs(value - 1) > 0.001)) {
      throw new Error("endpoints");
    }
  }
  return `__raw:(t) => (${expression})`;
}
