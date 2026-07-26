// Registers the offline mdi subset (mdiIcons.data.ts) with Iconify once, at module
// load. Imported for its side effect from main.tsx before the first render, so every
// <Icon icon="mdi:…" /> across the app resolves synchronously and offline — no
// request to the Iconify API, which matters for a tool meant to run against a
// keyboard with no network.
//
// To add an icon: use it as <Icon icon="mdi:<name>" /> anywhere, then re-run
// `node scripts/genIcons.mjs` to fold it into the offline subset.
import { addCollection } from "@iconify/react";
import { MDI_ICONS } from "./mdiIcons.data.ts";

addCollection(MDI_ICONS);
