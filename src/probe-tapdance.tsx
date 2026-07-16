import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { TapDancePanel } from "./components/TapDancePanel.tsx";
import { I18nProvider } from "./i18n.tsx";
import { ThemeProvider } from "./theme.tsx";
import { ToastProvider } from "./toast.tsx";
import type { Keyboard, TapDanceEntry } from "./protocol/keyboard.ts";
import "./index.css";

function makeMockKeyboard(): Keyboard {
  const entries: TapDanceEntry[] = [
    { onTap: "KC_A", onHold: "KC_LSFT", onDoubleTap: "KC_B", onTapHold: "KC_LCTL", tappingTerm: 200 },
    { onTap: "KC_C", onHold: "KC_NO", onDoubleTap: "KC_NO", onTapHold: "KC_NO", tappingTerm: 175 },
    { onTap: "KC_NO", onHold: "KC_NO", onDoubleTap: "KC_NO", onTapHold: "KC_NO", tappingTerm: 200 },
  ];
  const mock = {
    tapDanceCount: entries.length,
    tapDanceEntries: entries,
    setTapDance: async (idx: number, entry: TapDanceEntry) => {
      entries[idx] = entry;
    },
  };
  return mock as unknown as Keyboard;
}

function Harness() {
  const [, setTick] = useState(0);
  const keyboard = useState(() => makeMockKeyboard())[0];
  return <TapDancePanel keyboard={keyboard} onChange={() => setTick((t) => t + 1)} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <div className="p-8">
            <Harness />
          </div>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
