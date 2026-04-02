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
import { useEffect, useRef, useState } from "react";

// --- Shape type definition ---

const GEOGEBRA_SHAPE_TYPE = "geogebra" as const;

const HEADER_H = 32;

type GeoGebraShapeProps = {
  w: number;
  h: number;
  label: string;
  appName: string;
};

type IGeoGebraShape = TLBaseShape<
  typeof GEOGEBRA_SHAPE_TYPE,
  GeoGebraShapeProps
>;

// --- Counter for auto-labeling ---

let geogebraCounter = 0;

export function getNextGeoGebraLabel(): string {
  geogebraCounter++;
  return `画板 ${geogebraCounter}`;
}

// --- GeoGebra component rendered inside the shape ---

function GeoGebraEmbed({ shape }: { shape: IGeoGebraShape }) {
  const isEditing = useIsEditing(shape.id);
  const editor = useEditor();
  const containerRef = useRef<HTMLDivElement>(null);
  const appletRef = useRef<any>(null);
  const ggbApiRef = useRef<any>(null);
  const [loaded, setLoaded] = useState(false);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  const contentW = Math.floor(shape.props.w);
  const contentH = Math.floor(shape.props.h - HEADER_H);

  // Mark events as handled so tldraw skips them when editing GeoGebra
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

    const events = ["pointerdown", "pointerup", "click", "wheel"];
    for (const evt of events) {
      reactRoot.addEventListener(evt, markAsHandled, true);
    }

    return () => {
      for (const evt of events) {
        reactRoot.removeEventListener(evt, markAsHandled, true);
      }
    };
  }, [editor]);

  // Inject GeoGebra once when size is big enough
  useEffect(() => {
    if (appletRef.current) return;
    if (contentW < 100 || contentH < 100) return;
    const el = containerRef.current;
    if (!el) return;

    const doInject = () => {
      if (!el || appletRef.current) return;

      const ggbElement = document.createElement("div");
      ggbElement.id = `ggb-${shape.id}`;
      el.appendChild(ggbElement);

      const params = {
        appName: shape.props.appName,
        width: contentW,
        height: contentH,
        showToolBar: true,
        showAlgebraInput: true,
        showMenuBar: false,
        allowStyleBar: true,
        id: shape.id,
        appletOnLoad: (api: any) => {
          ggbApiRef.current = api;
        },
      };

      try {
        const applet = new (window as any).GGBApplet(params, true);
        applet.inject(ggbElement.id);
        appletRef.current = applet;
        setLoaded(true);
      } catch (e) {
        console.error("Failed to inject GeoGebra applet:", e);
      }
    };

    if ((window as any).GGBApplet) {
      doInject();
    } else {
      const check = setInterval(() => {
        if ((window as any).GGBApplet) {
          clearInterval(check);
          doInject();
        }
      }, 200);
      return () => clearInterval(check);
    }
  }, [shape.id, shape.props.appName, contentW, contentH]);

  // Resize GeoGebra when shape size changes
  useEffect(() => {
    if (!ggbApiRef.current) {
      const api = (window as any)[shape.id];
      if (api && typeof api.setSize === "function") {
        ggbApiRef.current = api;
      }
    }
    if (ggbApiRef.current && contentW > 0 && contentH > 0) {
      ggbApiRef.current.setSize(contentW, contentH);
    }
  }, [shape.id, contentW, contentH]);

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
          backgroundColor: isEditing ? "#2a70b9" : "#4a90d9",
          color: "white",
          fontSize: "13px",
          fontWeight: 600,
          userSelect: "none",
          pointerEvents: "none",
        }}
      >
        <span>{shape.props.label}</span>
        <span style={{ fontSize: "11px", opacity: 0.8 }}>
          {shape.props.appName === "geometry"
            ? "几何"
            : shape.props.appName === "graphing"
              ? "函数"
              : "3D"}
          {isEditing ? " ✏️" : ""}
        </span>
      </div>

      {/* GeoGebra container */}
      <div
        ref={containerRef}
        style={{
          width: `${contentW}px`,
          height: `${contentH}px`,
          position: "relative",
          overflow: "hidden",
          pointerEvents: isEditing ? "all" : "none",
        }}
      >
        {!loaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#999",
              fontSize: "14px",
            }}
          >
            加载 GeoGebra 中...
          </div>
        )}
      </div>
    </HTMLContainer>
  );
}

// --- ShapeUtil ---

export class GeoGebraShapeUtil extends ShapeUtil<IGeoGebraShape> {
  static override type = GEOGEBRA_SHAPE_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    label: T.string,
    appName: T.string,
  };

  getDefaultProps(): IGeoGebraShape["props"] {
    return {
      w: 600,
      h: 500,
      label: getNextGeoGebraLabel(),
      appName: "geometry",
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

  getGeometry(shape: IGeoGebraShape): Geometry2d {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: any, info: TLResizeInfo<any>) {
    return resizeBox(shape, info);
  }

  component(shape: IGeoGebraShape) {
    return <GeoGebraEmbed shape={shape} />;
  }

  indicator(shape: IGeoGebraShape) {
    return (
      <rect width={shape.props.w} height={shape.props.h} rx={8} ry={8} />
    );
  }
}
