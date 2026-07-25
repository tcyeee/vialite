import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { I18nProvider } from "./src/contexts/i18n.tsx";
import { KeyDisplayProvider } from "./src/contexts/keyDisplay.tsx";
import { PreviewAppearanceProvider } from "./src/contexts/previewAppearance.tsx";
import { ThemeProvider } from "./src/contexts/theme.tsx";
import { NewHomePage } from "./src/components/shell/NewHomePage.tsx";
import { Keyboard, type PhysicalKey } from "./src/protocol/keyboard.ts";
import "./src/index.css";

const kb = new Keyboard({} as never);
kb.rows = 4;
kb.cols = 12;
kb.layers = 1;
const keys: PhysicalKey[] = [];
for (let row = 0; row < kb.rows; row++) {
  for (let col = 0; col < kb.cols; col++) {
    keys.push({
      row,
      col,
      x: col,
      y: row,
      width: 1,
      height: 1,
      rotationAngle: 0,
      rotationX: 0,
      rotationY: 0,
      layoutIndex: -1,
      layoutOption: 0,
      x2: 0,
      y2: 0,
      width2: 0,
      height2: 0,
      decal: false,
    });
  }
}
kb.keys = keys;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <KeyDisplayProvider>
          <PreviewAppearanceProvider>
            <NewHomePage
              keyboard={kb}
              layer={0}
              productName="Test Board"
              onDisconnect={() => {}}
              onNavigate={() => {}}
              onPersonalize={() => {}}
            />
          </PreviewAppearanceProvider>
        </KeyDisplayProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
