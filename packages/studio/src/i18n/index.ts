import en from "./en.json";
import zhCN from "./zh-CN.json";

export type TextKey = keyof typeof en;
export type Locale = "zh-CN" | "en";
const messages: Record<Locale, Record<TextKey, string>> = { en, "zh-CN": zhCN };

/** UI copy only: never pass project content, CSS values, or protocol identifiers here. */
export function t(
  key: TextKey,
  parameters: Readonly<Record<string, string | number>> = {},
  locale: Locale = "zh-CN",
): string {
  const message = messages[locale][key] || en[key];
  return message.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(parameters, name) ? String(parameters[name]) : placeholder,
  );
}
