import { Icon } from "@iconify/react";
import { useMemo, type CSSProperties } from "react";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { layerSwitchInfo } from "../../protocol/keycodes.ts";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { KeycapFace } from "./KeycapFace.tsx";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

/** Cap size in px per KLE unit, keyed by the display-size setting. */
export type PreviewSize = "s" | "m" | "l" | "xl";
export const PREVIEW_UNITS: Record<PreviewSize, number> = { s: 56, m: 68, l: 82, xl: 98 };

/**
 * Key spacing (按键间距) as a 4-level setting. The gap isn't an absolute px
 * value — each level is a fraction of one keycap's width, so the spacing (and
 * therefore the whole board's size) scales with the display size too.
 */
export type SpacingLevel = "s" | "m" | "l" | "xl";
export const SPACING_LEVELS: SpacingLevel[] = ["s", "m", "l", "xl"];
export const SPACING_RATIOS: Record<SpacingLevel, number> = { s: 0.05, m: 0.09, l: 0.13, xl: 0.18 };

/**
 * Keycap width (键帽宽度) as a 4-level setting: the fraction of one pitch cell
 * the cap fills. Independent of spacing — a narrower cap reveals more plate
 * between keys without moving them, so the board size stays put. `xl` = 1.0
 * means the cap fills the whole cell (gap comes purely from spacing).
 */
export const CAP_RATIOS: Record<SpacingLevel, number> = { s: 0.8, m: 0.87, l: 0.93, xl: 1.0 };

/**
 * Case corner radius (外壳圆角) as a 4-level setting, in px. Unlike spacing it's
 * an absolute px value — the bezel radius doesn't scale with the display size.
 */
export const CASE_RADIUS_PX: Record<SpacingLevel, number> = { s: 4, m: 10, l: 18, xl: 28 };

/**
 * Keycap label font size (字体大小) as a 4-level setting: a multiplier applied to
 * the label/icon size via the `--key-font-scale` CSS var, so `m` = 1× is the
 * baseline and the others scale the on-cap text without touching cap geometry.
 */
export type FontSize = PreviewSize;
export const FONT_SIZES: FontSize[] = ["s", "m", "l", "xl"];
export const FONT_SCALES: Record<FontSize, number> = { s: 0.8, m: 1, l: 1.25, xl: 1.5 };

/**
 * Keycap label position (字体位置) within the cap face: top-left corner, centered
 * (default), or bottom-center. Maps to a `key-pos-*` modifier class on each key
 * ({@link fontPositionClass}); `center` needs no class (it's the default flex
 * alignment).
 */
export type FontPosition = "top-left" | "center" | "center-bottom";
export const FONT_POSITIONS: FontPosition[] = ["top-left", "center", "center-bottom"];

/** Modifier class for a label position; empty for the default `center`. */
export function fontPositionClass(pos: FontPosition): string {
  return pos === "center" ? "" : ` key-pos-${pos}`;
}

/** Defaults for the tunable case/plate appearance. */
export const DEFAULT_KEY_SPACING: SpacingLevel = "s";
export const DEFAULT_FONT_SIZE: FontSize = "m";
export const DEFAULT_FONT_COLOR = "#1a1a1a";
export const DEFAULT_FONT_POSITION: FontPosition = "center";
export const DEFAULT_KEYCAP_WIDTH: SpacingLevel = "xl";
export const DEFAULT_CASE_RADIUS: SpacingLevel = "m";
export const DEFAULT_CASE_THICKNESS = 15;
export const DEFAULT_CASE_COLOR = "#b0b0b0";
export const DEFAULT_PLATE_COLOR = "#8a8a8a";

