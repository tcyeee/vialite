import { Icon } from "@iconify/react";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { dualRole, holdInfo, label as kcLabel } from "../../protocol/keycodes.ts";
import { capIconName } from "./keycapIcons.ts";

/**
 * Left/right modifier keys that get a small side badge (Ⓛ / Ⓡ) prepended to the
 * face. The badge distinguishes the left vs right variant — especially in macOS
 * mode where both sides collapse to the same symbol (⌘/⌃/⌥/⇧) — and stands in for
 * the L/R prefix, which is then stripped from the text label to avoid "L LCtrl".
 */
const KEY_SIDE: Record<string, "L" | "R"> = {
  KC_LCTRL: "L",
  KC_LSHIFT: "L",
  KC_LALT: "L",
  KC_LGUI: "L",
  KC_RCTRL: "R",
  KC_RSHIFT: "R",
  KC_RALT: "R",
  KC_RGUI: "R",
};

/**
 * Side badge: the boxed L/R Material Design Icon, sized a notch below the cap font
 * (see `.key-side-badge` in index.css). The glyph uses `currentColor`, so it tracks
 * the cap font color like the labels and other icons do.
 */
function SideBadge({ side }: { side: "L" | "R" }) {
  return (
    <Icon
      className="key-side-badge"
      icon={side === "L" ? "mdi:alpha-l-box-outline" : "mdi:alpha-r-box-outline"}
      aria-label={side === "L" ? "Left" : "Right"}
    />
  );
}

/** Basic modifier keycode for one flag of a Mod-Tap hold, given the hold's side. */
const HOLD_MOD_BASIC: Record<"ctrl" | "shift" | "alt" | "gui", { L: string; R: string }> = {
  ctrl: { L: "KC_LCTRL", R: "KC_RCTRL" },
  shift: { L: "KC_LSHIFT", R: "KC_RSHIFT" },
  alt: { L: "KC_LALT", R: "KC_RALT" },
  gui: { L: "KC_LGUI", R: "KC_RGUI" },
};

/**
 * The lower (hold) band of a dual-role cap. A Mod-Tap hold renders its modifier(s)
 * the same way a plain modifier cap does — one {@link SideBadge} for the shared
 * left/right side, then each modifier's OS-style glyph (so a macOS `RGui` hold
 * shows Ⓡ + ⌘ instead of the text "RGui"), following the 系统修饰键 setting via
 * {@link capIconName}. Layer-Tap holds (and any non-mod hold) keep the plain short
 * label supplied in `fallback` (e.g. "L2").
 */
function HoldFace({ qmkId, fallback }: { qmkId: string; fallback: string }) {
  const { keyDisplay } = useKeyDisplay();
  const info = holdInfo(qmkId);
  if (!info || info.type !== "mod") {
    return <>{fallback}</>;
  }

  const active = (["ctrl", "shift", "alt", "gui"] as const).filter((m) => info[m]);
  return (
    <span className="key-hold-mods">
      <SideBadge side={info.side} />
      {active.map((m) => {
        const kc = HOLD_MOD_BASIC[m][info.side];
        const icon = capIconName(kc, keyDisplay);
        return icon ? (
          <Icon key={m} className="key-icon key-icon-symbol" icon={icon} aria-label={kcLabel(kc)} />
        ) : (
          // No OS glyph (e.g. Ctrl/Alt in windows mode) — fall back to the text
          // label with its redundant leading L/R stripped (the badge shows side).
          <span key={m} className="key-hold-text">
            {kcLabel(kc).slice(1)}
          </span>
        );
      })}
    </span>
  );
}

/**
 * The face of one keycap: a Material Design Icon when {@link capIconName} maps
 * the keycode (letters, modifiers, nav/whitespace keys), otherwise the plain
 * text label. Modifier glyphs follow the 系统修饰键 (keyDisplay) OS style, which
 * is read from context here so call sites don't have to thread it through.
 *
 * Shared by every keycap surface — the interactive {@link KeyboardLayout}, the
 * 键盘配色 {@link KeyboardLayoutPreview}, and the tap-dance / combo / quick-config
 * slots — so a keycode added to {@link capIconName} lights up in all of them at
 * once. `className` styles the text span (default `key-label`); the icon path
 * uses `key-icon key-icon-symbol` for the modifier/nav symbols (scaled down) so
 * they match the text labels in size. Left/right keys in {@link KEY_SIDE}
 * additionally get a {@link SideBadge} prepended.
 *
 * Dual-role tap/hold keys (Mod-Tap, Layer-Tap — see {@link dualRole}) split the
 * face in two: the tap action renders normally on the upper part, and the hold
 * action sits in a shaded band across the bottom. The tap half reuses this same
 * component, so its own icon/text/side-badge logic applies unchanged.
 */
export function KeycapFace({ qmkId, className = "key-label" }: { qmkId: string; className?: string }) {
  const { keyDisplay } = useKeyDisplay();

  const dual = dualRole(qmkId);
  if (dual) {
    return (
      <span className="key-dual">
        <span className="key-dual-tap">
          <KeycapFace qmkId={dual.tap} className={className} />
        </span>
        <span className="key-dual-hold">
          <HoldFace qmkId={qmkId} fallback={dual.hold} />
        </span>
      </span>
    );
  }

  // Macro caps (M0…M15) show the macro icon followed by the slot number rather
  // than the bare "M0" text, matching the macro panel's tabs and 3D keycap.
  const macro = /^M(\d+)$/.exec(qmkId);
  if (macro) {
    return (
      <span className="key-face-badged">
        <Icon className="key-icon key-icon-symbol" icon="mdi:script-text-outline" aria-label={kcLabel(qmkId)} />
        <span className={className}>{macro[1]}</span>
      </span>
    );
  }

  const side = KEY_SIDE[qmkId];
  const icon = capIconName(qmkId, keyDisplay);

  let face;
  if (icon) {
    // Modifier/nav symbols (⌘ ⇧ ⌥ ⌃ ↵ ⌫ ⎵ arrows…) read larger than the plain text
    // labels, so scale them down 20% via key-icon-symbol to keep the two keycap
    // face types visually consistent in size.
    face = <Icon className="key-icon key-icon-symbol" icon={icon} aria-label={kcLabel(qmkId)} />;
  } else {
    // With a side badge the leading L/R in the label (e.g. "LCtrl") is redundant.
    const text = side ? kcLabel(qmkId).slice(1) : kcLabel(qmkId);
    face = <span className={className}>{text}</span>;
  }

  if (side) {
    return (
      <span className="key-face-badged">
        <SideBadge side={side} />
        {face}
      </span>
    );
  }
  return face;
}
