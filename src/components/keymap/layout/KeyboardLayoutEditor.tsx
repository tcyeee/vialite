import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { dualRole, type KeycodeDef } from "../../../protocol/keycodes.ts";
import { useI18n } from "../../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../../contexts/previewAppearance.tsx";
import { useKeyDisplay } from "../../../contexts/keyDisplay.tsx";
import { useTheme } from "../../../contexts/theme.tsx";
import { KeycapFace } from "./KeycapFace.tsx";
import { KeycodeCascadeSelector } from "../picker/KeycodeCascadeSelector.tsx";
import { KeyInfoCard } from "../picker/KeyInfoCard.tsx";
import { useSettledLive } from "../../common/useSettledLive.ts";
import {
  appearanceMetrics,
  FONT_SCALES,
  fontPositionClass,
  KeyboardZoom,
  KEYCAP_RADIUS_PX,
  shapeStyle,
  WIREFRAME_DARK_COLOR,
  type PreviewStyle,
} from "./KeyboardLayoutPreview.tsx";
import { KeyboardCaseOutline, useCaseShape } from "./KeyboardCaseLayer.tsx";
import { hasSecondRect } from "./layoutGeometry.ts";
import { useKnobLayout } from "./knobGrouping.ts";

/** Which half of a dual-role (tap/hold) cap a click targets. */
export type KeyPart = "tap" | "hold";

type Selected =
  | { kind: "key"; row: number; col: number; part?: KeyPart }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

/** What a right-click context menu targets, mirroring the selection shape. */
type ContextTarget =
  | { kind: "key"; row: number; col: number }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

interface Props {
  keyboard: Keyboard;
  layer: number;
  selected?: Selected | null;
  onKeySelect: (row: number, col: number, part?: KeyPart) => void;
  onEncoderSelect: (index: number, direction: 0 | 1) => void;
  /** Right-click cascade pick: writes the chosen keycode to the target cap/encoder. */
  onContextAssign?: (target: ContextTarget, qmkId: string) => void;
  /**
   * Continuous zoom from auto-fit (`useAutoFitZoom`), which wins over the
   * discrete 预览区域缩放 level. `null`/absent means auto-fit is off or hasn't
   * measured yet, so the configured level applies.
   */
  zoomOverride?: number | null;
  /**
   * Overrides the shared 立体感/风格 (`PreviewStyle`) setting for just this board,
   * e.g. NewHomePage's decorative hero strip forcing 线稿 regardless of what the
   * user has configured on the 键盘配色 page. Absent (the default) reads `style`
   * from context like every other appearance knob.
   */
  styleOverride?: PreviewStyle;
  /**
   * Single color forcing case/plate/font (and, in wireframe, the per-cap/encoder
   * outline color that otherwise comes from the context's `wireframeLineColor`)
   * regardless of the user's 键盘配色 settings — same rationale as `styleOverride`,
   * for decorative boards like NewHomePage's hero strip. Absent reads colors from
   * context.
   */
  colorOverride?: string;
}

