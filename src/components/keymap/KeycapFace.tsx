import { Icon } from "@iconify/react";
import type { CSSProperties } from "react";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { dualRole, holdInfo, keyBehavior, label as kcLabel, layerSwitchInfo } from "../../protocol/keycodes.ts";
import { type CapIcon, capIcon, LAYER_ICON, MACRO_ICON, sideBadgeIcon, TAPDANCE_ICON } from "./keycapIcons.ts";

/**
 * Renders one glyph from the keycap-icon table ({@link keycapIcons.ts}): its mdi
 * name at its own size. Every icon substitution on a cap goes through here, so the
 * per-icon `scale` — carried to CSS as the `--cap-icon-scale` var — is the single
 * knob for a glyph's size. `className` picks the CSS box (`key-icon` for normal cap
 * glyphs, `key-side-badge` for the boxed L/R badge).
 *
 * Exported so the preview's layer-switch face can render its glyph the same way.
 */
export function CapGlyph({
  spec,
  label,
  className = "key-icon",
}: {
  spec: CapIcon;
  label?: string;
  className?: string;
}) {
  return (
    <Icon
      className={className}
      icon={spec.icon}
      style={spec.scale != null ? ({ "--cap-icon-scale": spec.scale } as CSSProperties) : undefined}
      aria-label={label}
      aria-hidden={label == null || undefined}
    />
  );
}

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
 * Side badge: the boxed L/R glyph (its icon + size come from {@link sideBadgeIcon}),
 * sized a notch below the cap font (see `.key-side-badge` in index.css). The glyph
 * uses `currentColor`, so it tracks the cap font color like the labels and icons do.
 */
function SideBadge({ side }: { side: "L" | "R" }) {
  return (
    <CapGlyph spec={sideBadgeIcon(side)} className="key-side-badge" label={side === "L" ? "Left" : "Right"} />
  );
}

/**
 * Cap face for a layer key: the stacked-layers glyph ({@link LAYER_ICON}) followed
 * by the target layer number, in place of the raw "MO(2)" / "L2" text. Used both for
 * pure layer-switch caps (MO/TG/TT/OSL/TO/DF/PDF) and for the hold band of a
 * Layer-Tap dual-role cap, so a layer reads the same everywhere.
 */
function LayerFace({ layer }: { layer: number }) {
  return (
    <span className="key-face-badged key-layer-face">
      <CapGlyph spec={LAYER_ICON} />
      <span className="key-layer-num">{layer}</span>
    </span>
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
 * {@link capIcon}. A Layer-Tap hold shows the {@link LayerFace} (layers icon + layer
 * number). Any other hold keeps the plain short label supplied in `fallback`.
 */
function HoldFace({ qmkId, fallback }: { qmkId: string; fallback: string }) {
  const { keyDisplay } = useKeyDisplay();
  const info = holdInfo(qmkId);
  if (!info) {
    return <>{fallback}</>;
  }
  if (info.type === "layer") {
    return <LayerFace layer={info.layer} />;
  }

  const active = (["ctrl", "shift", "alt", "gui"] as const).filter((m) => info[m]);
  return (
    <span className="key-hold-mods">
      <SideBadge side={info.side} />
      {active.map((m) => {
        const kc = HOLD_MOD_BASIC[m][info.side];
        const spec = capIcon(kc, keyDisplay);
        return spec ? (
          <CapGlyph key={m} spec={spec} label={kcLabel(kc)} />
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
 * The face of one keycap: a Material Design Icon when {@link capIcon} maps the
 * keycode (letters, modifiers, nav/whitespace keys), otherwise the plain text
 * label. Which glyph and how big it renders both come from the keycap-icon table
 * ({@link keycapIcons.ts}); modifier glyphs follow the 系统修饰键 (keyDisplay) OS
 * style, read from context here so call sites don't have to thread it through.
 *
 * Shared by every keycap surface — the interactive {@link KeyboardLayout}, the
 * 键盘配色 {@link KeyboardLayoutPreview}, and the tap-dance / combo / quick-config
 * slots — so a keycode added to the table lights up in all of them at once.
 * `className` styles the text span (default `key-label`); glyphs render via
 * {@link CapGlyph}. Left/right keys in {@link KEY_SIDE} additionally get a
 * {@link SideBadge} prepended.
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
    // A masked modifier (modCombo, e.g. HYPR(kc)/LSFT(kc)) fires its modifier
    // *together with* the tap on a single press — it is not a genuine long-press
    // hold like Mod-Tap/Layer-Tap. Mark its hold band so CSS draws a dashed border,
    // distinguishing the fire-together (短按) case from a real hold (长按).
    const isCombo = keyBehavior(qmkId).kind === "modCombo";
    return (
      <span className="key-dual">
        <span className="key-dual-tap">
          <KeycapFace qmkId={dual.tap} className={className} />
        </span>
        <span className={isCombo ? "key-dual-hold key-dual-hold-combo" : "key-dual-hold"}>
          <HoldFace qmkId={qmkId} fallback={dual.hold} />
        </span>
      </span>
    );
  }

  // Pure layer-switch caps (MO/TG/…) show the layers icon + target layer number
  // rather than the raw "MO(2)" text (Layer-Tap is dual-role, handled above).
  const layerSwitch = layerSwitchInfo(qmkId);
  if (layerSwitch) {
    return <LayerFace layer={layerSwitch.layer} />;
  }

  // Macro caps (M0…M15) show the macro icon followed by the slot number rather
  // than the bare "M0" text, matching the macro panel's tabs and 3D keycap.
  const macro = /^M(\d+)$/.exec(qmkId);
  if (macro) {
    return (
      <span className="key-face-badged key-macro-face">
        <CapGlyph spec={MACRO_ICON} label={kcLabel(qmkId)} />
        <span className={className}>{macro[1]}</span>
      </span>
    );
  }

  // Tap-dance caps (TD(0)…TD(n)) show the gesture icon followed by the slot number
  // rather than the bare "TD0" text, matching the macro caps' icon+number treatment.
  const tapDance = /^TD\((\d+)\)$/.exec(qmkId);
  if (tapDance) {
    return (
      <span className="key-face-badged key-tapdance-face">
        <CapGlyph spec={TAPDANCE_ICON} label={kcLabel(qmkId)} />
        <span className={className}>{tapDance[1]}</span>
      </span>
    );
  }

  const side = KEY_SIDE[qmkId];
  const icon = capIcon(qmkId, keyDisplay);

  let face;
  if (icon) {
    face = <CapGlyph spec={icon} label={kcLabel(qmkId)} />;
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
