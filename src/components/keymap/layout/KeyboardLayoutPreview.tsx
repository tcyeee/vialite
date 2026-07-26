import {
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { usePreviewAppearance } from "../../../contexts/previewAppearance.tsx";
import { useKeyDisplay } from "../../../contexts/keyDisplay.tsx";
import { useTheme } from "../../../contexts/theme.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { useSettledLive } from "../../common/useSettledLive.ts";
import { KeycapFace } from "./KeycapFace.tsx";
import { KeycodeCascadeSelector } from "../picker/KeycodeCascadeSelector.tsx";
import { KeyboardCaseOutline, useCaseShape } from "./KeyboardCaseLayer.tsx";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";
import {
  appearanceMetrics,
  fontPositionClass,
  FONT_SCALES,
  KeyboardZoom,
  KEYCAP_RADIUS_PX,
  paintCursor,
  shapeStyle,
  WIREFRAME_DARK_COLOR,
  type PaintTool,
  type PreviewAppearance,
  type PreviewContextTarget,
  type PreviewSize,
} from "./appearance.tsx";

// Every appearance type/constant/helper (PreviewSize, SpacingLevel, FONT_SIZES,
// appearanceMetrics, KeyboardZoom, ...) used to live in this file; it's now
// `./appearance.tsx`, re-exported here so the several other files that import
// them from "KeyboardLayoutPreview.tsx" (KeyboardLayoutEditor, StyleConfig,
// MatrixTester, KeyboardColorPanel, NewHomePage, the previewAppearance context,
// autoFitSize) don't need their import paths touched.
export * from "./appearance.tsx";

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
  paint,
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
  /**
   * Opt-in 键帽上色 paint mode: while set, left-clicking a key calls `onPaint`
   * instead of just being display-only, and the cap shows a colored brush
   * cursor (or eraser cursor) via {@link paintCursor}. Only
   * `KeyboardColorPanel`'s 颜色管理区 flow passes this; every other call site
   * leaves it unset and stays a plain display/right-click-assign board.
   */
  paint?: PaintTool;
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
    wireframeLineColor,
    keycapBorder,
    style,
    fontSize,
    fontColor,
    fontPosition,
  } = { ...appearance, ...overrides };
  const { keycapPalette, keycapColors } = appearance;
  // Resolves each key's painted color (键帽上色) from the shared palette — see
  // previewAppearance.tsx. A key with no entry in `keycapColors`, or whose id
  // no longer exists in the palette (deleted), falls back to the default cap
  // background from index.css.
  const keycapHexById = useMemo(
    () => Object.fromEntries(keycapPalette.map((c) => [c.id, c.hex])),
    [keycapPalette],
  );
  // `3d` has no distinct render yet — falls back to `default` (flat, no shading).
  const depth = style === "relief";
  const wireframe = style === "wireframe";
  // 部分按键使用图标重置且取消换行 (mediaReset) off: caps fall back to full text
  // labels (see KeycapFace), so nowrap+ellipsis would just truncate them —
  // let them wrap instead, see `.keyboard-layout-wrap-labels` in index.css.
  const { mediaReset } = useKeyDisplay();
  const { theme } = useTheme();
  const wireframeDark = wireframe && theme === "dark";
  const fontColorFinal = wireframeDark ? WIREFRAME_DARK_COLOR : fontColor;
  const wireframeLineColorFinal = wireframeDark ? WIREFRAME_DARK_COLOR : wireframeLineColor;
  // Case border / plate outline also draw in wireframe style (see the `border`/
  // `boxShadow` below and KeyboardCaseOutline's stroke) — without this they'd
  // stay in whatever caseColor/plateColor was configured, invisible against a
  // dark background, while only the key borders and labels turned white.
  const caseColorFinal = wireframeDark ? WIREFRAME_DARK_COLOR : caseColor;
  const plateColorFinal = wireframeDark ? WIREFRAME_DARK_COLOR : plateColor;
  const {
    PITCH,
    inset,
    plateMargin,
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
  // The outermost cap's own edge already sits `plateMargin - inset` in from
  // the pitch-cell boundary (shapeStyle's `pad` shifts it out by `plateMargin`,
  // then its own `width`/`height` shrinks back in by `inset`) — so reaching
  // `plateMargin` past that cap takes `2 * plateMargin - inset`, not
  // `plateMargin` alone. Reduces to the familiar `+ inset` when
  // `plateMargin === inset` (see `PLATE_MARGIN_RATIO`).
  const plateWidth = placed.width * PITCH + 2 * plateMargin - inset;
  const plateHeight = placed.height * PITCH + 2 * plateMargin - inset;
  // Split/rotated layouts get per-cluster SVG outlines instead of the rectangle
  // the divs below draw; `null` means the layout is plain and the divs are right.
  const caseShape = useCaseShape({ placed, PITCH, plateMargin, caseThickness, showCase });

  const board = (
    <div
      className={
        "keyboard-case" +
        (showCase && depth && !caseShape ? " keyboard-case-shaded" : "")
      }
      style={{
        padding: caseThickness,
        background: showCase && !caseShape && !wireframe ? caseColorFinal : "transparent",
        border: showCase && !caseShape && wireframe ? `1.5px solid ${caseColorFinal}` : undefined,
        borderRadius: showCase && !caseShape ? outerRadius : 0,
        width: "fit-content",
      }}
    >
      {caseShape && (
        <KeyboardCaseOutline
          shape={caseShape}
          caseColor={caseColorFinal}
          plateColor={plateColorFinal}
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
          background: caseShape || wireframe ? "transparent" : plateColorFinal,
          // `box-shadow` instead of `border` — see the identical comment in
          // KeyboardLayoutEditor.tsx: a real border on this padding:0 container
          // shifts every absolutely-positioned `.key`/`.encoder` child inward by
          // the border width (they anchor to the padding box, not the border
          // box), compressing the right/bottom margin and inflating the
          // left/top one. An inset shadow paints the same outline without
          // touching the box model.
          boxShadow: !caseShape && wireframe ? `inset 0 0 0 1.5px ${plateColorFinal}` : undefined,
          borderRadius: caseShape ? 0 : innerRadius,
          // Display-only by default; the caps only need to receive events when
          // there's a right-click menu to open, or 键帽上色 paint mode is active.
          pointerEvents: onContextAssign || paint ? undefined : "none",
          // Cascades to `.key`/`.key-icon` (both `color: inherit`) so labels and
          // mdi icons pick up the chosen 字体颜色.
          color: fontColorFinal,
          "--key-font-scale": FONT_SCALES[fontSize],
          "--key-radius": `${KEYCAP_RADIUS_PX[keycapRadius]}px`,
          "--wireframe-line-color": wireframeLineColorFinal,
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
            const paintedHex = keycapHexById[keycapColors[`${key.row},${key.col}`]];
            return (
              <div
                key={`${key.row},${key.col}@${key.x},${key.y}`}
                className={(isSelected ? "key selected" : "key") + posClass}
                onContextMenu={(e) => openMenu(e, { kind: "key", row: key.row, col: key.col })}
                onClick={paint ? () => paint.onPaint(key.row, key.col) : undefined}
                style={{
                  ...shapeStyle(key, shiftX, shiftY, PITCH, inset, plateMargin),
                  background: paintedHex,
                  cursor: paint ? paintCursor(paint.tool) : undefined,
                }}
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
              style={shapeStyle(encoder, shiftX, shiftY, PITCH, inset, plateMargin)}
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
