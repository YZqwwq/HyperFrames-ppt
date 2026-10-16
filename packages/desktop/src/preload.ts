import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("desktop", {
  recents: () => ipcRenderer.invoke("desktop:recents"),
  open: () => ipcRenderer.invoke("desktop:open"),
  create: () => ipcRenderer.invoke("desktop:create"),
  reopen: (path: string) => ipcRenderer.invoke("desktop:reopen", path),
});
