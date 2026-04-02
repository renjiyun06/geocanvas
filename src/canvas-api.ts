/**
 * Canvas API — Renderer-side handlers for main process queries.
 * Provides access to tldraw editor state and GeoGebra instance APIs.
 */

import type { Editor } from "@tldraw/editor";

let editorInstance: Editor | null = null;

export function setEditorInstance(editor: Editor) {
  editorInstance = editor;
}

export function getEditorInstance(): Editor | null {
  return editorInstance;
}

// --- GeoGebra instance info ---

export interface GeoGebraInstanceInfo {
  shapeId: string;
  label: string;
  appName: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GeoGebraObjectInfo {
  name: string;
  type: string;
  value: string;
  visible: boolean;
  defined: boolean;
  color: string;
}

export interface GeoGebraState {
  shapeId: string;
  label: string;
  appName: string;
  objects: GeoGebraObjectInfo[];
  xml?: string;
}

/**
 * List all GeoGebra instances on the canvas.
 */
export function listGeoGebraInstances(): GeoGebraInstanceInfo[] {
  if (!editorInstance) return [];

  const shapes = editorInstance.getCurrentPageShapes();
  return shapes
    .filter((s) => s.type === "geogebra")
    .map((s) => {
      const props = s.props as {
        w: number;
        h: number;
        label: string;
        appName: string;
      };
      return {
        shapeId: s.id,
        label: props.label,
        appName: props.appName,
        x: Math.round(s.x),
        y: Math.round(s.y),
        width: Math.round(props.w),
        height: Math.round(props.h),
      };
    });
}

/**
 * Get the GeoGebra API for a specific instance.
 */
function getGeoGebraApi(shapeId: string): any | null {
  // GeoGebra stores its API on window[shapeId]
  return (window as any)[shapeId] || null;
}

/**
 * Get the full state of a GeoGebra instance including all geometric objects.
 */
export function getGeoGebraState(shapeId: string): GeoGebraState | null {
  if (!editorInstance) return null;

  const shape = editorInstance.getShape(shapeId as any);
  if (!shape || shape.type !== "geogebra") return null;

  const props = shape.props as {
    w: number;
    h: number;
    label: string;
    appName: string;
  };

  const api = getGeoGebraApi(shapeId);
  const objects: GeoGebraObjectInfo[] = [];

  if (api && typeof api.getAllObjectNames === "function") {
    try {
      const names: string[] = api.getAllObjectNames();
      for (const name of names) {
        objects.push({
          name,
          type: api.getObjectType?.(name) || "unknown",
          value: api.getValueString?.(name) || "",
          visible: api.getVisible?.(name) ?? true,
          defined: api.isDefined?.(name) ?? true,
          color: api.getColor?.(name) || "",
        });
      }
    } catch (e) {
      console.error("Failed to get GeoGebra objects:", e);
    }
  }

  return {
    shapeId,
    label: props.label,
    appName: props.appName,
    objects,
  };
}

/**
 * Execute a GeoGebra command on a specific instance.
 */
export function executeGeoGebraCommand(
  shapeId: string,
  command: string
): { success: boolean; error?: string } {
  const api = getGeoGebraApi(shapeId);
  if (!api) {
    return {
      success: false,
      error: `GeoGebra instance "${shapeId}" not found or not loaded yet.`,
    };
  }

  try {
    const result = api.evalCommand(command);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || String(e) };
  }
}

/**
 * Set up IPC handlers for main process queries.
 * Call this once when the app initializes.
 */
export function setupCanvasIPC() {
  if (!window.electronAPI?.onCanvasQuery) return;

  window.electronAPI.onCanvasQuery(async (query: any) => {
    const { id, method, params } = query;

    let result: any;

    switch (method) {
      case "list_geogebra_instances":
        result = listGeoGebraInstances();
        break;
      case "get_geogebra_state":
        result = getGeoGebraState(params.shapeId);
        break;
      case "execute_geogebra_command":
        result = executeGeoGebraCommand(params.shapeId, params.command);
        break;
      default:
        result = { error: `Unknown method: ${method}` };
    }

    // Send response back to main process
    window.electronAPI.canvasQueryResponse(id, result);
  });
}
