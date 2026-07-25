import {
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import type { KeycodeDef } from "../../protocol/keycodes.ts";
import { useSettledLive } from "../common/useSettledLive.ts";
import { KeycapFace } from "./KeycapFace.tsx";
import { KeycodeCascadeSelector } from "./KeycodeCascadeSelector.tsx";
import { KeyboardCaseOutline, useCaseShape } from "./KeyboardCaseLayer.tsx";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

/** Right-click assign target — one cap, or one encoder rotation direction. */
export type PreviewContextTarget =
  | { kind: "key"; row: number; col: number }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

/**
 * Display size (显示尺寸) is a pure *visual* zoom: the board is always laid out
 * at {@link BASE_UNIT} px per KLE unit and then scaled as a whole via a CSS
 * transform ({@link KeyboardZoom}). Nothing is re-measured or re-rendered at a
 * different size, so labels, icons, borders, shadows, case thickness and corner
 * radii all grow and shrink together — which is what this setting is for. The
 * factors match the px-per-unit sizes the board renders at (32/44/56/68/82); `l`
 * is the natural 1× (BASE_UNIT) size.
 */
export type PreviewSize = "xs" | "s" | "m" | "l" | "xl";
export const BASE_UNIT = 68;
export const PREVIEW_ZOOM: Record<PreviewSize, number> = {
  xs: 32 / BASE_UNIT,
  s: 44 / BASE_UNIT,
  m: 56 / BASE_UNIT,
  l: 1,
  xl: 82 / BASE_UNIT,
};

/**
 * Key spacing (按键间距) as a 4-level setting. The gap isn't an absolute px
 * value — each level is a fraction of one keycap's width, so it stays
 * proportional however the cap ratios are tuned.
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
 * Case corner radius (外壳圆角) as a 4-level setting, in px at 1×. Unlike spacing
 * it's an absolute px value rather than a ratio; the visual zoom scales it along
 * with everything else.
 */
export const CASE_RADIUS_PX: Record<SpacingLevel, number> = { s: 4, m: 10, l: 18, xl: 28 };

/**
 * Keycap corner radius (键帽圆角) as a 3-level setting, in px at 1×, applied via
 * the `--key-radius` CSS var consumed by `.keyboard-layout .key` in index.css.
 * Only s/m/l are offered (no `xl`) — unlike the 4-level knobs above, rounder
 * than `l` starts looking like a pill rather than a keycap.
 */
export type KeycapRadiusLevel = "s" | "m" | "l";
export const KEYCAP_RADIUS_LEVELS: KeycapRadiusLevel[] = ["s", "m", "l"];
export const KEYCAP_RADIUS_PX: Record<KeycapRadiusLevel, number> = { s: 2, m: 4, l: 8 };

/**
 * Keycap label font size (字体大小) as a 4-level setting: a multiplier applied to
 * the label/icon size via the `--key-font-scale` CSS var, so `m` = 1× is the
 * baseline and the others scale the on-cap text without touching cap geometry.
 *
 * Independent of {@link PreviewSize}: display size is a whole-board "photo" zoom
 * (see {@link KeyboardZoom}) that scales labels along with everything else, so it
 * has nothing to do with this label-relative-to-cap knob. They were once the same
 * type only because both happened to be 4-level s→xl ladders; the display-size
 * ladder now also has an `xs` for auto-fit, which must not leak into font size.
 */
export type FontSize = "s" | "m" | "l" | "xl";
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

/**
 * Board rendering style (立体感/风格), 4 states: `wireframe` (线稿 — outline only,
 * no fill), `default` (flat fill, no shading), `relief` (浮雕 — highlight/shadow
 * 3D shading, what the old `depth` boolean's `true` meant), and `3d` (未实现 —
 * reserved for a future true-3D render; renders identically to `default` until
 * then). Only `default`/`relief` are reachable today, via the 立体感 toggle on
 * the 键盘配色 page (`KeyboardColorPanel`); `wireframe`/`3d` are wired through the
 * rendering pipeline but have no UI entry point yet.
 */
export type PreviewStyle = "wireframe" | "default" | "relief" | "3d";
export const PREVIEW_STYLES: PreviewStyle[] = ["wireframe", "default", "relief", "3d"];
export const DEFAULT_PREVIEW_STYLE: PreviewStyle = "relief";

/** Defaults for the tunable case/plate appearance. */
export const DEFAULT_KEY_SPACING: SpacingLevel = "s";
export const DEFAULT_FONT_SIZE: FontSize = "m";
export const DEFAULT_FONT_COLOR = "#1a1a1a";
export const DEFAULT_FONT_POSITION: FontPosition = "center";
export const DEFAULT_KEYCAP_WIDTH: SpacingLevel = "xl";
export const DEFAULT_CASE_RADIUS: SpacingLevel = "l";
export const DEFAULT_KEYCAP_RADIUS: KeycapRadiusLevel = "m";
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
  /** Keycap corner radius level (键帽圆角). */
  keycapRadius?: KeycapRadiusLevel;
  /** Case bezel thickness in px around the plate (外壳厚度). */
  caseThickness?: number;
  /** Case (外壳) fill color. */
  caseColor?: string;
  /** Plate (定位板) fill color the keys sit on. */
  plateColor?: string;
  /** Whether each keycap draws a thin outline (键帽边框). Default off. */
  keycapBorder?: boolean;
  /** Board rendering style (立体感/风格) — see {@link PreviewStyle}. */
  style?: PreviewStyle;
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

/** Derived px geometry for the appearance settings, at 1× (pre-zoom). */
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
  /** Visual zoom factor for the finished board — see {@link KeyboardZoom}. */
  zoom: number;
}