export interface PreviewAppearance {
  /** Key spacing level (按键间距); sets the pitch, so it scales the whole board. */
  spacing?: SpacingLevel;
  /** Keycap width level (键帽宽度); fraction of a pitch cell the cap fills. */
  keycapWidth?: SpacingLevel;
  /** Case corner radius level (外壳圆角). */
  caseRadius?: SpacingLevel;
  /** Case bezel thickness in px around the plate (外壳厚度). */
  caseThickness?: number;
  /** Case (外壳) fill color. */
  caseColor?: string;
  /** Plate (定位板) fill color the keys sit on. */
  plateColor?: string;
  /** Whether each keycap draws a thin outline (键帽边框). Default off. */
  keycapBorder?: boolean;
  /** Whether to draw the highlight/shadow 3D shading (立体感). Default on. */
  depth?: boolean;
  /** Keycap label font size level (字体大小). */
  fontSize?: FontSize;
  /** Keycap label text/icon color (字体颜色). */
  fontColor?: string;
  /** Keycap label position within the cap face (字体位置). */
  fontPosition?: FontPosition;
}

/**
 * `PITCH` is the per-unit advance (one pitch cell); positions and sizes both
 * scale by it and each keycap is then inset by `inset` (the gap between adjacent
 * caps = `PITCH - cap`). A 1u cap is therefore always `PITCH - inset = cap` wide,
 * decoupled from position: spacing grows the pitch (board), keycap width shrinks
 * the cap within its cell — neither disturbs the other.
 *
 * `pad` offsets every shape by a fixed px amount (one `inset`) on both axes so
 * the plate shows an even spacing-wide margin on all four sides — without it the
 * top/left keys sit flush against the plate edge while only the bottom/right
 * keys leave their inter-key gap.
 */
export function shapeStyle(
  s: { x: number; y: number; width: number; height: number; rotationAngle: number; rotationX: number; rotationY: number },
  shiftX: number,
  shiftY: number,
  PITCH: number,
  inset: number,
  pad: number,
): CSSProperties {
  const style: CSSProperties = {
    left: (s.x + shiftX) * PITCH + pad,
    top: (s.y + shiftY) * PITCH + pad,
    width: s.width * PITCH - inset,
    height: s.height * PITCH - inset,
  };
  if (s.rotationAngle) {
    style.transform = `rotate(${s.rotationAngle}deg)`;
    style.transformOrigin = `${(s.rotationX - s.x) * PITCH}px ${(s.rotationY - s.y) * PITCH}px`;
  }
  return style;
}

/** Derived px geometry for a given display size + appearance settings. */
export interface AppearanceMetrics {
  /** Per-unit advance (one pitch cell), in px. */
  PITCH: number;
  /** Gap between adjacent caps, in px (also the plate margin). */
  inset: number;
  /** Case outer corner radius, in px. */
  outerRadius: number;
  /** Plate inner corner radius, kept concentric with the case, in px. */
  innerRadius: number;
  /** Whether the case bezel is drawn at all (thickness > 0). */
  showCase: boolean;
}

/**
 * Resolves the display size + appearance knobs into the concrete px metrics both
 * {@link KeyboardLayoutPreview} and the interactive KeyboardLayout render from,
 * so the two boards stay pixel-identical in geometry. Keycap width sets the cap
 * size, key spacing sets the (constant) gap, and the pitch is their sum — so each
 * knob is independent; display size (UNIT) zooms everything uniformly.
 */
export function appearanceMetrics(
  size: PreviewSize,
  spacing: SpacingLevel,
  keycapWidth: SpacingLevel,
  caseRadius: SpacingLevel,
  caseThickness: number,
): AppearanceMetrics {
  const UNIT = PREVIEW_UNITS[size];
  const cap = UNIT * CAP_RATIOS[keycapWidth];
  const inset = UNIT * SPACING_RATIOS[spacing];
  const PITCH = cap + inset;
  // Concentric corners: the plate's inner radius is the case's outer radius less
  // the bezel thickness, so the two arcs stay parallel. Clamp at 5 — once the
  // bezel is thicker than the outer radius the inner corner is essentially square.
  const outerRadius = CASE_RADIUS_PX[caseRadius];
  const innerRadius = Math.max(5, outerRadius - caseThickness + 5);
  return { PITCH, inset, outerRadius, innerRadius, showCase: caseThickness > 0 };
}

/**
 * Cap face for a pure layer-switch key (MO/TG/TT/OSL/TO/DF/PDF): the stacked-
 * layers glyph — the same icon the 快捷配置 layer-switch cards use — with the
 * target layer number badged on it, in place of the raw "MO(2)" text. Layer-Tap
 * caps are left to {@link KeycapFace}'s dual-role split (they carry a tap key).
 */
