import { describe, expect, it } from "vitest";
import { compileMotionExpression } from "./motionSpeed";
import { parseGsapScriptAcornForWrite } from "../../../../parsers/src/gsapParserAcorn";
import { updateAnimationInScript } from "../../../../parsers/src/gsapWriterAcorn";

describe("motion expressions", () => {
  it("persists a real function and reads it back without turning it into an ease name", () => {
    const script =
      'const tl = gsap.timeline(); tl.to("#dot", {x: 100, duration: 2, ease: "none"}, 1);';
    const parsed = parseGsapScriptAcornForWrite(script)!;
    const ease = compileMotionExpression("t => t * t * (3 - 2 * t)");
    const updated = updateAnimationInScript(script, parsed.located[0]!.id, { ease });
    expect(updated).toContain("ease: (t) =>");
    expect(parseGsapScriptAcornForWrite(updated)!.located[0]!.animation.ease).toContain("__raw:");
  });
  it("allows conditional easing and mathematical functions", () => {
    expect(compileMotionExpression("t < 0.5 ? 2*t*t : 1-Math.pow(-2*t+2, 2)/2")).toContain(
      "__raw:",
    );
    expect(compileMotionExpression("(1-Math.cos(Math.PI*t))/2")).toContain("__raw:");
  });
  it.each([
    "fetch('/secret')",
    "t.constructor('return window')()",
    "t = 1",
    "t++",
    "1/t",
    "t*2",
    "Math.random()",
    "t; alert(1)",
  ])("rejects invalid or unsafe expression %s", (expression) => {
    expect(() => compileMotionExpression(expression)).toThrow();
  });
});
