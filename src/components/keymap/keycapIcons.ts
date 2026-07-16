// Maps keycaps to Material Design Icons (mdi, via Iconify) for the preview board.
// Modifier keys render as the `apple-keyboard-*` / `microsoft-windows` glyphs;
// anything without a mapping (letters included) falls back to its plain text label.
//
// The icon data is an offline subset (keycapIcons.data.ts) so no network / no
// 2.9 MB full mdi bundle is needed. To regenerate that subset after changing the
// icon list, re-run the extraction script kept in the git history of this file's
// introduction (reads @iconify-json/mdi, resolves aliases, writes the .ts).

import { addCollection } from "@iconify/react";
import type { KeyDisplay } from "../../contexts/keyDisplay.tsx";
import { MDI_KEYCAP_ICONS } from "./keycapIcons.data.ts";

// Register the offline subset once at module load so <Icon icon="mdi:…" /> resolves
// synchronously without hitting the Iconify API.
addCollection(MDI_KEYCAP_ICONS);

/**
 * mdi icon name for a keycap, or `null` when the key has no icon and should fall
 * back to an 8-bit text label.
 *
 * Modifier styling follows the 系统修饰键 (keyDisplay) setting:
 * - GUI → ⌘ (macOS) / ⊞ Windows logo (windows).
 * - Ctrl/Alt → ⌃ / ⌥ only in macOS mode; in windows mode they use text
 *   ("Ctrl"/"Alt"), matching how those caps are actually engraved on a PC board.
 * - Shift (⇧) and Caps (⇪) use their glyph in both modes — the symbols are
 *   cross-platform.
 */
export function capIconName(qmkId: string, keyDisplay: KeyDisplay): string | null {
  const mac = keyDisplay === "macos";
  switch (qmkId) {
    case "KC_LGUI":
    case "KC_RGUI":
      return mac ? "mdi:apple-keyboard-command" : "mdi:microsoft-windows";
    case "KC_LSHIFT":
    case "KC_RSHIFT":
      return "mdi:apple-keyboard-shift";
    case "KC_CAPSLOCK":
      return "mdi:apple-keyboard-caps";
    case "KC_LCTRL":
    case "KC_RCTRL":
      return mac ? "mdi:apple-keyboard-control" : null;
    case "KC_LALT":
    case "KC_RALT":
      return mac ? "mdi:apple-keyboard-option" : null;
    case "KC_ENTER":
      return "mdi:keyboard-return";
    case "KC_BSPACE":
      return "mdi:keyboard-backspace";
    case "KC_ESCAPE":
      return "mdi:keyboard-esc";
    case "KC_SPACE":
      return "mdi:keyboard-space";
    case "KC_TAB":
      return "mdi:keyboard-tab";
    case "KC_UP":
      return "mdi:keyboard-arrow-up";
    case "KC_DOWN":
      return "mdi:keyboard-arrow-down";
    case "KC_LEFT":
      return "mdi:keyboard-arrow-left";
    case "KC_RIGHT":
      return "mdi:keyboard-arrow-right";
    default:
      return null;
  }
}
