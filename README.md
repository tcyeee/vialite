# Vialite

**English** · [简体中文](README.zh-CN.md)

<video src="https://github.com/tcyeee/vialite/raw/main/public/1.mp4" controls muted loop playsinline width="100%"></video>

> If the video doesn't play in your Markdown viewer, watch it [here](https://github.com/tcyeee/vialite/raw/main/public/1.mp4).

A native web configurator for [Vial](https://get.vial.today/)-protocol keyboards, talking to the keyboard directly over [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API) — no Qt, no WebAssembly, no driver install.

This is a from-scratch web frontend, not a build wrapper around the official `vial-gui`/`vial-web` (which compiles a PyQt5 desktop app to WebAssembly). The Vial HID protocol itself is reimplemented in TypeScript under `src/protocol/`, ported from [`vial-gui`](https://github.com/vial-kb/vial-gui)'s Python implementation.

## Features

Each item below is one page in the app's sidebar, in the order they appear:

| Page | What it does |
| --- | --- |
| **Keyboard Config** | The main keymap editor — assign keycodes per layer with a cascading picker and a quick-config panel, on a full physical-layout renderer (ISO-Enter, rotary encoders, layout options). Includes a dedicated editor for dual-role keys (layer-tap / mod-tap). |
| **Personalization** | Appearance of the on-screen keyboard: keycap size and spacing, auto-fit, case radius and thickness, legend font / size / color / position, macOS vs Windows key naming — plus one-click PNG export of the current layer or every layer. |
| **Macros** | Record and edit macro sequences. *(Requires device support.)* |
| **Tap Dance** | Configure single-tap / double-tap and hold / tap-hold actions. *(Requires device support.)* |
| **Combos** | Define multi-key combos with preview cards and reordering. *(Requires device support.)* |
| **RGB Lighting** *(Beta)* | VialRGB (QMK `rgb_matrix`) control: effect, hue/saturation/brightness and speed. Changes are RAM-only until you hit Save, which commits them to EEPROM. |
| **Import / Export** | Read and write `.vil` layout files through the reimplemented serializer. |
| **Keyboard Test** | Unlock-and-poll matrix diagnostics for checking every switch. *(Requires device support.)* |
| **QMK Settings** | Grave-escape, magic, one-shot, tap-hold, mouse-keys and combo timing, with a table of contents in the sidebar that stays in sync with page scroll. |
| **3D Preview** *(Beta)* | Renders your current layout on a 3D keyboard model. |
| **Website Settings** | Language (中文 / English), light / dark theme, debug logging, and a cache reset. Preferences persist to `localStorage`. |

Pages that depend on device capabilities (Macros, Tap Dance, Combos, Keyboard Test) appear greyed out when the connected keyboard doesn't support them. RGB Lighting stays reachable on every board and explains in-page when the firmware has no VialRGB lighting.

The UI is fully bilingual (hand-rolled zh/en dictionary, no i18n library); keycap legends stay in English to match `vial-gui`.

## Requirements

- Chrome or Edge (WebHID is not supported in Safari or Firefox — see [caniuse.com/webhid](https://caniuse.com/webhid))
- Node.js
- [pnpm](https://pnpm.io/)

## Development

```
pnpm install         # install dependencies
pnpm dev             # start the Vite dev server
pnpm build           # tsc -b (typecheck) + vite build
pnpm test            # run the test suite (vitest)
pnpm preview         # preview a production build
```

Open the printed localhost URL in Chrome/Edge, click Connect, and pick your Vial keyboard from the device chooser.

`pnpm build`'s `tsc -b` (strict mode) is the primary correctness gate; there's no separate lint step. CI runs `pnpm build` then `pnpm test` on push/PR to `main`.

## Project layout

- `src/protocol/` — the framework-agnostic Vial/VIA HID protocol reimplementation (transport, keyboard client, keycode tables, KLE parser, `.vil` serialization, macros). `keycodes.ts` holds the raw keycode tables (`KEYCODE_CATEGORIES`, `label()`).
- `src/components/keymap/keycodeMeta.ts` — the single source of truth for keycode **UI metadata**: the category/sub-group hierarchy (`BASIC_GROUPS`, `LAYER_GROUPS`, `QUANTUM_GROUPS`, …), category/group/per-key description keys (`CATEGORY_KEYS`, `CATEGORY_DESC`, `CLEAR_LABELS`, `KEYCODE_HELP`), and the connected device's live categories (`deviceCategories()`). Every view that shows a key, its label, its description, or a category heading reads from here (with description text resolved through `src/contexts/i18n.tsx`) — never from a table inlined in a component.
- `src/components/` — React UI, organized one directory per concern (`keymap`, `layout`, `macro`, `tapdance`, `combo`, `color`, `qmk`, `matrix`, `io`, `connect`, `shell`, `site`, `common`).
- `src/contexts/` — React contexts for i18n, theming, key-display and preview-appearance settings, and toasts.
- `src/App.tsx` — top-level state and wiring (no external state library).

## License

Vialite is licensed under the [GNU General Public License v2.0](LICENSE) (GPL-2.0).

The protocol layer under `src/protocol/` is ported from [`vial-gui`](https://github.com/vial-kb/vial-gui), the official Vial desktop client, which is © the Vial contributors and licensed under GPL-2.0. As a derivative work, Vialite carries the same license. Thanks to the [Vial](https://get.vial.today/) project for the protocol design, the reference implementation, and the keyboard-side firmware that make this configurator possible.
