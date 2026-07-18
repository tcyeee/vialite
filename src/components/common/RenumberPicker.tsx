import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

interface Props {
  /** Currently selected slot number. */
  index: number;
  /** Total number of slots to offer in the grid. */
  count: number;
  /** Slot numbers occupied by another entry — greyed out and non-selectable. */
  usedIndices: Set<number>;
  /** Label prefix shown on the trigger, e.g. "TD" or "CB". */
  prefix: string;
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
export function RenumberPicker({ index, count, usedIndices, prefix, title, onMove }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: r.left });
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

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="flex cursor-pointer items-center gap-0.5 text-lg font-bold tracking-tight text-neutral-900 hover:text-primary"
        title={title}
        onClick={() => setOpen((o) => !o)}
      >
        {prefix}-{index}
        <Icon icon="mdi:chevron-down" className="h-4 w-4 opacity-60" />
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-lenis-prevent
            style={{ position: "fixed", top: pos.top, left: pos.left }}
            className="z-50 grid max-h-72 w-72 grid-cols-5 gap-1.5 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
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
                  className={`btn btn-sm ${
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

