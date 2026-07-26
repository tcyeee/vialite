# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Vialite is a from-scratch native web configurator for [Vial](https://get.vial.today/)-protocol
keyboards. It talks to the keyboard directly over WebHID (Chrome/Edge only — Safari/Firefox don't
support WebHID) with no Qt, no WebAssembly, no driver install.

This is **not** a wrapper or fork of the official `vial-web`/`vial-gui` — `vial-web` actually
cross-compiles the `vial-gui` Python/PyQt5 desktop app to WebAssembly and renders Qt widgets onto a
canvas, so it wasn't reusable as an HTML/JS base. Instead, the Vial HID protocol itself is
reimplemented in TypeScript under `src/protocol/`, ported line-by-line from `vial-gui`'s Python
implementation (`keyboard_comm.py`, `constants.py`, `keycodes*.py`). See `README.md` for the
license rationale (GPL-2.0, inherited as a derivative of `vial-gui`).

When porting or extending protocol behavior, treat `vial-gui`'s Python source as the spec — code
comments in `src/protocol/` cite the specific upstream file/function each piece mirrors, and
deviations are called out explicitly in comments (e.g. why `.vil` export omits the `macro` field,
why matrix-tester exit re-locks the keyboard unlike upstream).

## Commands

```
pnpm install         # install deps (pnpm is required, see packageManager in package.json)
pnpm dev             # start Vite dev server
pnpm build           # tsc -b (project references) + vite build — run this to typecheck
pnpm test            # vitest run (single run, not watch mode)
pnpm preview         # preview a production build
```

Run a single test file: `pnpm vitest run src/protocol/keycodes.test.ts`.

There is no separate lint script; `pnpm build`'s `tsc -b` (strict mode, `noUnusedLocals`,
`noUnusedParameters`) is the primary correctness gate. CI (`.github/workflows/ci.yml`) runs
`pnpm build` then `pnpm test` on push/PR to `main`.

Deploy (`.github/workflows/deploy.yml`) triggers on push to the `prod` branch: builds, then rsyncs
`dist/` to the production host and sends a WeChat notification via Server酱. Pushing to `prod` is a
real deploy — don't do it without being asked.

## Architecture

**`src/protocol/`** — the reimplemented Vial/VIA HID protocol, framework-agnostic (no React).
- `constants.ts` — VIA/Vial command bytes and protocol version thresholds, ported from
  `vial-gui`'s `constants.py`.
- `transport.ts` (`HidTransport`) — raw WebHID plumbing: report ID 0, 32-byte messages
  (`MSG_LEN`), serialized send/receive with sequence-number tracking so a late/dropped reply can't
  desync subsequent commands, retry-with-timeout mirroring `vial-gui`'s `hid_send`.
- `keyboard.ts` (`Keyboard`) — the main protocol client. `reload()` fetches the device's
  `vial.json` definition (transferred in 28-byte chunks, xz-compressed, decompressed via
  `xz-decompress`), keyboard matrix, per-layer keymap, encoder layout, and layout options. Exposes
  `setKey`/`setEncoder`/`setLayoutOptions` (write-through, only sends a command when the value
  actually changed), `saveLayout()`/`restoreLayout()` for `.vil` import/export, and the
  unlock/matrix-tester flow (`getUnlockStatus`, `unlockStart/Poll`, `lock`, `getMatrixState`).
- `keycodes.ts` — the keycode name↔value tables. **Version-sensitive**: Vial protocol < 6 uses v5
  keycode values, >= 6 uses v6 (QMK 0.19+ renumbered layer/mod-tap/quantum keycodes). Call
  `setKeycodeVersion()` once the device's `vialProtocol` is known (done inside
  `Keyboard.reloadLayout`) before (de)serializing any keycode.
- `kleSerial.ts` — parses the KLE (Keyboard Layout Editor) JSON format embedded in `vial.json`
  into physical key/encoder geometry (position, rotation, ISO-Enter secondary rectangles). Encoders
  are encoded as ordinary KLE keys where `labels[4] === "e"`; each rotation direction is its own
  KLE key with `labels[0] = "idx,direction"` (0 = CCW, 1 = CW).
- `vilFile.ts` — `.vil` file (de)serialization. Deliberately deviates from a byte-identical
  `vial-gui` export: omits the `macro` field entirely (an empty array would tell `vial-gui`'s
  importer to erase all macros — omission is the safe placeholder), and hand-parses `uid` as a
  `BigInt` since it can exceed `Number.MAX_SAFE_INTEGER`.

**`src/components/`** — React UI, one component per concern: `DeviceConnect`/
`WaitingForConnection` (connect/disconnect flow and browser-support messaging via
`browserSupport.ts`), `KeyboardLayout` (renders the physical layout from `layoutGeometry.ts` +
`keyEventMap.ts`), `KeycodePicker` (search/assign UI), `LayerTabs`, `LayoutOptions`,
`MatrixTester`/`UnlockDialog` (unlock-and-poll flow gated on `Keyboard.supportsMatrixTester`).

**`src/App.tsx`** owns all top-level state (connection status, active `Keyboard` instance, selected
key/encoder, current layer/mode) and wires components together; there's no external state library.
Two things worth knowing before touching it:
- `Keyboard` mutates its internal keymap in place, so a `forceUpdate` counter is bumped after any
  write to get React to re-render with the new label.
- Auto-reconnect on page load (via `navigator.hid.getDevices()`) and the manual Connect button are
  guarded against running concurrently by `connectInFlightRef` and a module-level
  `autoConnectStarted` flag (the latter specifically to survive React StrictMode's double-invoked
  mount effect).

**`src/i18n.tsx`** — a small hand-rolled zh/en dictionary + `t()` interpolator + React context, not
a full i18n library. Language choice persists to `localStorage` under `vialite-lang`. Keycap labels
themselves (Enter, LShift, ...) stay in English regardless of UI language, matching `vial-gui`.

## Known gaps / in-progress state

Not yet implemented: key overrides, alt-repeat key, and the two legacy VIA lighting backends
(`qmk_backlight` / `qmk_rgblight` — their command constants exist in `constants.ts` but are unused).
These are parsed-through/preserved in `.vil` files where applicable but have no UI.

RGB is implemented for VialRGB only (`vial.json`'s `lighting === "vialrgb"`, i.e. QMK `rgb_matrix`):
`Keyboard.reloadRgb` + `setRgb*`/`saveRgb` in `keyboard.ts`, the effect-id table in
`protocol/vialRgbEffects.ts` (must stay in sync with `vial-gui`'s `VIALRGB_EFFECTS`), and the
`RGB 配置 (Beta)` page in `components/rgb/RgbPanel.tsx`. Scope is what the protocol exposes: one
global effect + shared HSV/speed — Vial has no per-key color command. Writes are RAM-only until
`saveRgb()` (the Save button) commits them to EEPROM. Unlike every other reload step, a VialRGB
handshake failure is non-fatal: `reload()` catches it so the board still connects without the page.
