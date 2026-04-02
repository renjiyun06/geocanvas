export interface ElectronAPI {
  prompt: (text: string) => Promise<unknown>;
  onAgentEvent: (callback: (event: unknown) => void) => () => void;
  onCanvasCommand: (command: (command: unknown) => void) => () => void;
  ping: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
