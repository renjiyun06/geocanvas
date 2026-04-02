import { BaseBoxShapeTool } from "@tldraw/editor";

export class ChatTool extends BaseBoxShapeTool {
  static override id = "chat";
  static override initial = "idle";
  override shapeType = "chat";
}
