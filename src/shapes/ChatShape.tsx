import {
  Geometry2d,
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  resizeBox,
  useIsEditing,
  useEditor,
  type TLResizeInfo,
  type TLBaseShape,
} from "@tldraw/editor";
import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentEvent } from "../types/electron";

// --- Shape type definition ---

const CHAT_SHAPE_TYPE = "chat" as const;

const HEADER_H = 36;
const INPUT_H = 56;

type ChatMessageBlock =
  | { type: "text"; content: string }
  | { type: "thinking"; content: string }
  | { type: "tool"; toolName: string; status: "running" | "done" | "error" };

type ChatMessage = {
  role: "user" | "assistant";
  blocks: ChatMessageBlock[];
};

type ChatShapeProps = {
  w: number;
  h: number;
  label: string;
};

type IChatShape = TLBaseShape<typeof CHAT_SHAPE_TYPE, ChatShapeProps>;

// --- Counter for auto-labeling ---

let chatCounter = 0;

export function getNextChatLabel(): string {
  chatCounter++;
  return `对话 ${chatCounter}`;
}

// --- In-memory message store (per shape instance) ---

const messageStore = new Map<string, ChatMessage[]>();
const sessionReady = new Map<string, boolean>();

function getMessages(shapeId: string): ChatMessage[] {
  if (!messageStore.has(shapeId)) {
    messageStore.set(shapeId, []);
  }
  return messageStore.get(shapeId)!;
}

// --- Render a message block ---

function MessageBlock({ block }: { block: ChatMessageBlock }) {
  if (block.type === "thinking") {
    return (
      <div
        style={{
          fontSize: "12px",
          color: "#8b5cf6",
          fontStyle: "italic",
          borderLeft: "2px solid #8b5cf6",
          paddingLeft: "8px",
          marginBottom: "4px",
          opacity: 0.8,
        }}
      >
        💭 {block.content}
      </div>
    );
  }
  if (block.type === "tool") {
    return (
      <div
        style={{
          fontSize: "12px",
          color: block.status === "error" ? "#ef4444" : "#6b7280",
          backgroundColor: "#f9fafb",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          padding: "4px 8px",
          marginBottom: "4px",
        }}
      >
        🔧 {block.toolName}{" "}
        {block.status === "running"
          ? "⏳"
          : block.status === "error"
            ? "❌"
            : "✅"}
      </div>
    );
  }
  // text
  return (
    <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {block.content}
    </div>
  );
}

// --- Chat component rendered inside the shape ---

