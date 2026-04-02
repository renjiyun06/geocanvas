import {
  DefaultToolbar,
  DefaultToolbarContent,
  Tldraw,
  TldrawUiMenuItem,
  useIsToolSelected,
  useTools,
} from "tldraw";
import type {
  TLComponents,
  TLUiAssetUrlOverrides,
  TLUiOverrides,
} from "tldraw";
import "tldraw/tldraw.css";
import { GeoGebraShapeUtil } from "./shapes/GeoGebraShape";
import { GeoGebraTool } from "./shapes/GeoGebraTool";
import { ChatShapeUtil } from "./shapes/ChatShape";
import { ChatTool } from "./shapes/ChatTool";

// Custom shape utils
const customShapeUtils = [GeoGebraShapeUtil, ChatShapeUtil];

// Custom tools
const customTools = [GeoGebraTool, ChatTool];

// UI overrides: register the GeoGebra tool
const uiOverrides: TLUiOverrides = {
  tools(editor, tools) {
    tools.geogebra = {
      id: "geogebra",
      icon: "geogebra-icon",
      label: "GeoGebra 画板",
      kbd: "g",
      onSelect: () => {
        editor.setCurrentTool("geogebra");
      },
    };
    tools.chat = {
      id: "chat",
      icon: "chat-icon",
      label: "AI 对话",
      kbd: "c",
      onSelect: () => {
        editor.setCurrentTool("chat");
      },
    };
    return tools;
  },
};

// Custom toolbar with GeoGebra button
const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isGeoGebraSelected = useIsToolSelected(tools["geogebra"]);
    const isChatSelected = useIsToolSelected(tools["chat"]);
    return (
      <DefaultToolbar {...props}>
        <DefaultToolbarContent />
        <TldrawUiMenuItem
          {...tools["geogebra"]}
          isSelected={isGeoGebraSelected}
        />
        <TldrawUiMenuItem
          {...tools["chat"]}
          isSelected={isChatSelected}
        />
      </DefaultToolbar>
    );
  },
};

// Custom asset URLs for icons
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "geogebra-icon": "/geogebra-icon.svg",
    "chat-icon": "/chat-icon.svg",
  },
};

function App() {
  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <Tldraw
        shapeUtils={customShapeUtils}
        tools={customTools}
        overrides={uiOverrides}
        components={components}
        assetUrls={customAssetUrls}
      />
    </div>
  );
}

export default App;
