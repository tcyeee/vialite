# Vialite

A native web configurator for [Vial](https://get.vial.today/)-protocol keyboards, talking to the keyboard directly over [WebHID](https://developer.mozilla.org/en-US/docs/Web/API/WebHID_API) — no Qt, no WebAssembly, no driver install.

This is a from-scratch web frontend, not a build wrapper around the official `vial-gui`/`vial-web` (which compiles a PyQt5 desktop app to WebAssembly). The Vial HID protocol itself is reimplemented in TypeScript under `src/protocol/`, ported from [`vial-gui`](https://github.com/vial-kb/vial-gui)'s Python implementation. See `note.md` for the background and rationale.

## Requirements

- Chrome or Edge (WebHID is not supported in Safari or Firefox — see [caniuse.com/webhid](https://caniuse.com/webhid))
- Node.js
- [pnpm](https://pnpm.io/)

## Development

```
pnpm install
pnpm dev
```

Open the printed localhost URL in Chrome/Edge, click Connect, and pick your Vial keyboard from the device chooser.
