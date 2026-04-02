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

// --- Shape type definition ---

const CHAT_SHAPE_TYPE = "chat" as const;

const HEADER_H = 36;
const INPUT_H = 56;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
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

function getMessages(shapeId: string): ChatMessage[] {
  if (!messageStore.has(shapeId)) {
    messageStore.set(shapeId, []);
  }
  return messageStore.get(shapeId)!;
}

function addMessage(shapeId: string, msg: ChatMessage): ChatMessage[] {
  const msgs = getMessages(shapeId);
  msgs.push(msg);
  return [...msgs];
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

  const contentW = shape.props.w;
  const contentH = shape.props.h - HEADER_H;

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

    const events = ["pointerdown", "pointerup", "click", "wheel", "keydown", "keyup"];
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

    const updated = addMessage(shape.id, { role: "user", content: text });
    setMessages([...updated]);
    setInput("");
    setIsLoading(true);

    // Mock AI response (will be replaced by Pi SDK)
    setTimeout(() => {
      const reply = addMessage(shape.id, {
        role: "assistant",
        content: `[模拟回复] 收到: "${text}"\n\n这是一个模拟的 AI 回复。接入 Pi SDK 后将会有真实的智能体响应。`,
      });
      setMessages([...reply]);
      setIsLoading(false);
    }, 800);
  }, [input, isLoading, shape.id]);

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
          {messages.length} 条消息{isEditing ? " ✏️" : ""}
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
          {messages.length === 0 && (
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
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: "12px",
                  fontSize: "13px",
                  lineHeight: "1.5",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  backgroundColor:
                    msg.role === "user" ? "#8b5cf6" : "#f3f4f6",
                  color: msg.role === "user" ? "white" : "#333",
                }}
              >
                {msg.content}
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