/**
 * Resolves the appearance knobs into the concrete px metrics both
 * {@link KeyboardLayoutPreview} and the interactive KeyboardLayoutEditor render from,
 * so the two boards stay pixel-identical in geometry. Keycap width sets the cap
 * size, key spacing sets the (constant) gap, and the pitch is their sum — so each
 * knob is independent.
 *
 * These are always the 1× metrics: display size doesn't enter the layout math at
 * all, it only comes back out as `zoom` for the caller's {@link KeyboardZoom}.
 */
export function appearanceMetrics(
  size: PreviewSize,
  spacing: SpacingLevel,
  keycapWidth: SpacingLevel,
  caseRadius: SpacingLevel,
  caseThickness: number,
): AppearanceMetrics {
  const cap = BASE_UNIT * CAP_RATIOS[keycapWidth];
  const inset = BASE_UNIT * SPACING_RATIOS[spacing];
  const PITCH = cap + inset;
  // Concentric corners: the plate's inner radius is the case's outer radius less
  // the bezel thickness, so the two arcs stay parallel. Clamp at 5 — once the
  // bezel is thicker than the outer radius the inner corner is essentially square.
  const outerRadius = CASE_RADIUS_PX[caseRadius];
  const innerRadius = Math.max(5, outerRadius - caseThickness + 5);
  return {
    PITCH,
    inset,
    outerRadius,
    innerRadius,
    showCase: caseThickness > 0,
    zoom: PREVIEW_ZOOM[size],
  };
}

/**
 * Scales a finished board (case + plate + caps) as a single visual unit.
 *
 * A CSS transform doesn't affect layout, so the wrapper is given the scaled box
 * explicitly — `width`/`height` are the board's natural size times the zoom —
 * and the inner element is scaled from its top-left corner to fill exactly that
 * box. Surrounding content therefore flows around the board at its apparent
 * size, with no gap or overlap.
 *
 * Anything using viewport coordinates (the hover card, the right-click cascade)
 * must stay *outside* this wrapper: a transformed ancestor becomes the
 * containing block for `position: fixed` descendants, which would both offset
 * and scale them.
 *
 * The wrapper is rendered even at 1×, so switching display size only animates
 * the two inline values (`.keyboard-zoom` transitions them in index.css) instead
 * of mounting/unmounting nodes mid-transition.
 */
