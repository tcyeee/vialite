import { Icon } from "@iconify/react";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { dualRole, label as kcLabel } from "../../protocol/keycodes.ts";
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
 * Hand-drawn side badge: a white L or R centered on a solid black circle, sized a
 * notch below the cap font (see `.key-side-badge` in index.css).
 */
function SideBadge({ side }: { side: "L" | "R" }) {
  return (
    <svg className="key-side-badge" viewBox="0 0 16 16" role="img" aria-label={side === "L" ? "Left" : "Right"}>
      <circle cx="8" cy="8" r="8" />
      <text x="8" y="8.5" textAnchor="middle" dominantBaseline="central">
        {side}
      </text>
    </svg>
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
        <span className="key-dual-hold">{dual.hold}</span>
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