function LayerKeycapFace({ layer }: { layer: number }) {
  return (
    <span className="key-layer-face">
      <Icon icon="mdi:layers" className="key-icon" aria-hidden="true" />
      <span className="key-layer-num">{layer}</span>
    </span>
  );
}

/**
 * Read-only rendering of the connected board's physical layout — same geometry
 * pipeline as {@link KeyboardLayout}, but non-interactive (`pointer-events:none`)
 * and captioned with the given layer's labels so the board is recognizable. Used
 * by the 键盘配色 section as a display-only preview; no per-key action wired up yet.
 *
 * `layer` selects which layer's keycaps to caption (default 0); the 键盘配色 page
 * wraps this in layer tabs so the whole board's labels switch per layer.
 *
 * Every appearance knob defaults to the shared {@link usePreviewAppearance}
 * context, so any call site — `<KeyboardLayoutPreview keyboard={kb} />` — renders
 * pixel-identically to the 键盘配色 page without re-plumbing props. Pass an
 * explicit prop only to deliberately override a single field for one preview.
 */
export function KeyboardLayoutPreview({
  keyboard,
  layer = 0,
  ...overrides
}: { keyboard: Keyboard; size?: PreviewSize; layer?: number } & PreviewAppearance) {
  const appearance = usePreviewAppearance();
  // Context supplies every value; an explicitly-passed prop overrides just that
  // one field (rest capture omits props the caller didn't pass, so `undefined`
  // can't clobber a context value).
  const {
    size,
    spacing,
    keycapWidth,
    caseRadius,
    caseThickness,
    caseColor,
    plateColor,
    keycapBorder,
    depth,
    fontSize,
    fontColor,
    fontPosition,
  } = { ...appearance, ...overrides };
  const { PITCH, inset, outerRadius, innerRadius, showCase } = appearanceMetrics(
    size,
    spacing,
    keycapWidth,
    caseRadius,
    caseThickness,
  );
  const posClass = fontPositionClass(fontPosition);
  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    [keyboard, keyboard.layoutOptions],
  );

  return (
    <div
      className={"keyboard-case" + (showCase && depth ? " keyboard-case-shaded" : "")}
      style={{
        padding: caseThickness,
        background: showCase ? caseColor : "transparent",
        borderRadius: showCase ? outerRadius : 0,
        width: "fit-content",
      }}
    >
      <div
        className={
          "keyboard-layout" +
          (depth ? " keyboard-layout-shaded" : "") +
          (keycapBorder ? " keyboard-layout-bordered" : "")
        }
        style={{
          width: placed.width * PITCH + inset,
          height: placed.height * PITCH + inset,
          background: plateColor,
          borderRadius: innerRadius,
          pointerEvents: "none",
          // Cascades to `.key`/`.key-icon` (both `color: inherit`) so labels and
          // mdi icons pick up the chosen 字体颜色.
          color: fontColor,
          "--key-font-scale": FONT_SCALES[fontSize],
        } as CSSProperties}
      >
        {placed.keys
          .filter(({ key }) => !key.decal)
          .map(({ key, shiftX, shiftY }) => {
            const qmkId = keyboard.getKey(layer, key.row, key.col);
            const layerSwitch = layerSwitchInfo(qmkId);
            return (
              <div
                key={`${key.row},${key.col}@${key.x},${key.y}`}
                className={"key" + posClass}
                style={shapeStyle(key, shiftX, shiftY, PITCH, inset, inset)}
              >
                {hasSecondRect(key) && (
                  <span
                    className="key-part2"
                    style={{
                      left: key.x2 * PITCH,
                      top: key.y2 * PITCH,
                      width: key.width2 * PITCH - inset,
                      height: key.height2 * PITCH - inset,
                    }}
                  />
                )}
                {layerSwitch ? <LayerKeycapFace layer={layerSwitch.layer} /> : <KeycapFace qmkId={qmkId} />}
              </div>
            );
          })}
        {placed.encoders.map(({ encoder, shiftX, shiftY }) => (
          <div
            key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
            className="encoder"
            style={shapeStyle(encoder, shiftX, shiftY, PITCH, inset, inset)}
          >
            <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
