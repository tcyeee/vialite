/// <reference types="vite/client" />

// Injected by Vite's `define` (see vite.config.ts): ISO build timestamp.
declare const __BUILD_TIME__: string;

// Served by the `vialite-participants` plugin (see vite.config.ts): the image
// filenames under `public/participant/`, e.g. ["Howe.jpg", ...]. The basename
// is the person's nickname.
declare module "virtual:participants" {
  const files: string[];
  export default files;
}
