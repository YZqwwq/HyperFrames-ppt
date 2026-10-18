import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  utilityProcess,
  WebContentsView,
} from "electron";
import type { IpcMainInvokeEvent, UtilityProcess, WebContents } from "electron";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createProject, readRecents, rememberProject, validateProject } from "./projects.js";

const smokeProject = process.argv.find((arg) => arg.startsWith("--smoke-project="))?.slice(16);
app.setName("Future PPT");
app.setPath(
  "userData",
  smokeProject
    ? join(dirname(smokeProject), "profile")
    : join(app.getPath("appData"), "Future PPT"),
);
const here = dirname(fileURLToPath(import.meta.url));
const homeUrl = pathToFileURL(join(here, "../ui/index.html")).href;
const require = createRequire(import.meta.url);
let home: BrowserWindow | null = null;
let opening = false;
let quitting = false;
let activeEditor: WebContentsView | undefined;
let editorVisible = false;
let activePath: string | undefined;
const services = new Map<WebContentsView, { child: UtilityProcess; stop: () => Promise<void> }>();
const recentsFile = () => join(app.getPath("userData"), "recent-projects.json");

function assertLauncher(event: IpcMainInvokeEvent) {
  if (
    !home ||
    event.sender !== home.webContents ||
    event.senderFrame !== home.webContents.mainFrame ||
    event.senderFrame.url !== homeUrl
  ) {
    throw new Error("This action is only available from the project launcher.");
  }
}
function lockWindow(contents: WebContents, allowed: (url: string) => boolean) {
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (event, url) => {
    if (!allowed(url)) event.preventDefault();
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
  contents.session.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false),
  );
  contents.session.setPermissionCheckHandler(() => false);
}
function focusCurrent() {
  if (!home || home.isDestroyed()) {
    createHome();
    return;
  }
  if (home.isMinimized()) home.restore();
  if (!smokeProject) {
    home.show();
    home.focus();
  }
  (editorVisible ? activeEditor?.webContents : home.webContents)?.focus();
}
function resizeEditor() {
  if (!home || !activeEditor) return;
  const { width, height } = home.getContentBounds();
  activeEditor.setBounds({ x: 0, y: 0, width, height });
}
function showEditor(editor: WebContentsView) {
  if (!home) throw new Error("Application window closed");
  activeEditor = editor;
  home.contentView.addChildView(editor);
  editorVisible = true;
  home.setMinimumSize(1000, 700);
  resizeEditor();
  focusCurrent();
}
function createHome() {
  if (home && !home.isDestroyed()) {
    if (activeEditor && editorVisible) home.contentView.removeChildView(activeEditor);
    editorVisible = false;
    focusCurrent();
    return;
  }
  home = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 720,
    minHeight: 560,
    title: "Future PPT",
    backgroundColor: "#f5f3ef",
    show: false,
    webPreferences: {
      preload: join(here, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  lockWindow(home.webContents, (url) => url === homeUrl);
  home.once("ready-to-show", () => {
    if (!smokeProject) home?.show();
  });
  home.on("resize", resizeEditor);
  home.on("closed", () => {
    activeEditor?.webContents.close();
    activeEditor = undefined;
    activePath = undefined;
    editorVisible = false;
    home = null;
  });
  void home.loadURL(homeUrl);
}
async function openProject(directory: string) {
  const path = await validateProject(directory);
  if (activePath === path && activeEditor && !activeEditor.webContents.isDestroyed()) {
    showEditor(activeEditor);
    return;
  }
  const token = randomUUID();
  const partition = `project-${randomUUID()}`;
  const projectSession = session.fromPartition(partition);
  const child = utilityProcess.fork(join(here, "server.js"), [path], {
    env: { ...process.env, FUTURE_PPT_SESSION_TOKEN: token },
    stdio: "pipe",
    serviceName: "Future PPT project service",
  });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-6000);
  });
  child.stdout?.on("data", (chunk) => console.log(chunk.toString().trimEnd()));
  let stopping: Promise<void> | undefined;
  const stop = () =>
    (stopping ??= new Promise<void>((resolve) => {
      if (!child.pid) {
        resolve();
        return;
      }
      const timeout = setTimeout(() => {
        child.kill();
      }, 5000);
      child.once("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
      child.postMessage({ type: "stop" });
    }));
  let win: WebContentsView | undefined;
  try {
    const origin = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("项目服务启动超时。")), 30000);
      child.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`项目服务退出 (${code})。\n${stderr}`));
      });
      child.on("message", (message) => {
        if (message?.type !== "ready" || typeof message.url !== "string") return;
        const url = new URL(message.url);
        if (url.hostname !== "127.0.0.1" || url.protocol !== "http:") return;
        clearTimeout(timer);
        resolve(url.origin);
      });
    });
    projectSession.webRequest.onBeforeSendHeaders(
      { urls: [`${origin}/*`] },
      (details, callback) => {
        callback({ requestHeaders: { ...details.requestHeaders, "x-future-ppt-session": token } });
      },
    );
    win = new WebContentsView({
      webPreferences: { partition, contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    const editor = win;
    services.set(editor, { child, stop });
    lockWindow(editor.webContents, (url) => {
      try {
        return new URL(url).origin === origin;
      } catch {
        return false;
      }
    });
    editor.webContents.on("destroyed", () => {
      if (activeEditor === editor) {
        activeEditor = undefined;
        activePath = undefined;
        editorVisible = false;
      }
      void stop().finally(() => services.delete(editor));
    });
    child.on("exit", (code) => {
      if (!stopping && !quitting && !editor.webContents.isDestroyed() && home !== null) {
        void dialog.showMessageBox(home, {
          type: "error",
          message: "项目服务已停止",
          detail: `请关闭此窗口后重新打开项目。退出码：${code}\n${stderr}`,
        });
      }
    });
    await editor.webContents.loadURL(origin);
    if (!smokeProject) await rememberProject(recentsFile(), path);
    if (!home || home.isDestroyed()) throw new Error("Application window closed");
    if (activeEditor) {
      if (editorVisible) home.contentView.removeChildView(activeEditor);
      activeEditor.webContents.close();
    }
    activePath = path;
    showEditor(editor);
    return { editor, origin, token, stop, child };
  } catch (error) {
    win?.webContents.close();
    await stop();
    throw error;
  }
}
async function action(event: IpcMainInvokeEvent, run: () => Promise<void>) {
  assertLauncher(event);
  if (opening) return { ok: false, error: "正在打开项目，请稍候。" };
  opening = true;
  try {
    await run();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    opening = false;
  }
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", focusCurrent);
  app.on("activate", focusCurrent);
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", (event) => {
    if (quitting || services.size === 0) return;
    event.preventDefault();
    quitting = true;
    void Promise.all([...services.values()].map((service) => service.stop())).finally(() =>
      app.quit(),
    );
  });
  void app
    .whenReady()
    .then(async () => {
      ipcMain.handle("desktop:recents", async (event) => {
        assertLauncher(event);
        return readRecents(recentsFile());
      });
      ipcMain.handle("desktop:open", (event) =>
        action(event, async () => {
          const result = await dialog.showOpenDialog(home!, {
            title: "打开演示项目",
            properties: ["openDirectory"],
          });
          if (!result.canceled && result.filePaths[0]) await openProject(result.filePaths[0]);
        }),
      );
      ipcMain.handle("desktop:create", (event) =>
        action(event, async () => {
          const result = await dialog.showSaveDialog(home!, {
            title: "新建项目文件夹",
            defaultPath: join(app.getPath("documents"), "我的演示"),
            buttonLabel: "创建项目",
          });
          if (result.canceled || !result.filePath) return;
          const cliRoot = dirname(require.resolve("@hyperframes/cli/package.json"));
          const path = await createProject(
            result.filePath,
            join(cliRoot, "dist/templates/blank/index.html"),
          );
          await openProject(path);
        }),
      );
      ipcMain.handle("desktop:reopen", (event, path: unknown) =>
        action(event, async () => {
          const recent = await readRecents(recentsFile());
          if (typeof path !== "string" || !recent.some((project) => project.path === path))
            throw new Error("项目不在最近打开列表中，请使用打开项目。");
          await openProject(path);
        }),
      );
      Menu.setApplicationMenu(
        Menu.buildFromTemplate([
          ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
          {
            label: "文件",
            submenu: [
              { label: "项目首页", accelerator: "CmdOrCtrl+Shift+O", click: createHome },
              {
                label: "返回编辑器",
                click: () => {
                  if (activeEditor) showEditor(activeEditor);
                },
              },
              { role: "close" },
            ],
          },
          { role: "editMenu" },
          { role: "viewMenu" },
          { role: "windowMenu" },
        ]),
      );
      createHome();
      if (smokeProject) {
        try {
          const opened = await openProject(smokeProject);
          if (!opened) throw new Error("Smoke project was already open");
          const { editor, origin, token, stop, child } = opened;
          const denied = await fetch(`${origin}/api/projects`);
          const allowed = await fetch(`${origin}/api/projects`, {
            headers: { "x-future-ppt-session": token },
          });
          if (denied.status !== 403 || !allowed.ok)
            throw new Error("Desktop service access gate failed");
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const text: string =
            await editor.webContents.executeJavaScript("document.body.innerText");
          if (!/(Timeline|时间轴)/.test(text) || text.includes("Waiting for preview server"))
            throw new Error(`Editor not ready: ${text.slice(0, 300)}`);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(
              () => reject(new Error("Node subprocess probe timed out")),
              15000,
            );
            child.on("message", (message) => {
              if (message?.type !== "node-probe") return;
              clearTimeout(timer);
              if (message.ok) resolve();
              else reject(new Error(message.error));
            });
            child.postMessage({ type: "probe-node" });
          });
          const interaction = await editor.webContents.executeJavaScript(
            "(() => { const tab = [...document.querySelectorAll('[role=tab], button')].find(el => ['Assets', '素材'].includes(el.textContent.trim())); if (!tab) return document.body.innerHTML.slice(0,12000); tab.click(); return 'clicked'; })()",
          );
          if (interaction !== "clicked") throw new Error(`Assets target missing: ${interaction}`);
          const editorUrl = editor.webContents.getURL();
          app.emit("activate");
          await promisify(execFile)(
            process.execPath,
            [...(app.isPackaged ? [] : [app.getAppPath()]), `--smoke-project=${smokeProject}`],
            { timeout: 15000, windowsHide: true },
          );
          await new Promise((resolve) => setTimeout(resolve, 10000));
          if (
            BrowserWindow.getAllWindows().length !== 1 ||
            !home?.contentView.children.includes(editor) ||
            !editorVisible ||
            activeEditor !== editor ||
            editor.webContents.getURL() !== editorUrl
          )
            throw new Error("Editor changed after interaction or application activation");
          createHome();
          if (editorVisible) throw new Error("Explicit home navigation failed");
          await openProject(smokeProject);
          if (!editorVisible || activeEditor !== editor)
            throw new Error("Editor resume lost its session");
          console.log("DESKTOP_WINDOW_REGRESSION_OK");
          console.log(
            "DESKTOP_SMOKE_OK",
            JSON.stringify({
              project: smokeProject,
              authorized: allowed.status,
              unauthorized: denied.status,
            }),
          );
          const isolated = await editor.webContents.executeJavaScript(
            "typeof window.require === 'undefined' && typeof window.desktop === 'undefined'",
          );
          if (!isolated) throw new Error("Editor isolation failed");
          const capture = process.argv
            .find((arg) => arg.startsWith("--smoke-screenshot="))
            ?.slice(19);
          if (capture && home)
            await writeFile(capture, (await home.webContents.capturePage()).toPNG());
          editor.webContents.close();
          await stop();
          await fetch(origin).then(
            () => {
              throw new Error("Service survived window close");
            },
            () => {},
          );
          console.log("DESKTOP_SHUTDOWN_OK");
          app.quit();
        } catch (error) {
          console.error(error);
          app.exit(1);
        }
      }
    })
    .catch((error) => {
      console.error(error);
      app.exit(1);
    });
}
