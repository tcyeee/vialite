import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { isBrowserSupported } from "./browserSupport.ts";
import "./index.css";

if (!isBrowserSupported()) {
  window.location.replace("/unsupported.html");
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