export function KeyboardZoom({
  zoom,
  width,
  height,
  live = false,
  children,
}: {
  zoom: number;
  /** Natural (1×) outer width of the board, in px. */
  width: number;
  /** Natural (1×) outer height of the board, in px. */
  height: number;
  /**
   * True while auto-fit is driving the zoom, which changes it continuously as
   * the container resizes. Drops the size transition so the board tracks the
   * window exactly instead of easing toward each intermediate width.
   */
  live?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={"keyboard-zoom" + (live ? " keyboard-zoom-live" : "")}
      style={{ width: width * zoom, height: height * zoom }}
    >
      <div style={{ width, height, transform: `scale(${zoom})`, transformOrigin: "top left" }}>
        {children}
      </div>
    </div>
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
  zoomOverride,
  onContextAssign,
  ...overrides
}: {
  keyboard: Keyboard;
  size?: PreviewSize;
  layer?: number;
  /**
   * Opt-in right-click assign, the same cascade the interactive board on the
   * 键盘布局 page offers. Absent (the default) keeps this a pure display board:
   * caps stay `pointer-events: none` and no menu is wired up.
   */
  onContextAssign?: (target: PreviewContextTarget, qmkId: string) => void;
  /**
   * Continuous zoom from auto-fit (`useAutoFitZoom`), which wins over the
   * discrete 预览区域缩放 level. `null`/absent means auto-fit is off or hasn't
   * measured yet, so the configured level applies. Named explicitly (not part of
   * the `overrides` rest) so it never reaches {@link appearanceMetrics}.
   */
  zoomOverride?: number | null;
} & PreviewAppearance) {
  const appearance = usePreviewAppearance();
  // Context supplies every value; an explicitly-passed prop overrides just that
  // one field (rest capture omits props the caller didn't pass, so `undefined`
  // can't clobber a context value).
  const {
    size,
    spacing,
    keycapWidth,
    caseRadius,
    keycapRadius,
    caseThickness,
    caseColor,
    plateColor,
    keycapBorder,
    style,
    fontSize,
    fontColor,
    fontPosition,
  } = { ...appearance, ...overrides };
  // `3d` has no distinct render yet — falls back to `default` (flat, no shading).
  const depth = style === "relief";
  const wireframe = style === "wireframe";
  // 部分按键使用图标重置且取消换行 (mediaReset) off: caps fall back to full text
  // labels (see KeycapFace), so nowrap+ellipsis would just truncate them —
  // let them wrap instead, see `.keyboard-layout-wrap-labels` in index.css.
  const { mediaReset } = useKeyDisplay();
  const {
    PITCH,
    inset,
    outerRadius,
    innerRadius,
    showCase,
    zoom: sizeZoom,
  } = appearanceMetrics(size, spacing, keycapWidth, caseRadius, caseThickness);
  const zoom = zoomOverride ?? sizeZoom;
  const zoomLive = useSettledLive(zoomOverride != null);
  const posClass = fontPositionClass(fontPosition);

  // Right-click assign: the cascade selector anchored at the click point. It
  // dismisses itself (outside click / Escape / after a pick), so there's no
  // separate close listener here. Mirrors KeyboardLayoutEditor's menu.
  //
  // The open menu doubles as the selection state, driving the same
  // `.selected` / `keyboard-layout-has-selection` styling the interactive board
  // uses. Unlike that board the highlight is deliberately *ephemeral* — it
  // clears when the cascade closes — because this preview is also the node
  // rasterized for the 保存图片 export, and a lingering highlight (plus the
  // dimming of every other cap) would be baked into the saved PNG.
  const [menu, setMenu] = useState<
    { x: number; y: number; target: PreviewContextTarget } | null
  >(null);
  const openMenu = (e: ReactMouseEvent, target: PreviewContextTarget) => {
    if (!onContextAssign) {
      return;
    }
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, target });
  };

  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    [keyboard, keyboard.layoutOptions],
  );
  const plateWidth = placed.width * PITCH + inset;
  const plateHeight = placed.height * PITCH + inset;
  // Split/rotated layouts get per-cluster SVG outlines instead of the rectangle
  // the divs below draw; `null` means the layout is plain and the divs are right.
  const caseShape = useCaseShape({ placed, PITCH, inset, caseThickness, showCase });

  const board = (
    <div
      className={
        "keyboard-case" +
        (showCase && depth && !caseShape ? " keyboard-case-shaded" : "")
      }
      style={{
        padding: caseThickness,
        background: showCase && !caseShape && !wireframe ? caseColor : "transparent",
        border: showCase && !caseShape && wireframe ? `1.5px solid ${caseColor}` : undefined,
        borderRadius: showCase && !caseShape ? outerRadius : 0,
        width: "fit-content",
      }}
    >
      {caseShape && (
        <KeyboardCaseOutline
          shape={caseShape}
          caseColor={caseColor}
          plateColor={plateColor}
          depth={depth}
          wireframe={wireframe}
        />
      )}
      <div
        className={
          "keyboard-layout" +
          (depth ? " keyboard-layout-shaded" : "") +
          (caseShape ? " keyboard-layout-outlined" : "") +
          (keycapBorder ? " keyboard-layout-bordered" : "") +
          (wireframe ? " keyboard-layout-wireframe" : "") +
          (menu ? " keyboard-layout-has-selection" : "") +
          (mediaReset ? "" : " keyboard-layout-wrap-labels")
        }
        style={{
          width: plateWidth,
          height: plateHeight,
          background: caseShape || wireframe ? "transparent" : plateColor,
          border: !caseShape && wireframe ? `1.5px solid ${plateColor}` : undefined,
          borderRadius: caseShape ? 0 : innerRadius,
          // Display-only by default; the caps only need to receive events when
          // there's a right-click menu to open.
          pointerEvents: onContextAssign ? undefined : "none",
          // Cascades to `.key`/`.key-icon` (both `color: inherit`) so labels and
          // mdi icons pick up the chosen 字体颜色.
          color: fontColor,
          "--key-font-scale": FONT_SCALES[fontSize],
          "--key-radius": `${KEYCAP_RADIUS_PX[keycapRadius]}px`,
        } as CSSProperties}
      >
        {placed.keys
          .filter(({ key }) => !key.decal)
          .map(({ key, shiftX, shiftY }) => {
            const qmkId = keyboard.getKey(layer, key.row, key.col);
            const isSelected =
              menu?.target.kind === "key" &&
              menu.target.row === key.row &&
              menu.target.col === key.col;
            return (
              <div
                key={`${key.row},${key.col}@${key.x},${key.y}`}
                className={(isSelected ? "key selected" : "key") + posClass}
                onContextMenu={(e) => openMenu(e, { kind: "key", row: key.row, col: key.col })}
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
                <KeycapFace qmkId={qmkId} />
              </div>
            );
          })}
        {placed.encoders.map(({ encoder, shiftX, shiftY }) => {
          const isSelected =
            menu?.target.kind === "encoder" &&
            menu.target.index === encoder.index &&
            menu.target.direction === encoder.direction;
          return (
            <div
              key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
              className={isSelected ? "encoder selected" : "encoder"}
              onContextMenu={(e) =>
                openMenu(e, {
                  kind: "encoder",
                  index: encoder.index,
                  direction: encoder.direction,
                })
              }
              style={shapeStyle(encoder, shiftX, shiftY, PITCH, inset, inset)}
            >
              <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  // The cascade is positioned in viewport coordinates, so it stays outside
  // <KeyboardZoom> — a transformed ancestor would become its containing block
  // and scale it along with the board.
  return (
    <>
      <KeyboardZoom
        zoom={zoom}
        live={zoomLive}
        width={plateWidth + caseThickness * 2}
        height={plateHeight + caseThickness * 2}
      >
        {board}
      </KeyboardZoom>
      {menu && onContextAssign && (
        // Suppress the browser's native menu for right-clicks inside the cascade
        // popover; the cascade handles its own dismissal (outside-click/Escape).
        <div onContextMenu={(e) => e.preventDefault()}>
          <KeycodeCascadeSelector
            anchor={{ x: menu.x, y: menu.y }}
            keyboard={keyboard}
            value={
              menu.target.kind === "key"
                ? keyboard.getKey(layer, menu.target.row, menu.target.col)
                : keyboard.getEncoder(layer, menu.target.index, menu.target.direction)
            }
            onPick={(entry: KeycodeDef) => {
              onContextAssign(menu.target, entry.qmkId);
              setMenu(null);
            }}
            onClose={() => setMenu(null)}
          />
        </div>
      )}
    </>
  );
}
