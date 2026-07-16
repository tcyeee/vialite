import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./contexts/i18n.tsx";
import { KeyDisplayProvider } from "./contexts/keyDisplay.tsx";
import { ThemeProvider } from "./contexts/theme.tsx";
import { ToastProvider } from "./contexts/toast.tsx";
import { getSupportStatus } from "./browserSupport.ts";
import "./index.css";

const support = getSupportStatus();
if (support !== "supported") {
  window.location.replace(`/unsupported.html?reason=${support}`);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ThemeProvider>
        <I18nProvider>
          <KeyDisplayProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </KeyDisplayProvider>
        </I18nProvider>
      </ThemeProvider>
    </StrictMode>,
  );
}
