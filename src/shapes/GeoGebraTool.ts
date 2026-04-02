import { StateNode, type TLEventHandlers, createShapeId, type TLShapeId } from "@tldraw/editor";
import { getNextGeoGebraLabel } from "./GeoGebraShape";

// Idle state - waiting for user to start dragging
class Idle extends StateNode {
  static override id = "idle";

  override onEnter() {
    this.editor.setCursor({ type: "cross", rotation: 0 });
  }

  override onPointerDown: TLEventHandlers["onPointerDown"] = () => {
    this.parent.transition("creating");
  };

  override onCancel() {
    this.editor.setCurrentTool("select");
  }
}

// Creating state - user is dragging to define size
class Creating extends StateNode {
  static override id = "creating";

  shapeId: TLShapeId = createShapeId();
  startX = 0;
  startY = 0;

  override onEnter() {
    const { originPagePoint } = this.editor.inputs;
    this.startX = originPagePoint.x;
    this.startY = originPagePoint.y;
    this.shapeId = createShapeId();

    this.editor.createShape({
      id: this.shapeId,
      type: "geogebra",
      x: this.startX,
      y: this.startY,
      props: {
        w: 10,
        h: 10,
        label: getNextGeoGebraLabel(),
        appName: "geometry",
      },
    });
  }

  override onPointerMove: TLEventHandlers["onPointerMove"] = () => {
    const { currentPagePoint } = this.editor.inputs;

    const x = Math.min(this.startX, currentPagePoint.x);
    const y = Math.min(this.startY, currentPagePoint.y);
    const w = Math.max(200, Math.abs(currentPagePoint.x - this.startX));
    const h = Math.max(150, Math.abs(currentPagePoint.y - this.startY));

    this.editor.updateShape({
      id: this.shapeId,
      type: "geogebra",
      x,
      y,
      props: { w, h },
    });
  };

  override onPointerUp: TLEventHandlers["onPointerUp"] = () => {
    const shape = this.editor.getShape(this.shapeId);
    if (shape && shape.props.w < 200) {
      // Too small drag, set default size
      this.editor.updateShape({
        id: this.shapeId,
        type: "geogebra",
        props: { w: 600, h: 500 },
      });
    }
    this.editor.select(this.shapeId);
    this.editor.setCurrentTool("select");
  };

  override onCancel() {
    this.editor.deleteShape(this.shapeId);
    this.parent.transition("idle");
  }
}

export class GeoGebraTool extends StateNode {
  static override id = "geogebra";
  static override initial = "idle";
  static override children = () => [Idle, Creating];
}
