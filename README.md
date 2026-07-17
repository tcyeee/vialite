# Vialite

**English** · [简体中文](README.zh-CN.md)

A native web configurator for [Vial](https://get.vial.today/)-protocol keyboards, talking to the keyboard directly over [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API) — no Qt, no WebAssembly, no driver install.

This is a from-scratch web frontend, not a build wrapper around the official `vial-gui`/`vial-web` (which compiles a PyQt5 desktop app to WebAssembly). The Vial HID protocol itself is reimplemented in TypeScript under `src/protocol/`, ported from [`vial-gui`](https://github.com/vial-kb/vial-gui)'s Python implementation.

## Features
    
- **Keymap editing** — assign keycodes per layer with a searchable picker, a full physical-layout renderer (including ISO-Enter and encoders), layout-options support, and a 3D keyboard preview.
- **Dual-role & tap-hold keys** — dedicated editor for layer-tap / mod-tap and other dual-role keycodes.
- **Macros** — record and edit macro sequences (gated on device support).
- **Tap dance** — configure single/double-tap and hold/tap-hold actions.
- **Combos** — define multi-key combos with preview cards and reordering.
- **Per-key / lighting color** — keyboard color configuration.
- **QMK advanced settings** — grave-escape, magic, one-shot, tap-hold, mouse-keys, and combo timing, with a scroll-synced table of contents.
- **Matrix tester** — unlock-and-poll matrix diagnostics (gated on device support).
- **Import / export** — `.vil` layout files, round-tripped through the reimplemented serializer.
- **Bilingual UI** — hand-rolled zh/en dictionary with persisted language choice, plus light/dark theming. Keycap labels stay in English to match `vial-gui`.

Feature panels that depend on device capabilities (macros, tap dance, combos, matrix tester) are shown as unavailable when the connected keyboard doesn't support them.

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

- `src/protocol/` — the framework-agnostic Vial/VIA HID protocol reimplementation (transport, keyboard client, keycode tables, KLE parser, `.vil` serialization, macros).
- `src/components/` — React UI, organized one directory per concern (`keymap`, `layout`, `macro`, `tapdance`, `combo`, `color`, `qmk`, `matrix`, `io`, `connect`, `shell`, `site`, `common`).
- `src/contexts/` — React contexts for i18n, theming, key-display and preview-appearance settings, and toasts.
- `src/App.tsx` — top-level state and wiring (no external state library).

## License

Vialite is licensed under the [GNU General Public License v2.0](LICENSE) (GPL-2.0).

The protocol layer under `src/protocol/` is ported from [`vial-gui`](https://github.com/vial-kb/vial-gui), the official Vial desktop client, which is © the Vial contributors and licensed under GPL-2.0. As a derivative work, Vialite carries the same license. Thanks to the [Vial](https://get.vial.today/) project for the protocol design, the reference implementation, and the keyboard-side firmware that make this configurator possible.
