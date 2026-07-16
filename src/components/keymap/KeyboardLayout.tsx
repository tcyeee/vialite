import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type SVGProps,
} from "react";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { dualRole } from "../../protocol/keycodes.ts";
import { useI18n } from "../../contexts/i18n.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import { KeycapFace } from "./KeycapFace.tsx";
import { KeyInfoCard } from "./KeyInfoCard.tsx";
import {
  appearanceMetrics,
  FONT_SCALES,
  fontPositionClass,
  shapeStyle,
} from "./KeyboardLayoutPreview.tsx";
import { hasSecondRect, placeLayout } from "./layoutGeometry.ts";

/** Circle-slash: "no key / disabled" for the KC_NO context action. */
function NoKeyIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" d="m6 6 12 12" />
    </svg>
  );
}

/** Down triangle (▽): "transparent / pass-through" for the KC_TRNS action. */
function TransparentIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinejoin="round" d="M5 7h14l-7 11z" />
    </svg>
  );
}

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
  /** Right-click "设置为 KC_NO / KC_TRNS": writes the keycode to the target. */
  onContextAssign?: (target: ContextTarget, qmkId: string) => void;
}

export function KeyboardLayout({
  keyboard,
  layer,
  selected,
  onKeySelect,
  onEncoderSelect,
  onContextAssign,
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
    caseThickness,
    caseColor,
    plateColor,
    keycapBorder,
    depth,
    fontSize,
    fontColor,
    fontPosition,
  } = usePreviewAppearance();
  const { PITCH, inset, outerRadius, innerRadius, showCase } = appearanceMetrics(
    size,
    spacing,
    keycapWidth,
    caseRadius,
    caseThickness,
  );
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

  // Right-click menu: anchored at the click point, targeting one cap/encoder.
  // Any outside click, scroll, or Escape dismisses it.
  const [menu, setMenu] = useState<{ x: number; y: number; target: ContextTarget } | null>(null);
  const openMenu = (e: ReactMouseEvent, target: ContextTarget) => {
    if (!onContextAssign) {
      return;
    }
    e.preventDefault();
    endHover();
    setMenu({ x: e.clientX, y: e.clientY, target });
  };
  useEffect(() => {
    if (!menu) {
      return;
    }
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
      }
    };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const placed = useMemo(
    () => placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices),
    // Keyboard mutates in place; layoutOptions is the only geometry input that
    // changes after the initial load.
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
        <ul
          className="menu rounded-box bg-base-100 shadow-lg z-50 w-56 p-1"
          // Fixed at the click point; default menu font size.
          style={{ position: "fixed", left: menu.x, top: menu.y }}
          // Keep the originating right-click from immediately re-closing the menu.
          onContextMenu={(e) => e.preventDefault()}
        >
          {(["KC_NO", "KC_TRNS"] as const).map((qmkId) => {
            const Icon = qmkId === "KC_NO" ? NoKeyIcon : TransparentIcon;
            return (
              <li key={qmkId}>
                <button
                  type="button"
                  className="flex items-center gap-2"
                  onClick={() => {
                    onContextAssign(menu.target, qmkId);
                    setMenu(null);
                  }}
                >
                  <Icon className="h-[1.15em] w-[1.15em] shrink-0" />
                  {qmkId === "KC_NO" ? t("ctxSetKcNo") : t("ctxSetKcTrns")}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
