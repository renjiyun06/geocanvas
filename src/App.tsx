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

// Custom shape utils
const customShapeUtils = [GeoGebraShapeUtil];

// Custom tools
const customTools = [GeoGebraTool];

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
    return tools;
  },
};

// Custom toolbar with GeoGebra button
const components: TLComponents = {
  Toolbar: (props) => {
    const tools = useTools();
    const isGeoGebraSelected = useIsToolSelected(tools["geogebra"]);
    return (
      <DefaultToolbar {...props}>
        <DefaultToolbarContent />
        <TldrawUiMenuItem
          {...tools["geogebra"]}
          isSelected={isGeoGebraSelected}
        />
      </DefaultToolbar>
    );
  },
};

// Custom asset URLs for icons
const customAssetUrls: TLUiAssetUrlOverrides = {
  icons: {
    "geogebra-icon": "/geogebra-icon.svg",
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
