import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
    // Pi agent communication
    prompt: (text) => ipcRenderer.invoke("agent:prompt", text),
    onAgentEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        ipcRenderer.on("agent:event", listener);
        return () => ipcRenderer.removeListener("agent:event", listener);
    },
    // Canvas operations (agent -> renderer)
    onCanvasCommand: (callback) => {
        const listener = (_event, command) => callback(command);
        ipcRenderer.on("canvas:command", listener);
        return () => ipcRenderer.removeListener("canvas:command", listener);
    },
    // Test
    ping: () => ipcRenderer.invoke("ping"),
});
