"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld("electronAPI", {
    // Pi agent session management
    createSession: (shapeId) => electron_1.ipcRenderer.invoke("agent:create-session", shapeId),
    prompt: (shapeId, text) => electron_1.ipcRenderer.invoke("agent:prompt", shapeId, text),
    destroySession: (shapeId) => electron_1.ipcRenderer.invoke("agent:destroy-session", shapeId),
    // Agent event stream (main -> renderer)
    onAgentEvent: (callback) => {
        const listener = (_event, data) => callback(data);
        electron_1.ipcRenderer.on("agent:event", listener);
        return () => electron_1.ipcRenderer.removeListener("agent:event", listener);
    },
    // Canvas query (main -> renderer -> main)
    onCanvasQuery: (callback) => {
        const listener = (_event, query) => callback(query);
        electron_1.ipcRenderer.on("canvas:query", listener);
        return () => electron_1.ipcRenderer.removeListener("canvas:query", listener);
    },
    canvasQueryResponse: (id, result) => electron_1.ipcRenderer.send("canvas:query-response", id, result),
    // Canvas operations (agent -> renderer)
    onCanvasCommand: (callback) => {
        const listener = (_event, command) => callback(command);
        electron_1.ipcRenderer.on("canvas:command", listener);
        return () => electron_1.ipcRenderer.removeListener("canvas:command", listener);
    },
    // Test
    ping: () => electron_1.ipcRenderer.invoke("ping"),
});
