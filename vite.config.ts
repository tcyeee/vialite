import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    // Build timestamp, surfaced in the connect-screen diagnostics panel so a
    // user reporting a problem can tell us which build they're on. ISO string,
    // frozen at build time (dev server bakes in the moment it (re)starts).
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
