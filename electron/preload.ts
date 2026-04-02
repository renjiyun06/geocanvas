import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  // Pi agent communication
  prompt: (text: string) => ipcRenderer.invoke("agent:prompt", text),
  onAgentEvent: (callback: (event: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: unknown) => callback(data);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },

  // Canvas operations (agent -> renderer)
  onCanvasCommand: (callback: (command: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: unknown) => callback(command);
    ipcRenderer.on("canvas:command", listener);
    return () => ipcRenderer.removeListener("canvas:command", listener);
  },

  // Test
  ping: () => ipcRenderer.invoke("ping"),
});
