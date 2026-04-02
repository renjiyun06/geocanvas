import { contextBridge, ipcRenderer } from "electron";

export type AgentEvent = {
  shapeId: string;
  type: "text_delta" | "thinking_delta" | "tool_start" | "tool_update" | "tool_end" | "agent_start" | "agent_end";
  delta?: string;
  toolName?: string;
  isError?: boolean;
  data?: unknown;
};

contextBridge.exposeInMainWorld("electronAPI", {
  // Pi agent session management
  createSession: (shapeId: string) =>
    ipcRenderer.invoke("agent:create-session", shapeId),

  prompt: (shapeId: string, text: string) =>
    ipcRenderer.invoke("agent:prompt", shapeId, text),

  destroySession: (shapeId: string) =>
    ipcRenderer.invoke("agent:destroy-session", shapeId),

  // Agent event stream (main -> renderer)
  onAgentEvent: (callback: (event: AgentEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentEvent) =>
      callback(data);
    ipcRenderer.on("agent:event", listener);
    return () => ipcRenderer.removeListener("agent:event", listener);
  },

  // Canvas query (main -> renderer -> main)
  onCanvasQuery: (callback: (query: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, query: any) =>
      callback(query);
    ipcRenderer.on("canvas:query", listener);
    return () => ipcRenderer.removeListener("canvas:query", listener);
  },

  canvasQueryResponse: (id: string, result: any) =>
    ipcRenderer.send("canvas:query-response", id, result),

  // Canvas operations (agent -> renderer)
  onCanvasCommand: (callback: (command: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: unknown) =>
      callback(command);
    ipcRenderer.on("canvas:command", listener);
    return () => ipcRenderer.removeListener("canvas:command", listener);
  },

  // Test
  ping: () => ipcRenderer.invoke("ping"),
});
