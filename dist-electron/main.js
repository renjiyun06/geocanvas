import { app, BrowserWindow, globalShortcut, ipcMain, Menu } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager, } from "@mariozechner/pi-coding-agent";
import { getModel } from "@mariozechner/pi-ai";
import { createGeoGebraTools, handleCanvasQueryResponse } from "./tools.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.commandLine.appendSwitch("no-sandbox");
let mainWindow = null;
// --- Pi SDK session management ---
const sessions = new Map();
const unsubscribes = new Map();
function getWorkspaceDir() {
    return path.join(app.getPath("userData"), "workspace");
}
async function createSession(shapeId) {
    if (sessions.has(shapeId))
        return;
    const authStorage = AuthStorage.create();
    const modelRegistry = ModelRegistry.create(authStorage);
    const model = getModel("anthropic", "claude-opus-4-6");
    if (!model)
        throw new Error("Model claude-opus-4-6 not found");
    const geogebraTools = createGeoGebraTools(() => mainWindow);
    const { session } = await createAgentSession({
        cwd: getWorkspaceDir(),
        model,
        thinkingLevel: "medium",
        sessionManager: SessionManager.inMemory(),
        authStorage,
        modelRegistry,
        customTools: geogebraTools,
    });
    // Subscribe to events and forward to renderer
    const unsubscribe = session.subscribe((event) => {
        if (!mainWindow)
            return;
        switch (event.type) {
            case "message_update": {
                const evt = event.assistantMessageEvent;
                if (evt.type === "text_delta") {
                    mainWindow.webContents.send("agent:event", {
                        shapeId,
                        type: "text_delta",
                        delta: evt.delta,
                    });
                }
                else if (evt.type === "thinking_delta") {
                    mainWindow.webContents.send("agent:event", {
                        shapeId,
                        type: "thinking_delta",
                        delta: evt.delta,
                    });
                }
                break;
            }
            case "tool_execution_start":
                mainWindow.webContents.send("agent:event", {
                    shapeId,
                    type: "tool_start",
                    toolName: event.toolName,
                });
                break;
            case "tool_execution_update":
                mainWindow.webContents.send("agent:event", {
                    shapeId,
                    type: "tool_update",
                    data: event,
                });
                break;
            case "tool_execution_end":
                mainWindow.webContents.send("agent:event", {
                    shapeId,
                    type: "tool_end",
                    toolName: event.toolName,
                    isError: event.isError,
                });
                break;
            case "agent_start":
                mainWindow.webContents.send("agent:event", {
                    shapeId,
                    type: "agent_start",
                });
                break;
            case "agent_end":
                mainWindow.webContents.send("agent:event", {
                    shapeId,
                    type: "agent_end",
                });
                break;
        }
    });
    sessions.set(shapeId, session);
    unsubscribes.set(shapeId, unsubscribe);
}
function destroySession(shapeId) {
    const unsubscribe = unsubscribes.get(shapeId);
    if (unsubscribe) {
        unsubscribe();
        unsubscribes.delete(shapeId);
    }
    const session = sessions.get(shapeId);
    if (session) {
        session.dispose();
        sessions.delete(shapeId);
    }
}
// --- Window creation ---
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false,
        },
    });
    if (process.env.VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
        mainWindow.webContents.openDevTools({ mode: "bottom" });
    }
    else {
        mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
    }
    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}
app.whenReady().then(async () => {
    // Ensure workspace directory exists
    const fs = await import("fs");
    const wsDir = getWorkspaceDir();
    if (!fs.existsSync(wsDir)) {
        fs.mkdirSync(wsDir, { recursive: true });
    }
    Menu.setApplicationMenu(null);
    createWindow();
    globalShortcut.register("CommandOrControl+R", () => {
        mainWindow?.webContents.reload();
    });
    globalShortcut.register("F12", () => {
        mainWindow?.webContents.toggleDevTools();
    });
    globalShortcut.register("F5", () => {
        mainWindow?.webContents.reload();
    });
});
app.on("window-all-closed", () => {
    // Clean up all sessions
    for (const shapeId of sessions.keys()) {
        destroySession(shapeId);
    }
    if (process.platform !== "darwin") {
        app.quit();
    }
});
app.on("activate", () => {
    if (mainWindow === null) {
        createWindow();
    }
});
// --- IPC handlers ---
ipcMain.handle("ping", async () => {
    return "pong from main process";
});
ipcMain.handle("agent:create-session", async (_event, shapeId) => {
    try {
        await createSession(shapeId);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle("agent:prompt", async (_event, shapeId, text) => {
    const session = sessions.get(shapeId);
    if (!session) {
        return { success: false, error: "Session not found. Create session first." };
    }
    try {
        await session.prompt(text);
        return { success: true };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
});
ipcMain.handle("agent:destroy-session", async (_event, shapeId) => {
    destroySession(shapeId);
    return { success: true };
});
// Canvas query response from renderer
ipcMain.on("canvas:query-response", (_event, id, result) => {
    handleCanvasQueryResponse(id, result);
});