export function KeyboardLayoutEditor({
  keyboard,
  layer,
  selected,
  onKeySelect,
  onEncoderSelect,
  onContextAssign,
  zoomOverride,
  styleOverride,
  colorOverride,
}: Props) {
  const { t } = useI18n();
  // Physical appearance (size, spacing, case/plate) is shared with the 键盘配色
  // page via context, so tuning it there restyles this interactive board too.
  // Geometry runs through the same helpers as KeyboardLayoutPreview, so the two
  // boards stay pixel-identical — this one just swaps read-only divs for
  // clickable buttons and captions the active layer instead of layer 0.
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
    style: contextStyle,
    fontSize,
    fontColor,
    fontPosition,
    keycapPalette,
    keycapColors,
  } = usePreviewAppearance();
  // Resolves each key's painted color (键帽上色) from the shared palette — see
  // previewAppearance.tsx and the matching lookup in KeyboardLayoutPreview.tsx.
  const keycapHexById = useMemo(
    () => Object.fromEntries(keycapPalette.map((c) => [c.id, c.hex])),
    [keycapPalette],
  );
  const style = styleOverride ?? contextStyle;
  // `3d` has no distinct render yet — falls back to `default` (flat, no shading).
  const depth = style === "relief";
  // 部分按键使用图标重置且取消换行 (mediaReset) off: caps fall back to full text
  // labels (see KeycapFace), so nowrap+ellipsis would just truncate them —
  // let them wrap instead, see `.keyboard-layout-wrap-labels` in index.css.
  const { mediaReset } = useKeyDisplay();
  const { theme } = useTheme();
  const wireframe = style === "wireframe";
  // Dark mode forces a fixed light-gray font/line color for legibility, same
  // as KeyboardLayoutPreview — but `colorOverride` (a deliberate per-board
  // design like NewHomePage's hero strip) still wins for plate/font/line.
  // The case is deliberately exempt: it should keep showing the board's own
  // configured caseColor as an accent even when everything else is forced to
  // one uniform line color.
  const wireframeDark = wireframe && theme === "dark";
  const caseColorFinal = wireframeDark && !colorOverride ? WIREFRAME_DARK_COLOR : caseColor;
  const plateColorFinal = colorOverride ?? (wireframeDark ? WIREFRAME_DARK_COLOR : plateColor);
  const fontColorFinal = colorOverride ?? (wireframeDark ? WIREFRAME_DARK_COLOR : fontColor);
  const wireframeLineColorFinal = colorOverride ?? (wireframeDark ? WIREFRAME_DARK_COLOR : wireframeLineColor);
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

  // Hover info card: revealed only after the pointer rests on a cap for 0.5s, so
  // it doesn't flicker while the user sweeps across the board. `rect` is the
  // hovered element's viewport box, captured on enter, that anchors the card.
  const [hover, setHover] = useState<{ qmkId: string; rect: DOMRect } | null>(null);
  const hoverTimer = useRef<number | null>(null);
  const cancelHover = () => {
    if (hoverTimer.current !== null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };
  const beginHover = (qmkId: string, el: HTMLElement) => {
    cancelHover();
    const rect = el.getBoundingClientRect();
    hoverTimer.current = window.setTimeout(() => setHover({ qmkId, rect }), 500);
  };
  const endHover = () => {
    cancelHover();
    setHover(null);
  };
  useEffect(() => cancelHover, []);

  // Right-click assign: the cascade selector anchored at the click point,
  // targeting one cap/encoder. Right-clicking also selects the target so the
  // quick-config board below tracks it; the cascade dismisses itself (outside
  // click / Escape / after a pick), so there's no separate close listener here.
  const [menu, setMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null);
  const openMenu = (e: ReactMouseEvent, target: ContextTarget) => {
    if (!onContextAssign) {
      return;
    }
    e.preventDefault();
    endHover();
    // Select the target — but skip a plain whole-key that's already selected, so
    // right-click only ever selects (re-selecting it would toggle it off).
    if (target.kind === "key") {
      const alreadyWhole =
        selected?.kind === "key" &&
        selected.row === target.row &&
        selected.col === target.col &&
        selected.part === undefined;
      if (!alreadyWhole) onKeySelect(target.row, target.col);
    } else {
      const already =
        selected?.kind === "encoder" &&
        selected.index === target.index &&
        selected.direction === target.direction;
      if (!already) onEncoderSelect(target.index, target.direction);
    }
    setMenu({ x: e.clientX, y: e.clientY, target });
  };

  // Rotation directions stacked on the same spot are drawn as one knob (together
  // with the push switch wired underneath it, when the board has one); anything
  // else keeps rendering per-direction. See knobGrouping.ts for why.
  const { placed, knobs, loose: looseEncoders, pressKeys } = useKnobLayout(keyboard);
  // See the matching comment in KeyboardLayoutPreview.tsx: reaching
  // `plateMargin` past the outermost cap's own edge takes `2 * plateMargin -
  // inset`, not `plateMargin` alone.
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
        // Wireframe keeps every other layer stroke-only, but the case is a
        // real solid bezel (not a line-drawn glyph like a keycap) — a hairline
        // border at its outer edge reads as a stray line, not "a shell", so it
        // gets a translucent tint instead. That tint has to be an *inset*
        // shadow rather than `background`: a background paints this whole box
        // including the content area the plate sits in, and since the plate
        // stays transparent in this style, a background tint would bleed
        // through underneath the plate/keycaps too, tinting the entire board
        // instead of just the caseThickness ring. `spread: caseThickness`
        // makes the inset shadow's ring exactly as wide as the padding band,
        // so it stops right at the plate's edge.
        boxShadow:
          showCase && !caseShape && wireframe
            ? `inset 0 0 0 ${caseThickness}px color-mix(in srgb, ${caseColorFinal} 25%, transparent)`
            : undefined,
        // The outer edge still gets a crisp line in the uniform wireframe line
        // color (not caseColor) so the case reads as a defined shape, matching
        // the plate/keycap outlines instead of just fading into the tint above.
        border: showCase && !caseShape && wireframe ? `1.5px solid ${wireframeLineColorFinal}` : undefined,
        borderRadius: showCase && !caseShape ? outerRadius : 0,
        width: "fit-content",
      }}
    >
      {caseShape && (
        <KeyboardCaseOutline
          shape={caseShape}
          caseColor={caseColorFinal}
          plateColor={plateColorFinal}
          lineColor={wireframeLineColorFinal}
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
          (selected ? " keyboard-layout-has-selection" : "") +
          (mediaReset ? "" : " keyboard-layout-wrap-labels")
        }
        style={{
          width: plateWidth,
          height: plateHeight,
          background: caseShape || wireframe ? "transparent" : plateColorFinal,
          // `box-shadow` instead of `border`: a real border sits inside the box
          // model, so the absolutely-positioned `.key`/`.encoder` children below
          // (which anchor to this container's *padding* box, not its border box)
          // would shift inward by the border width — shrinking the right/bottom
          // margin and growing the left/top one by that same amount, since the
          // plate has `padding: 0`. An inset shadow paints identically without
          // participating in the box model at all.
          boxShadow: !caseShape && wireframe ? `inset 0 0 0 1.5px ${plateColorFinal}` : undefined,
          borderRadius: caseShape ? 0 : innerRadius,
          // Shared 字体颜色: cascades to `.key`/`.key-icon` (both `color: inherit`).
          color: fontColorFinal,
          "--key-font-scale": FONT_SCALES[fontSize],
          "--key-radius": `${KEYCAP_RADIUS_PX[keycapRadius]}px`,
          "--wireframe-line-color": wireframeLineColorFinal,
        } as CSSProperties}
      >
        {placed.keys
          // A knob's push switch is drawn inside the knob widget below, not as a
          // cap of its own — see `pressKeys` in knobGrouping.ts.
          .filter((placedKey) => !placedKey.key.decal && !pressKeys.has(placedKey))
          .map(({ key, shiftX, shiftY }) => {
            const qmkId = keyboard.getKey(layer, key.row, key.col);
            const isSelected =
              selected?.kind === "key" && selected.row === key.row && selected.col === key.col;
            const selectedPart = isSelected && selected.kind === "key" ? selected.part : undefined;
            const paintedHex = keycapHexById[keycapColors[`${key.row},${key.col}`]];
            const style = {
              ...shapeStyle(key, shiftX, shiftY, PITCH, inset, plateMargin),
              background: paintedHex,
              // See the matching comment in KeyboardLayoutPreview.tsx: lets the
              // 浮雕 box-shadow tint from this key's own paint color.
              ...(paintedHex ? { "--key-bg": paintedHex } : {}),
            } as CSSProperties;
            const secondRect = hasSecondRect(key) && (
              <span
                className="key-part2"
                style={{
                  left: key.x2 * PITCH,
                  top: key.y2 * PITCH,
                  width: key.width2 * PITCH - inset,
                  height: key.height2 * PITCH - inset,
                }}
              />
            );
            const hoverProps = {
              onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => beginHover(qmkId, e.currentTarget),
              onMouseLeave: endHover,
            };
            const capClass = (isSelected ? "key selected" : "key") + posClass;
            return (
              <Fragment key={`${key.row},${key.col}@${key.x},${key.y}`}>
                {dualRole(qmkId) ? (
                  // Dual-role tap/hold cap: two independently-clickable hit areas
                  // (top = tap, bottom band = hold) over the shared cap face. A
                  // <button> can't nest another button, so this cap is a div while
                  // the non-dual caps below stay a single button.
                  <div
                    className={capClass}
                    style={style}
                    onContextMenu={(e) => openMenu(e, { kind: "key", row: key.row, col: key.col })}
                    {...hoverProps}
                  >
                    {secondRect}
                    <KeycapFace qmkId={qmkId} />
                    <button
                      className={"key-hit key-hit-tap" + (selectedPart === "tap" ? " active" : "")}
                      aria-label="tap"
                      onClick={() => onKeySelect(key.row, key.col, "tap")}
                    />
                    <button
                      className={"key-hit key-hit-hold" + (selectedPart === "hold" ? " active" : "")}
                      aria-label="hold"
                      onClick={() => onKeySelect(key.row, key.col, "hold")}
                    />
                  </div>
                ) : (
                  <button
                    className={capClass}
                    onClick={() => onKeySelect(key.row, key.col)}
                    onContextMenu={(e) => openMenu(e, { kind: "key", row: key.row, col: key.col })}
                    style={style}
                    {...hoverProps}
                  >
                    {secondRect}
                    <KeycapFace qmkId={qmkId} />
                  </button>
                )}
              </Fragment>
            );
          })}
        {knobs.map(({ index, ccw, press }) => {
          // One widget for the whole knob: clicking it selects the knob (starting
          // at 左旋) and the panel below routes between its functions, so all of
          // them stay reachable even though they share a footprint.
          const rotationSelected = selected?.kind === "encoder" && selected.index === index;
          // The push switch is a plain matrix key, so selecting it produces a key
          // selection — the knob still has to read as selected for it.
          const pressSelected =
            press != null &&
            selected?.kind === "key" &&
            selected.row === press.key.row &&
            selected.col === press.key.col;
          // Right-click follows whichever direction the panel currently has
          // active, so "select 右旋 in the panel, then right-click the knob"
          // targets 右旋 rather than silently falling back to 左旋.
          const menuDirection = rotationSelected && selected.kind === "encoder" ? selected.direction : 0;
          return (
            <button
              key={`knob${index}@${ccw.encoder.x},${ccw.encoder.y}`}
              className={
                "encoder encoder-knob" +
                (press ? " encoder-knob-press" : "") +
                (rotationSelected || pressSelected ? " selected" : "")
              }
              title={t("knobTitle")}
              onClick={() => onEncoderSelect(index, 0)}
              onContextMenu={(e) => openMenu(e, { kind: "encoder", index, direction: menuDirection })}
              // No hover info card here, unlike a cap: the knob carries several
              // bindings and the card takes a single keycode, so it could only
              // ever describe one of them — the panel below shows them all.
              style={shapeStyle(ccw.encoder, ccw.shiftX, ccw.shiftY, PITCH, inset, plateMargin)}
            >
              {/* 左旋 on top, 右旋 underneath, and — when the board wires one —
                  the push switch between them at full cap size: the knob's face
                  is what you press, the rim is what you turn. */}
              <span className="knob-row">
                <span className="encoder-dir">↺</span>
                <KeycapFace qmkId={keyboard.getEncoder(layer, index, 0)} />
              </span>
              {press && (
                <span className="knob-row knob-row-press">
                  <KeycapFace qmkId={keyboard.getKey(layer, press.key.row, press.key.col)} />
                </span>
              )}
              <span className="knob-row">
                <span className="encoder-dir">↻</span>
                <KeycapFace qmkId={keyboard.getEncoder(layer, index, 1)} />
              </span>
            </button>
          );
        })}
        {looseEncoders.map(({ encoder, shiftX, shiftY }) => {
          const qmkId = keyboard.getEncoder(layer, encoder.index, encoder.direction);
          const isSelected =
            selected?.kind === "encoder" &&
            selected.index === encoder.index &&
            selected.direction === encoder.direction;
          return (
            <button
              key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
              className={isSelected ? "encoder selected" : "encoder"}
              title={t(encoder.direction === 1 ? "knobCw" : "knobCcw")}
              onClick={() => onEncoderSelect(encoder.index, encoder.direction)}
              onContextMenu={(e) =>
                openMenu(e, {
                  kind: "encoder",
                  index: encoder.index,
                  direction: encoder.direction,
                })
              }
              onMouseEnter={(e) => beginHover(qmkId, e.currentTarget)}
              onMouseLeave={endHover}
              style={shapeStyle(encoder, shiftX, shiftY, PITCH, inset, plateMargin)}
            >
              <span className="encoder-dir">{encoder.direction === 1 ? "↻" : "↺"}</span>
              <KeycapFace qmkId={qmkId} />
            </button>
          );
        })}
      </div>
    </div>
  );

  // The hover card and the right-click cascade are positioned in viewport
  // coordinates, so they stay outside <KeyboardZoom> — a transformed ancestor
  // would become their containing block and scale them along with the board.
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
      {hover && (
        <KeyInfoCard
          qmkId={hover.qmkId}
          style={{
            position: "fixed",
            left: hover.rect.left + hover.rect.width / 2,
            top: hover.rect.top - 8,
            transform: "translate(-50%, -100%)",
          }}
        />
      )}
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
