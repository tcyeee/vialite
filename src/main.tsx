import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { I18nProvider } from "./i18n.tsx";
import { getSupportStatus } from "./browserSupport.ts";
import "./index.css";

const support = getSupportStatus();
if (support !== "supported") {
  window.location.replace(`/unsupported.html?reason=${support}`);
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <I18nProvider>
        <App />
      </I18nProvider>
    </StrictMode>,
  );
}