function ChatEmbed({ shape }: { shape: IChatShape }) {
  const isEditing = useIsEditing(shape.id);
  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    getMessages(shape.id)
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const contentW = shape.props.w;
  const contentH = shape.props.h - HEADER_H;

  const hasElectronAPI = typeof window !== "undefined" && window.electronAPI;

  // Initialize Pi session
  useEffect(() => {
    if (!hasElectronAPI) return;
    if (sessionReady.has(shape.id)) return;

    sessionReady.set(shape.id, false);

    window.electronAPI.createSession(shape.id).then((result) => {
      if (result.success) {
        sessionReady.set(shape.id, true);
      } else {
        setSessionError(result.error || "Failed to create session");
      }
    });

    return () => {
      // Don't destroy on unmount since tldraw may re-render
    };
  }, [shape.id, hasElectronAPI]);

  // Listen for agent events
  useEffect(() => {
    if (!hasElectronAPI) return;

    const unsubscribe = window.electronAPI.onAgentEvent((event: AgentEvent) => {
      if (event.shapeId !== shape.id) return;

      const msgs = getMessages(shape.id);

      switch (event.type) {
        case "agent_start": {
          // Add new assistant message
          msgs.push({ role: "assistant", blocks: [] });
          setMessages([...msgs]);
          setIsLoading(true);
          break;
        }
        case "thinking_delta": {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.role === "assistant") {
            const lastBlock = lastMsg.blocks[lastMsg.blocks.length - 1];
            if (lastBlock?.type === "thinking") {
              lastBlock.content += event.delta || "";
            } else {
              lastMsg.blocks.push({
                type: "thinking",
                content: event.delta || "",
              });
            }
            setMessages([...msgs]);
          }
          break;
        }
        case "text_delta": {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.role === "assistant") {
            const lastBlock = lastMsg.blocks[lastMsg.blocks.length - 1];
            if (lastBlock?.type === "text") {
              lastBlock.content += event.delta || "";
            } else {
              lastMsg.blocks.push({
                type: "text",
                content: event.delta || "",
              });
            }
            setMessages([...msgs]);
          }
          break;
        }
        case "tool_start": {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.role === "assistant") {
            lastMsg.blocks.push({
              type: "tool",
              toolName: event.toolName || "unknown",
              status: "running",
            });
            setMessages([...msgs]);
          }
          break;
        }
        case "tool_end": {
          const lastMsg = msgs[msgs.length - 1];
          if (lastMsg?.role === "assistant") {
            // Find last running tool block
            for (let i = lastMsg.blocks.length - 1; i >= 0; i--) {
              const block = lastMsg.blocks[i];
              if (block.type === "tool" && block.status === "running") {
                block.status = event.isError ? "error" : "done";
                break;
              }
            }
            setMessages([...msgs]);
          }
          break;
        }
        case "agent_end": {
          setIsLoading(false);
          break;
        }
      }
    });

    return unsubscribe;
  }, [shape.id, hasElectronAPI]);

  // Mark events as handled so tldraw skips them when editing
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const reactRoot = document.getElementById("root") || document.body;

    const markAsHandled = (e: Event) => {
      if (!isEditingRef.current) return;
      const target = e.target as Node;
      if (el.contains(target)) {
        editor.markEventAsHandled(e);
      }
    };

    const events = [
      "pointerdown",
      "pointerup",
      "click",
      "wheel",
      "keydown",
      "keyup",
    ];
    for (const evt of events) {
      reactRoot.addEventListener(evt, markAsHandled, true);
    }

    return () => {
      for (const evt of events) {
        reactRoot.removeEventListener(evt, markAsHandled, true);
      }
    };
  }, [editor]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isEditing]);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isLoading) return;

    // Add user message
    const msgs = getMessages(shape.id);
    msgs.push({ role: "user", blocks: [{ type: "text", content: text }] });
    setMessages([...msgs]);
    setInput("");

    if (hasElectronAPI && sessionReady.get(shape.id)) {
      // Real Pi SDK call
      window.electronAPI.prompt(shape.id, text).then((result) => {
        if (!result.success) {
          const msgs2 = getMessages(shape.id);
          msgs2.push({
            role: "assistant",
            blocks: [
              { type: "text", content: `❌ 错误: ${result.error}` },
            ],
          });
          setMessages([...msgs2]);
          setIsLoading(false);
        }
      });
    } else {
      // Mock response when not in Electron
      setIsLoading(true);
      setTimeout(() => {
        const msgs2 = getMessages(shape.id);
        msgs2.push({
          role: "assistant",
          blocks: [
            {
              type: "text",
              content: `[模拟回复] 收到: "${text}"\n\n需要在 Electron 环境中运行才能连接 Pi SDK。`,
            },
          ],
        });
        setMessages([...msgs2]);
        setIsLoading(false);
      }, 800);
    }
  }, [input, isLoading, shape.id, hasElectronAPI]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <HTMLContainer
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#ffffff",
        borderRadius: "8px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
        pointerEvents: "all",
      }}
    >
      {/* Header */}
      <div
        style={{
          height: `${HEADER_H}px`,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: isEditing ? "#6b4c9a" : "#8b5cf6",
          color: "white",
          fontSize: "13px",
          fontWeight: 600,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        <span>💬 {shape.props.label}</span>
        <span style={{ fontSize: "11px", opacity: 0.8 }}>
          {sessionError
            ? "⚠️ 未连接"
            : sessionReady.get(shape.id)
              ? "🟢 已连接"
              : "🔄 连接中..."}
          {isEditing ? " ✏️" : ""}
        </span>
      </div>

      {/* Chat area */}
      <div
        ref={containerRef}
        style={{
          width: `${contentW}px`,
          height: `${contentH}px`,
          display: "flex",
          flexDirection: "column",
          pointerEvents: isEditing ? "all" : "none",
        }}
      >
        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {sessionError && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "#fef2f2",
                color: "#ef4444",
                fontSize: "12px",
              }}
            >
              ⚠️ {sessionError}
            </div>
          )}
          {messages.length === 0 && !sessionError && (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#999",
                fontSize: "13px",
              }}
            >
              双击开始对话...
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "85%",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  backgroundColor:
                    msg.role === "user" ? "#8b5cf6" : "#f3f4f6",
                  color: msg.role === "user" ? "white" : "#333",
                }}
              >
                {msg.blocks.map((block, j) => (
                  <MessageBlock key={j} block={block} />
                ))}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  backgroundColor: "#f3f4f6",
                  color: "#999",
                }}
              >
                思考中...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          style={{
            height: `${INPUT_H}px`,
            borderTop: "1px solid #e5e7eb",
            padding: "8px 12px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
            style={{
              flex: 1,
              resize: "none",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              padding: "6px 10px",
              fontSize: "13px",
              lineHeight: "1.4",
              outline: "none",
              fontFamily: "inherit",
              height: "36px",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            style={{
              padding: "6px 16px",
              borderRadius: "8px",
              border: "none",
              backgroundColor:
                !input.trim() || isLoading ? "#d1d5db" : "#8b5cf6",
              color: "white",
              fontSize: "13px",
              fontWeight: 600,
              cursor:
                !input.trim() || isLoading ? "not-allowed" : "pointer",
              height: "36px",
            }}
          >
            发送
          </button>
        </div>
      </div>
    </HTMLContainer>
  );
}

// --- ShapeUtil ---

export class ChatShapeUtil extends ShapeUtil<IChatShape> {
  static override type = CHAT_SHAPE_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    label: T.string,
  };

  getDefaultProps(): IChatShape["props"] {
    return {
      w: 400,
      h: 500,
      label: getNextChatLabel(),
    };
  }

  override canEdit() {
    return true;
  }

  override canResize() {
    return true;
  }

  override isAspectRatioLocked() {
    return false;
  }

  getGeometry(shape: IChatShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: any, info: TLResizeInfo<any>) {
    return resizeBox(shape, info);
  }

  component(shape: IChatShape) {
    return <ChatEmbed shape={shape} />;
  }

  indicator(shape: IChatShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
    );
  }
}
