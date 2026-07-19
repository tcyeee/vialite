import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { dualRole, type KeycodeDef } from "../../protocol/keycodes.ts";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeycapFace } from "./KeycapFace.tsx";
import { KeycodeCascadeSelector } from "./KeycodeCascadeSelector.tsx";
import { KeyInfoCard } from "./KeyInfoCard.tsx";
import {
  appearanceMetrics,
  FONT_SCALES,
  fontPositionClass,
  KeyboardZoom,
  shapeStyle,
} from "./KeyboardLayoutPreview.tsx";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

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
}

export function KeyboardLayout({
  keyboard,
  layer,
  selected,
  onKeySelect,
  onEncoderSelect,
  onContextAssign,
  zoomOverride,
}: Props) {
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
    caseThickness,
    caseColor,
    plateColor,
    keycapBorder,
    depth,
    fontSize,
    fontColor,
    fontPosition,
  } = usePreviewAppearance();
  const {
    PITCH,
    inset,
    outerRadius,
    innerRadius,
    showCase,
    zoom: sizeZoom,
  } = appearanceMetrics(size, spacing, keycapWidth, caseRadius, caseThickness);
  const zoom = zoomOverride ?? sizeZoom;
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

  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    // Keyboard mutates in place; layoutOptions is the only geometry input that
    // changes after the initial load.
    [keyboard, keyboard.layoutOptions],
  );
  const plateWidth = placed.width * PITCH + inset;
  const plateHeight = placed.height * PITCH + inset;

  const board = (
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
          (keycapBorder ? " keyboard-layout-bordered" : "") +
          (selected ? " keyboard-layout-has-selection" : "")
        }
        style={{
          width: plateWidth,
          height: plateHeight,
          background: plateColor,
          borderRadius: innerRadius,
          // Shared 字体颜色: cascades to `.key`/`.key-icon` (both `color: inherit`).
          color: fontColor,
          "--key-font-scale": FONT_SCALES[fontSize],
        } as CSSProperties}
      >
        {placed.keys
          .filter(({ key }) => !key.decal)
          .map(({ key, shiftX, shiftY }) => {
            const qmkId = keyboard.getKey(layer, key.row, key.col);
            const isSelected =
              selected?.kind === "key" && selected.row === key.row && selected.col === key.col;
            const selectedPart = isSelected && selected.kind === "key" ? selected.part : undefined;
            const style = shapeStyle(key, shiftX, shiftY, PITCH, inset, inset);
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
        {placed.encoders.map(({ encoder, shiftX, shiftY }) => {
          const qmkId = keyboard.getEncoder(layer, encoder.index, encoder.direction);
          const isSelected =
            selected?.kind === "encoder" &&
            selected.index === encoder.index &&
            selected.direction === encoder.direction;
          return (
            <button
              key={`e${encoder.index},${encoder.direction}@${encoder.x},${encoder.y}`}
              className={isSelected ? "encoder selected" : "encoder"}
              title={`Encoder ${encoder.index} ${encoder.direction === 1 ? "CW" : "CCW"}`}
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
              style={shapeStyle(encoder, shiftX, shiftY, PITCH, inset, inset)}
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
        live={zoomOverride != null}
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
