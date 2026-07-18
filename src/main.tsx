import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReactLenis } from "lenis/react";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/i18n.tsx";
import { KeyDisplayProvider } from "./contexts/keyDisplay.tsx";
import { PreviewAppearanceProvider } from "./contexts/previewAppearance.tsx";
import { ThemeProvider } from "./contexts/theme.tsx";
import { ToastProvider } from "./contexts/toast.tsx";
import { getSupportStatus } from "./browserSupport.ts";
import "lenis/dist/lenis.css";
import "./index.css";

// Honour the OS "reduce motion" setting: disable Lenis's wheel inertia so those
// users get plain native scrolling (matching the prefers-reduced-motion rule in
// index.css). Read once at boot — a page reload picks up any later change.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const support = getSupportStatus();
if (support !== "supported") {
  window.location.replace(`/unsupported.html?reason=${support}`);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ReactLenis root options={{ smoothWheel: !reduceMotion }}>
        <ThemeProvider>
          <I18nProvider>
            <KeyDisplayProvider>
              <PreviewAppearanceProvider>
                <ToastProvider>
                  <App />
                </ToastProvider>
              </PreviewAppearanceProvider>
            </KeyDisplayProvider>
          </I18nProvider>
        </ThemeProvider>
      </ReactLenis>
    </StrictMode>,
  );
}
