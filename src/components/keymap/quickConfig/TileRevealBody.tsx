import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";

interface Props {
  entries: KeycodeDef[];
  /** Assign the picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
  /**
   * Already-localized help text for an entry's hover tooltip, or undefined when
   * the entry has none (it then falls back to the entry's title/qmkId).
   */
  helpFor?: (entry: KeycodeDef) => string | undefined;
}

/**
 * A flat wrap of uniform labelled tiles revealed inside an expanded card — the
 * Media card's body, extracted so other cards (the Quantum "Other" card) can
 * adopt exactly the same look: fixed-size `h-[47px] w-[120px]` buttons that
 * never wrap their label (`whitespace-nowrap`), with a hover tooltip describing
 * each key.
 *
 * The tooltip is portaled to `document.body` with `position: fixed` (the same
 * escape RenumberPicker uses) rather than drawn as a daisyUI CSS tooltip: the
 * enlarged card is `overflow-hidden` with a scrolling body, so an in-flow tooltip
 * would be clipped by that box (and can't be lifted out with z-index alone). A
 * body-level portal sits above every stacking context, so it's never covered.
 */
export function TileRevealBody({ entries, onPick, helpFor }: Props) {
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);

  const show = (e: MouseEvent<HTMLButtonElement>, entry: KeycodeDef) => {
    const help = helpFor?.(entry);
    // Drop a trailing sentence period (both ASCII "." and full-width "。").
    const text = (help ?? entry.title ?? entry.qmkId).replace(/[.。]$/, "");
    const r = e.currentTarget.getBoundingClientRect();
    // Anchor above the button's top-centre; the tip's own transform pulls it up.
    setTip({ text, top: r.top - 8, left: r.left + r.width / 2 });
  };
  const hide = () => setTip(null);

  // A `position: fixed` tip doesn't follow the card's scrolling body, so drop it
  // as soon as anything scrolls (matching RenumberPicker's portaled menu).
  useEffect(() => {
    if (!tip) return;
    const onScroll = () => setTip(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [tip]);

  return (
    <div className="combo-num-grid flex flex-wrap gap-2">
      {entries.map((entry, j) => (
        <button
          key={entry.qmkId}
          className="combo-item btn btn-sm h-[47px] w-[120px] border-white/20 bg-white/10 font-normal whitespace-nowrap text-white normal-case shadow-none hover:border-white/40 hover:bg-white/25"
          style={{ animationDelay: `${Math.min(j * 25, 300)}ms` }}
          onMouseEnter={(e) => show(e, entry)}
          onMouseLeave={hide}
          onClick={() => onPick(entry)}
        >
          {entry.label || entry.qmkId}
        </button>
      ))}
      {tip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: tip.top,
              left: tip.left,
              transform: "translate(-50%, -100%)",
            }}
            className="pointer-events-none z-[999] max-w-xs rounded-md bg-neutral px-2 py-1 text-xs whitespace-normal text-neutral-content shadow-lg"
          >
            {tip.text}
          </div>,
          document.body,
        )}
    </div>
  );
}
