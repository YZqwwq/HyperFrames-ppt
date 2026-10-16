import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, copyFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(join(tmpdir(), "future-ppt-desktop-smoke-"));
const project = join(temporary, "project");
if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep))
  throw new Error("Unexpected smoke cleanup path");
function packagedExecutable() {
  const candidates =
    process.platform === "win32"
      ? [join(root, "release/win-unpacked/Future PPT.exe")]
      : ["mac", "mac-arm64", "mac-universal"].map((dir) =>
          join(root, "release", dir, "Future PPT.app/Contents/MacOS/Future PPT"),
        );
  const found = candidates.find(existsSync);
  if (!found) throw new Error("Packaged desktop executable not found");
  return found;
}
const executable =
  process.argv[2] === "--packaged"
    ? packagedExecutable()
    : process.argv[2]
      ? resolve(process.argv[2])
      : require("electron");
try {
  await mkdir(project);
  await copyFile(
    join(
      dirname(require.resolve("@hyperframes/cli/package.json")),
      "dist/templates/blank/index.html",
    ),
    join(project, "index.html"),
  );
  await mkdir(join(root, "release"), { recursive: true });
  const args = [
    ...(process.argv[2] ? [] : [root]),
    `--smoke-project=${project}`,
    `--smoke-screenshot=${join(root, "release/home.png")}`,
  ];
  const { stdout, stderr } = await promisify(execFile)(executable, args, {
    cwd: tmpdir(),
    timeout: 90000,
    windowsHide: true,
  });
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  if (
    !stdout.includes("DESKTOP_WINDOW_REGRESSION_OK") ||
    !stdout.includes("DESKTOP_SMOKE_OK") ||
    !stdout.includes("DESKTOP_SHUTDOWN_OK")
  )
    throw new Error("Desktop did not complete its lifecycle checks");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
