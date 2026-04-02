/**
 * Custom Pi SDK tools for GeoGebra interaction.
 * These tools run in the main process and query the renderer via IPC.
 */

import { Type } from "@sinclair/typebox";
import { defineTool } from "@mariozechner/pi-coding-agent";
import type { BrowserWindow } from "electron";

// --- Canvas query mechanism ---

type PendingQuery = {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pendingQueries = new Map<string, PendingQuery>();
let queryCounter = 0;

/**
 * Send a query to the renderer process and wait for the response.
 */
function queryRenderer(
  win: BrowserWindow,
  method: string,
  params: any = {},
  timeoutMs = 5000
): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = `q_${++queryCounter}`;
    const timer = setTimeout(() => {
      pendingQueries.delete(id);
      reject(new Error(`Canvas query "${method}" timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    pendingQueries.set(id, { resolve, reject, timer });
    win.webContents.send("canvas:query", { id, method, params });
  });
}

/**
 * Handle query response from renderer. Call this from ipcMain listener.
 */
export function handleCanvasQueryResponse(id: string, result: any) {
  const pending = pendingQueries.get(id);
  if (pending) {
    clearTimeout(pending.timer);
    pendingQueries.delete(id);
    pending.resolve(result);
  }
}

// --- Tool definitions ---

export function createGeoGebraTools(getWindow: () => BrowserWindow | null) {
  const listGeoGebraInstances = defineTool({
    name: "list_geogebra_instances",
    label: "List GeoGebra Instances",
    description:
      "List all GeoGebra instances currently on the canvas. Returns each instance's shape ID, label, app type (geometry/graphing/3d), position, and size.",
    parameters: Type.Object({}),
    execute: async () => {
      const win = getWindow();
      if (!win) {
        return {
          content: [{ type: "text" as const, text: "Error: No active window." }],
          details: {},
        };
      }

      try {
        const instances = await queryRenderer(win, "list_geogebra_instances");
        const text =
          instances.length === 0
            ? "No GeoGebra instances on the canvas."
            : JSON.stringify(instances, null, 2);
        return {
          content: [{ type: "text" as const, text }],
          details: {},
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e.message}` }],
          details: {},
        };
      }
    },
  });

  const getGeoGebraState = defineTool({
    name: "get_geogebra_state",
    label: "Get GeoGebra State",
    description:
      "Get the full state of a specific GeoGebra instance, including all geometric objects (points, lines, circles, functions, etc.) with their types, values, visibility, and colors. Use list_geogebra_instances first to get available shape IDs.",
    parameters: Type.Object({
      shapeId: Type.String({
        description: "The shape ID of the GeoGebra instance to query.",
      }),
    }),
    execute: async (_toolCallId, params) => {
      const win = getWindow();
      if (!win) {
        return {
          content: [{ type: "text" as const, text: "Error: No active window." }],
          details: {},
        };
      }

      try {
        const state = await queryRenderer(win, "get_geogebra_state", {
          shapeId: params.shapeId,
        });
        if (!state) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error: GeoGebra instance "${params.shapeId}" not found.`,
              },
            ],
            details: {},
          };
        }
        return {
          content: [{ type: "text" as const, text: JSON.stringify(state, null, 2) }],
          details: {},
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e.message}` }],
          details: {},
        };
      }
    },
  });

  const geoGebraCommand = defineTool({
    name: "geogebra_command",
    label: "GeoGebra Command",
    description:
      "Execute a GeoGebra command on a specific instance. Supports all standard GeoGebra commands such as creating points (e.g. 'A = (1, 2)'), lines ('Line(A, B)'), circles ('Circle(A, B)'), polygons ('Polygon(A, B, C)'), functions ('f(x) = x^2'), and more. Use list_geogebra_instances to get available shape IDs, and get_geogebra_state to see existing objects before modifying.",
    parameters: Type.Object({
      shapeId: Type.String({
        description: "The shape ID of the GeoGebra instance to execute the command on.",
      }),
      command: Type.String({
        description:
          "The GeoGebra command to execute. Examples: 'A = (1, 2)', 'Line(A, B)', 'Circle(A, 3)', 'Polygon(A, B, C)', 'f(x) = sin(x)'.",
      }),
    }),
    execute: async (_toolCallId, params) => {
      const win = getWindow();
      if (!win) {
        return {
          content: [{ type: "text" as const, text: "Error: No active window." }],
          details: {},
        };
      }

      try {
        const result = await queryRenderer(win, "execute_geogebra_command", {
          shapeId: params.shapeId,
          command: params.command,
        });
        if (!result.success) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error executing command: ${result.error}`,
              },
            ],
            details: {},
          };
        }
        return {
          content: [
            {
              type: "text" as const,
              text: `Command executed successfully: ${params.command}`,
            },
          ],
          details: {},
        };
      } catch (e: any) {
        return {
          content: [{ type: "text" as const, text: `Error: ${e.message}` }],
          details: {},
        };
      }
    },
  });

  return [listGeoGebraInstances, getGeoGebraState, geoGebraCommand];
}
