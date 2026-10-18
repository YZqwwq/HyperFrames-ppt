import { describe, expect, it } from "vitest";
import en from "./en.json";
import zh from "./zh-CN.json";
import { t, type TextKey } from "./index";

describe("UI language catalog", () => {
  it("defaults to Chinese and retains an English catalog", () => {
    expect(t("panel.timeline")).toBe("时间轴");
    expect(t("panel.timeline", {}, "en")).toBe("Timeline");
  });
  it("interpolates counts and shortcuts without interpreting user text as HTML", () => {
    expect(t("selection.count", { count: 3 })).toBe("已选择 3 个元素");
    expect(t("timeline.splitHint", { shortcut: "⌘B" })).toBe("在播放头处分割（⌘B）");
    expect(t("property.pickColor", { label: "<b>" })).toBe("选择<b>");
  });
  it("keeps keys, placeholders and nonempty translations aligned", () => {
    expect(Object.keys(zh).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en) as TextKey[]) {
      expect(zh[key].trim(), key).not.toBe("");
      expect(zh[key].match(/\{\w+\}/g) ?? [], key).toEqual(en[key].match(/\{\w+\}/g) ?? []);
    }
  });
});
