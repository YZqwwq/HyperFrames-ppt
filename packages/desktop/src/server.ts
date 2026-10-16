import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { execFile } from "node:child_process";
import { basename } from "node:path";
import { createStudioServer, resolveStudioBundle } from "@hyperframes/cli/studio-host";

// CLI workers spawn process.execPath; use Node mode instead of launching another desktop app.
process.env.ELECTRON_RUN_AS_NODE = "1";

const projectDir = process.argv[2];
const secret = process.env.FUTURE_PPT_SESSION_TOKEN;
const parent = process.parentPort;
if (!parent || !projectDir || !secret)
  throw new Error("Desktop server requires its application host.");
if (!resolveStudioBundle().available)
  throw new Error("Studio assets are missing. Rebuild the CLI.");
const studio = createStudioServer({ projectDir, projectName: basename(projectDir) });
const host = new Hono();
host.use("*", async (c, next) => {
  if (c.req.header("x-future-ppt-session") !== secret) return c.text("Forbidden", 403);
  await next();
});
host.route("/", studio.app);
const listener = serve({ fetch: host.fetch, hostname: "127.0.0.1", port: 0 }, (address) => {
  parent.postMessage({ type: "ready", url: `http://127.0.0.1:${address.port}` });
});
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  listener.close();
  studio.watcher.close();
  await studio.shutdown();
  parent.postMessage({ type: "stopped" });
  process.exit(0);
}
parent.on("message", (event) => {
  if (event.data?.type === "probe-node") {
    execFile(
      process.execPath,
      ["-e", "process.stdout.write('desktop-node-worker')"],
      { timeout: 10000, windowsHide: true },
      (error, stdout) => {
        parent.postMessage({
          type: "node-probe",
          ok: !error && stdout === "desktop-node-worker",
          error: error?.message ?? stdout,
        });
      },
    );
  }
  if (event.data?.type === "stop") void stop();
});
process.on("SIGTERM", () => void stop());
