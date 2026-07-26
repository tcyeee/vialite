# Incident log: 线稿模式外壳颜色改动导致界面变黑

**Date**: 2026-07-26
**Status**: Reverted. Root cause of the "entire interface turned black" report was not
confirmed before rollback — see "Open question" below.

## What was asked

1. In wireframe (线稿) preview style, the case (外壳) should show its configured color.
2. Dual-role (Mod-Tap/Layer-Tap) hold band: keep its border, but make the background
   transparent so the keycap's own color shows through.

## What was changed

- `src/components/keymap/layout/KeyboardLayoutPreview.tsx` — case div switched from
  "border-only in wireframe style" to "always solid-filled with `caseColorFinal`";
  removed the dark-theme override that forced `caseColorFinal` to `WIREFRAME_DARK_COLOR`.
- `src/components/keymap/layout/KeyboardLayoutEditor.tsx` — same two changes applied,
  since this is the component NewHomePage's hero strip actually renders (not Preview).
- `src/components/keymap/layout/KeyboardCaseLayer.tsx` (`KeyboardCaseOutline`, used for
  split/rotated layouts) — case SVG path switched from stroke-only-in-wireframe to
  always-solid-fill, to match the div rendering.
- `src/index.css` — `.keyboard-layout .key-dual-hold` given `background: transparent`
  (board-only; the off-board compact-stack rule elsewhere was left alone), and the
  now-redundant `background: transparent` on the wireframe-specific override removed.

## Verification that was done

- `pnpm build` (tsc -b + vite build) passed after every edit.
- A throwaway headless-Chromium session (Playwright, launched manually since this repo
  has no browser-test setup) was used to check the **light-theme** rendering of the
  Feature-preview demo board with `localStorage['vialite-color-style'] = 'wireframe'`.
  Confirmed `.keyboard-case`'s computed `background-color` was the configured
  `caseColor` (`rgb(176, 176, 176)`), i.e. the fix worked for `KeyboardLayoutPreview.tsx`
  in that one scenario.
- Dark theme and the actual NewHomePage hero (`KeyboardLayoutEditor.tsx` path) were
  **not** cleanly verified — an attempt to test dark theme via `localStorage` + reload
  collided with the user's own live-editing session (a real, separate `pnpm dev`
  instance actively changing files) and threw a transient
  `PreviewAppearanceProvider is not defined` HMR error unrelated to the change under
  test. That test browser/session was killed rather than investigated further.

## What went wrong

The user reported the case color still wasn't showing after the `KeyboardLayoutPreview`
fix. Screenshots (relief vs. wireframe state of the NewHomePage hero) showed the case
genuinely disappearing in wireframe style — confirming a real bug in
`KeyboardLayoutEditor.tsx`'s original border-only case rendering (the `.keyboard-case`
CSS comment even says "no border", suggesting that border was never actually working).
The same solid-fill fix was applied to `KeyboardLayoutEditor.tsx`.

Immediately after that second round of edits, the user reported the **entire app UI
turning solid black** — not just the keyboard case, the whole interface. This is a far
larger blast radius than any of the edited code paths (all scoped to `.keyboard-case`/
`.keyboard-layout` inside the keyboard board components) should have been able to cause.

**This was not root-caused before rollback.** Given the time pressure ("in case we're
heading further down the wrong path") the correct call was to revert immediately rather
than keep investigating live. Everything below is what should be checked before
retrying, not a confirmed diagnosis.

## Open question / what to check before retrying

- The user had their own `pnpm dev` instance running and actively editing files
  (`App.tsx`, `KeyboardColorPanel.tsx`, `MatrixTester.tsx`, `main.tsx`, `index.css`,
  and others) throughout this session, concurrently with these edits. A prior HMR
  crash (`PreviewAppearanceProvider is not defined`) was already observed once during
  this same session, from that concurrency, unrelated to the case-color code. The
  "entire interface black" report may be:
  - a further HMR/Vite dev-server desync from concurrent edits + file-watcher races
    (most likely, given the earlier crash), rather than something caused by the
    reverted code, or
  - a genuine consequence of the `caseColorFinal = colorOverride ?? caseColor` change
    in `KeyboardLayoutEditor.tsx` if `caseColor` (or `colorOverride`) can somehow
    resolve to something that, combined with `showCase`, paints far more than the
    `.keyboard-case` box — this was not verified and seems geometrically unlikely
    given `.keyboard-case` is a `width: fit-content` box, but has not been ruled out.
  - unrelated to any of these edits and caused by the user's own concurrent changes.
- Before reattempting: have the user hard-refresh / restart their dev server first, in
  isolation (no competing dev server instances, no concurrent edits mid-test), and
  reproduce the black screen from a clean state to see if it's still reproducible at
  all.
- If retrying the actual feature: re-apply the `KeyboardLayoutPreview.tsx` +
  `KeyboardLayoutEditor.tsx` + `KeyboardCaseLayer.tsx` changes one file at a time, with
  a full page reload and console-error check between each, rather than all three
  together.

## Current state

All four files (`KeyboardLayoutPreview.tsx`, `KeyboardLayoutEditor.tsx`,
`KeyboardCaseLayer.tsx`, `index.css`) reverted to their state from before this
conversation's edits. The user's own unrelated in-progress work in these and other
files (键帽上色/paint-mode feature, brand color token changes, etc.) was left intact —
verified via `git diff` on each touched file before and after revert, editing back only
the specific hunks this conversation introduced. `pnpm build` passes.
