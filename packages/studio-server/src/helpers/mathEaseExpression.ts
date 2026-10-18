/** A narrow exception for pure scalar easing functions, never general raw code. */
export function isMathEaseExpression(value: string): boolean {
  const match = /^__raw:\(t\)\s*=>\s*\(([\s\S]+)\)$/.exec(value);
  if (!match?.[1] || value.length > 1100) return false;
  const expression = match[1]
    .replace(/Math\.(?:pow|sin|cos|abs|min|max|sqrt|exp|log|floor|ceil|round|PI)\b/g, "0")
    .replace(/\d(?:\.\d*)?[eE][+-]?\d+/g, "0");
  return /^[\dt\s.+*/%()?:,<>-]+$/.test(expression) && !/(?:\+\+|--|\/\/|\/\*)/.test(expression);
}
