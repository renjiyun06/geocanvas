export type AgentEvent = {
  shapeId: string;
  type: "text_delta" | "thinking_delta" | "tool_start" | "tool_update" | "tool_end" | "agent_start" | "agent_end";
  delta?: string;
  toolName?: string;
  isError?: boolean;
  data?: unknown;
};

export interface ElectronAPI {
  createSession: (shapeId: string) => Promise<{ success: boolean; error?: string }>;
  prompt: (shapeId: string, text: string) => Promise<{ success: boolean; error?: string }>;
  destroySession: (shapeId: string) => Promise<{ success: boolean }>;
  onAgentEvent: (callback: (event: AgentEvent) => void) => () => void;
  onCanvasCommand: (callback: (command: unknown) => void) => () => void;
  ping: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
