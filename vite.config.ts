import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const PARTICIPANT_DIR = fileURLToPath(new URL("./public/participant", import.meta.url));
const PARTICIPANTS_ID = "virtual:participants";
const RESOLVED_PARTICIPANTS_ID = `\0${PARTICIPANTS_ID}`;

/**
 * Exposes the image filenames under `public/participant/` — the avatars of
 * everyone who sent feedback — as `virtual:participants`, for the 网站设置
 * thanks marquee. The basename is the person's nickname, so the list is
 * maintained purely by dropping an image in that folder; no code edit needed.
 *
 * A virtual module rather than `import.meta.glob` because these live in
 * `public/`, which Vite copies verbatim and refuses to let JS import. In dev
 * the folder is watched and the module invalidated on add/remove, so a newly
 * dropped avatar shows up without restarting the dev server.
 */
function participantsPlugin(): Plugin {
  const read = () => {
    try {
      return readdirSync(PARTICIPANT_DIR)
        .filter((name) => /\.(png|jpe?g|webp|gif|avif)$/i.test(name))
        .sort((a, b) => a.localeCompare(b));
    } catch {
      return [];
    }
  };

  return {
    name: "vialite-participants",
    resolveId: (id) => (id === PARTICIPANTS_ID ? RESOLVED_PARTICIPANTS_ID : undefined),
    load: (id) =>
      id === RESOLVED_PARTICIPANTS_ID ? `export default ${JSON.stringify(read())};` : undefined,
    configureServer(server) {
      server.watcher.add(PARTICIPANT_DIR);
      const refresh = (file: string) => {
        if (!file.startsWith(PARTICIPANT_DIR)) return;
        const mod = server.moduleGraph.getModuleById(RESOLVED_PARTICIPANTS_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        // Full reload, not HMR: the list is read at module-eval time, and the
        // avatar itself is served straight from public/ (not part of the graph).
        server.hot.send({ type: "full-reload" });
      };
      server.watcher.on("add", refresh);
      server.watcher.on("unlink", refresh);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), participantsPlugin()],
  define: {
    // Build timestamp, surfaced in the connect-screen diagnostics panel so a
    // user reporting a problem can tell us which build they're on. ISO string,
    // frozen at build time (dev server bakes in the moment it (re)starts).
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
});
