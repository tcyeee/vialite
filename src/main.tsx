import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ReactLenis } from "lenis/react";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/i18n.tsx";
import { KeyDisplayProvider } from "./contexts/keyDisplay.tsx";
import { PreviewAppearanceProvider } from "./contexts/previewAppearance.tsx";
import { ThemeProvider } from "./contexts/theme.tsx";
import { ToastProvider } from "./contexts/toast.tsx";
import "./mdiIcons.ts"; // registers the offline mdi subset before the first render
import "lenis/dist/lenis.css";
import "./index.css";

// Honour the OS "reduce motion" setting: disable Lenis's wheel inertia so those
// users get plain native scrolling (matching the prefers-reduced-motion rule in
// index.css). Read once at boot — a page reload picks up any later change.
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Browsers without WebHID (Firefox/Safari) still render the React app fine — it
// only the actual *device* calls that fail — so rather than bouncing them to a bare
// static page, we let the app mount and surface the "unsupported" prompt inline
// on the connect screen (see WaitingForConnection), themed and translated like
// the rest of the UI, with the debug-log toggle right there.
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
