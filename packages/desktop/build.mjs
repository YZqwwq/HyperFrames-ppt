import { build } from "esbuild";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
const at = (path) => fileURLToPath(new URL(path, import.meta.url));
if (!existsSync(at("../cli/dist/studioHost.js"))) {
  throw new Error("Build the CLI first: bun run --cwd packages/cli build");
}
await build({
  entryPoints: [at("src/main.ts"), at("src/server.ts")],
  outdir: at("dist"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "external",
});
await build({
  entryPoints: [at("src/preload.ts")],
  outfile: at("dist/preload.cjs"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  external: ["electron"],
});
