import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

/** Tallest the slot grid ever gets: past this the columns multiply instead, so a board with more
 *  slots gets a wider menu rather than a taller (or scrolling) one. */
const MAX_ROWS = 3;

/** Column count below which the grid keeps a fixed shape — a handful of slots shouldn't render as
 *  a narrow 2-column, 3-row sliver just because it fits in three rows. */
const MIN_COLS = 5;

/** Width of one slot button. Fixed so every column lines up whatever the number's digit count. */
const CELL_REM = 2.25;
const WIDE_CELL_REM = 2.75;

/** Gap between the menu and the viewport edge when a wide grid has to be pulled back in. */
const VIEWPORT_MARGIN = 8;

/** Gap between the trigger and the menu, on whichever side it opens. */
const MENU_OFFSET = 4;

interface Props {
  /** Currently selected slot number. */
  index: number;
  /** Total number of slots to offer in the grid. */
  count: number;
  /** Slot numbers occupied by another entry — greyed out and non-selectable. */
  usedIndices: Set<number>;
  /** Iconify icon shown on the trigger before the slot number, e.g. the tap-dance / combo glyph. */
  icon: string;
  /** Tooltip / accessible title for the trigger. */
  title: string;
  /** Move the entry to a different (free) slot number. */
  onMove: (toIdx: number) => void;
}

/**
 * Slot-number picker for the tap-dance / combo edit cards.
 *
 * The menu is rendered in a portal with `position: fixed` anchored to the trigger, on purpose: the
 * edit card is `overflow-hidden` (rounded corners + watermark) and 3D-transformed while flipped, so
 * an in-card `absolute` menu gets clipped at the card's bottom edge — the larger slot numbers, which
 * sit low in the grid, become unreachable. Portaling to `document.body` escapes that clipping and
 * any transform-induced stacking.
 *
 * It's a plain controlled popover (not daisyUI's `.dropdown`, whose CSS drives open/close from
 * `:focus-within` and would fight the JS `open` state), and the grid is unmounted while closed so
 * there's no stale-click window.
 */
export function RenumberPicker({ index, count, usedIndices, icon, title, onMove }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    // The grid widens with the slot count (see MAX_ROWS), so a picker near the right edge would
    // otherwise run off screen — pull it back in by its measured width. The menu is already in the
    // DOM by the time this layout effect runs, and its size doesn't depend on where it's placed.
    const menuW = menuRef.current?.offsetWidth ?? 0;
    const menuH = menuRef.current?.offsetHeight ?? 0;
    const left = Math.max(VIEWPORT_MARGIN, Math.min(r.left, window.innerWidth - menuW - VIEWPORT_MARGIN));
    // Below the trigger by default; flipped above it when that would hang off the bottom of the
    // viewport — but only if there's actually more room up there, so a menu taller than either
    // side still opens downwards (where it can at least be scrolled to) rather than off the top.
    const below = r.bottom + MENU_OFFSET;
    const flip = below + menuH > window.innerHeight - VIEWPORT_MARGIN && r.top > window.innerHeight - r.bottom;
    const top = flip ? Math.max(VIEWPORT_MARGIN, r.top - MENU_OFFSET - menuH) : below;
    setPos({ top, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Outside click closes; clicks inside the trigger or the portaled menu are ignored so the
    // number button's own click still lands (checking the menu ref — not DOM containment on the
    // card — is what makes this safe with the portal).
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    // A fixed menu doesn't follow the panel as it scrolls, so just close it.
    const onScroll = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  // Three rows at most, so the columns are what absorbs the slot count: 30 slots is 10 per row,
  // 31 is 11. Cells are a fixed width (wider once slot numbers reach 3 digits) so the columns stay
  // aligned and the menu's own width follows from the count.
  const cols = Math.max(MIN_COLS, Math.ceil(count / MAX_ROWS));
  const cellRem = String(count - 1).length > 2 ? WIDE_CELL_REM : CELL_REM;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="flex cursor-pointer items-center gap-1 text-lg font-bold tracking-tight text-neutral-900 hover:text-primary dark:text-neutral-100"
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon icon={icon} className="h-5 w-5" />
        {index}
        <Icon icon="mdi:chevron-down" className="h-4 w-4 opacity-60" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-lenis-prevent
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              gridTemplateColumns: `repeat(${cols}, ${cellRem}rem)`,
            }}
            className="z-50 grid max-w-[calc(100vw-1rem)] gap-1.5 overflow-x-auto rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
          >
            {Array.from({ length: count }).map((_, n) => {
              const current = n === index;
              const occupied = !current && usedIndices.has(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={occupied}
                  onClick={() => {
                    setOpen(false);
                    if (!current) onMove(n);
                  }}
                  // `px-0`: the cell's width is the grid track, so the button's own horizontal
                  // padding would only squeeze the number inside it.
                  className={`btn btn-sm px-0 ${
                    current ? "btn-primary" : occupied ? "btn-ghost opacity-30" : "btn-ghost"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

