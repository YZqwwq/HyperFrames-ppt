import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src");
const readCatalog = (name) =>
  JSON.parse(fs.readFileSync(path.join(root, "i18n", name), "utf8").replace(/^\uFEFF/, ""));
const en = readCatalog("en.json");
const zh = readCatalog("zh-CN.json");
const locations = [];
const errors = [];
function walk(dir) {
  for (const entry of fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "i18n") walk(file);
      continue;
    }
    if (!/\.tsx?$/.test(file) || /\.test\./.test(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    // Limit the scan to our translation function, not unrelated local helpers named t.
    const imported = ast.statements.some(
      (node) =>
        ts.isImportDeclaration(node) &&
        ts.isStringLiteral(node.moduleSpecifier) &&
        /\/i18n$/.test(node.moduleSpecifier.text),
    );
    if (!imported) continue;
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "t"
      ) {
        const arg = node.arguments[0];
        if (!arg || !ts.isStringLiteral(arg))
          errors.push(`${file}: translation keys must be literal strings`);
        else {
          const key = arg.text;
          const pos = ast.getLineAndCharacterOfPosition(node.getStart(ast));
          const location = {
            file: "src/" + path.relative(root, file).replaceAll("\\", "/"),
            line: pos.line + 1,
            column: pos.character + 1,
            key,
          };
          locations.push(location);
          if (!Object.hasOwn(en, key))
            errors.push(`${location.file}:${location.line}: unknown key ${key}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
}
walk(root);
const placeholders = (text) =>
  [...text.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(",");
for (const key of new Set([...Object.keys(en), ...Object.keys(zh)])) {
  if (!en[key]?.trim() || !zh[key]?.trim()) errors.push(`Missing translation: ${key}`);
  else if (placeholders(en[key]) !== placeholders(zh[key]))
    errors.push(`Placeholder mismatch: ${key}`);
  if (!locations.some((location) => location.key === key))
    errors.push(`Unregistered text key: ${key}`);
}
if (errors.length) throw new Error(errors.join("\n"));
const output =
  JSON.stringify(
    {
      defaultLocale: "zh-CN",
      generatedBy: "bun run --cwd packages/studio i18n:register",
      locations,
    },
    null,
    2,
  ) + "\n";
const dest = path.join(root, "i18n/text-registry.json");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(dest) || fs.readFileSync(dest, "utf8") !== output)
    throw new Error("Text registry is stale; run i18n:register");
} else fs.writeFileSync(dest, output);
console.log(`UI texts: ${Object.keys(en).length} keys, ${locations.length} registered locations`);
