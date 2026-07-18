import { type ReactNode, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { startViewTransition } from "../../common/viewTransition.ts";

/**
 * One card in a {@link ExpandableCardColumn}. The card renders collapsed in the
 * column; clicking it (when {@link body} is present) grows a floating enlarged
 * copy on top of its neighbours — the collapsed footprint stays as a placeholder
 * so the column never reflows.
 */
export interface ExpandableCardDef {
  /** Stable identity: React key + view-transition-name suffix. */
  key: string;
  /** Card background color. */
  bg: string;
  /** Dimmed and non-expandable (e.g. an empty category). */
  disabled?: boolean;
  /** Extra classes applied to both the collapsed and floating card (e.g. a bg pattern). */
  cardClassName?: string;
  /** Header (title + optional help), rendered in both the collapsed and floating card. */
  header: ReactNode;
  /** Absolutely-positioned overlays shown on the collapsed card only (badge, hover action). */
  overlay?: ReactNode;
  /**
   * A top-right action shown on the floating (expanded) card only — e.g. a "详细设置"
   * link that jumps to the matching QMK Settings section. Its own clicks are kept
   * from bubbling to the card's close-on-click, so the caller's handler runs alone.
   */
  expandedAction?: ReactNode;
  /** Absolutely-positioned decoration shown in both states (e.g. a watermark). */
  decor?: ReactNode;
  /** The collapsed subtitle line ("Click to reveal" / "—" / …). */
  hint?: ReactNode;
  /** Per-card override of the floating card's width (else the column default). */
  expandedWidth?: string;
  /**
   * Per-card fixed height for the floating card (else it sizes to content). Still
   * capped to the column height. Set for a card whose body should fill a stable
   * box regardless of content (e.g. the Mouse card's fixed 318px layout).
   */
  expandedHeight?: string;
  /**
   * Let the floating card grow to its full content height, opting out of the
   * column-height cap. Set for content-sized cards (Macros/Tap Dance) whose
   * wrapped tile grid should size to fit rather than scroll within the cap.
   */
  expandedUncapped?: boolean;
  /**
   * Per-card vertical nudge (px) of the floating card from its anchored position.
   * Positive moves it down. Set for the Mouse card so its enlarged copy clears
   * the neighbours above it.
   */
  expandedOffsetY?: number;
  /**
   * Per-card horizontal nudge (px) of the floating card from its anchored edge.
   * Positive moves it right, negative left. Set on the Fn/Media/Mouse cards to
   * pull their enlarged copies leftward.
   */
  expandedOffsetX?: number;
  /** Per-card override of the floating card-body padding class (default `p-6`). */
  expandedPadding?: string;
  /**
   * Render the expanded body without the scrolling gutter wrapper. Set for a
   * body that always fits (e.g. the F13–F24 grid) so its content sits flush
   * against the symmetric card padding instead of being offset by the reserved
   * scrollbar gutter.
   */
  noScroll?: boolean;
  /**
   * Expanded body. When absent the card can't expand; clicking runs
   * {@link onActivate} instead (used by the Combo info card, which pops a toast).
   * `close` collapses the card — wire it to any "Back" button inside the body.
   */
  body?: (close: () => void) => ReactNode;
  /** Click handler for a non-expanding card ({@link body} omitted). */
  onActivate?: () => void;
}

interface Props {
  cards: ExpandableCardDef[];
  /** view-transition-name prefix, unique per family (e.g. "quantumcard"). */
  idPrefix: string;
  /** Collapsed card width (Tailwind class). */
  collapsedWidth?: string;
  /** Floating (expanded) card width (Tailwind class). */
  expandedWidth?: string;
  /**
   * Grow the floating card leftward (its right edge pinned to the column) instead
   * of rightward. Set for the rightmost column so a wide floating card doesn't
   * spill past — and get clipped by — a horizontally-scrolling parent's edge.
   */
  growLeft?: boolean;
  /** Called with the newly-expanded card key (or null) whenever it changes. */
  onExpandedChange?: (key: string | null) => void;
}

/**
 * A vertical column of expandable cards. Clicking a card grows a floating copy
 * (raised z-index, height-capped to the column) over its neighbours without
 * reflowing them; only one card is open at a time, and clicking outside — or the
 * body's "Back" button — collapses it inside a View Transition.
 *
 * Extracted from the original Fn/Media/Mouse cards so the Basic tab's three card
 * families (Fn/Media/Mouse, Macros/Tap Dance/Combo, Quantum) share one identical
 * layout and interaction. Families supply per-card render nodes (header, badge,
 * body) and keep their own domain logic.
 */
export function ExpandableCardColumn({
  cards,
  idPrefix,
  collapsedWidth = "w-56",
  expandedWidth = "w-72",
  growLeft = false,
  onExpandedChange,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  // Which card is currently transitioning (growing or shrinking). It carries a
  // `view-transition-name` and sits on the raised z-index layer for exactly the
  // duration of a transition — set before it starts, cleared once it finishes.
  // Nothing persists past a transition, so at rest every collapsed card shares
  // the same (auto) stacking level and none can cover another; the *open* card
  // is instead raised via `expanded` (see the cell's z-index below), so it stays
  // on top after the grow animation ends rather than dropping back under a
  // neighbouring column's card.
  const [animating, setAnimating] = useState<string | null>(null);
  // The collapsed column's height, used as the upper bound for a floating card so
  // it never grows past the top/bottom of the column.
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerH, setContainerH] = useState<number | null>(null);
  // The currently-open enlarged card, so an outside click can be distinguished
  // from a click landing inside it.
  const openCardRef = useRef<HTMLDivElement | null>(null);

  /** Play the shrink animation, dropping the transition name once it finishes. */
  const close = () => {
    const key = expanded;
    // Name the collapsing card inside the transition so the shrink morphs back to
    // its placeholder; it stays on the raised layer (via `animating`) until the
    // shrink finishes, then drops to the shared resting level. Guard the clear so
    // a stale close can't unset a card that has since re-opened.
    const transition = startViewTransition(() =>
      flushSync(() => {
        setAnimating(key);
        setExpanded(null);
      }),
    );
    void transition.finished.then(() => setAnimating((cur) => (cur === key ? null : cur)));
    onExpandedChange?.(null);
  };

  /** Toggle a card open/closed, animating the layout change via a View Transition. */
  const toggle = (key: string) => {
    if (expanded === key) {
      close();
    } else {
      // Opening: name the card first (so the old snapshot captures the collapsed
      // card and it takes the raised layer), then play the grow animation.
      flushSync(() => setAnimating(key));
      const transition = startViewTransition(() => flushSync(() => setExpanded(key)));
      void transition.finished.then(() => setAnimating((cur) => (cur === key ? null : cur)));
      onExpandedChange?.(key);
    }
  };

  // Track the collapsed column's height so a floating card can be capped to it.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setContainerH(el.offsetHeight);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Close (with the shrink animation) when clicking anywhere outside the open
  // card. A document listener is used instead of a full-screen backdrop so the
  // other cards stay clickable.
  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      // Clicking inside the open card never closes it (that's the card's own job).
      if (openCardRef.current?.contains(e.target as Node)) return;
      // Clicking the keyboard preview above re-selects a cap without collapsing the
      // card, so the user can keep the same card open while retargeting keys.
      if (target?.closest("[data-keyboard-preview]")) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  // Anchor the floating (open) copy so it grows toward the column's vertical
  // centre instead of always downward: cards above centre grow down, cards below
  // grow up, and the middle card grows symmetrically from its centre.
  const anchorClass = (i: number): string => {
    const side = growLeft ? "right-0" : "left-0";
    const mid = (cards.length - 1) / 2;
    if (i < mid) return `top-0 ${side}`;
    if (i > mid) return `bottom-0 ${side}`;
    // The middle card's -50% centering lives in the inline transform (see below)
    // so it can compose with a per-card `expandedOffsetY` nudge.
    return `top-1/2 ${side}`;
  };

  return (
    <div ref={containerRef} className="mt-3 flex flex-col gap-4">
      {cards.map((card, i) => {
        const isOpen = expanded === card.key;
        const name = `${idPrefix}-${i}`;
        const clickable = !card.disabled && Boolean(card.body || card.onActivate);
        const onClick = () => {
          if (card.disabled) return;
          if (card.body) toggle(card.key);
          else card.onActivate?.();
        };
        return (
          // The cell keeps its collapsed footprint even while open, so the
          // enlarged copy floats on top (raised z-index) without reflowing
          // neighbours. Its base card stays put as a placeholder underneath.
          <div
            key={card.key}
            // Cell z-index, so an enlarged card lifts cleanly above its
            // neighbours — including the other card columns it overflows into:
            //  • open (enlarged) card → top of the stack (z-50), and it stays
            //    there after the grow transition ends, never dropping back under
            //    a neighbouring column's collapsed card;
            //  • a card mid-transition (growing or shrinking) → just below the
            //    open layer (z-40), so a card opening in another column still
            //    covers one that's collapsing here;
            //  • every card at rest → the shared default level, so the collapsed
            //    cards never fight each other for stacking order.
            className={`relative ${collapsedWidth} ${
              isOpen ? "z-50" : animating === card.key ? "z-40" : ""
            }`}
          >
            <div
              className={`group/expandcard card ${collapsedWidth} select-none text-brand-background shadow-md transition-shadow ${
                clickable ? "cursor-pointer hover:shadow-lg" : "cursor-default opacity-60"
              } ${card.cardClassName ?? ""}`}
              style={{
                backgroundColor: card.bg,
                // A view-transition-name is applied *only* to the card currently
                // animating, and dropped once it's open (the floating copy takes
                // over the name). Naming every collapsed card would pull them all
                // into the top-level ::view-transition layer for the duration of
                // any transition — making every card paint above its neighbours
                // mid-animation, defeating the per-card `z-50` raise.
                viewTransitionName: animating === card.key && !isOpen ? name : undefined,
              }}
              onClick={onClick}
            >
              {card.decor}
              {/* Hidden while open: the enlarged copy floats above but the
                  overlay's own z-index would otherwise poke through here. */}
              {!isOpen && card.overlay}
              <div className="card-body relative gap-3 p-5">
                <div className="text-xl">{card.header}</div>
                {card.hint != null && (
                  <div className="text-xs tracking-widest uppercase opacity-40">{card.hint}</div>
                )}
              </div>
            </div>

            {isOpen && card.body && (
              <div
                ref={openCardRef}
                className={`card absolute ${anchorClass(i)} ${card.expandedWidth ?? expandedWidth} cursor-pointer select-none overflow-hidden text-brand-background shadow-[0_10px_40px_-5px_rgba(0,0,0,0.5)] ring-1 ring-black/10 dark:ring-white/10 ${
                  card.cardClassName ?? ""
                }`}
                style={{
                  backgroundColor: card.bg,
                  viewTransitionName: name,
                  // Size to content: no forced minimum, so a card with few keycodes
                  // stays short instead of padding out to a fixed box. Still cap the
                  // height to the column so a content-heavy card never spills past
                  // its top/bottom — the body scrolls within that cap. A card that
                  // pins a fixed `expandedHeight` — or opts in via `expandedUncapped`
                  // — bypasses the cap, so its height is honoured (or grows to
                  // content) even when the collapsed column is shorter than it.
                  height: card.expandedHeight,
                  maxHeight:
                    card.expandedHeight || card.expandedUncapped
                      ? undefined
                      : (containerH ?? undefined),
                  // Both position nudges are transforms (not margins) so they work
                  // regardless of anchor edge — a `right-0`-anchored card ignores
                  // marginLeft and a `bottom-0`-anchored card ignores marginTop.
                  // Composed with the middle card's -50% centering.
                  transform:
                    [
                      i === (cards.length - 1) / 2 ? "translateY(-50%)" : "",
                      card.expandedOffsetX ? `translateX(${card.expandedOffsetX}px)` : "",
                      card.expandedOffsetY ? `translateY(${card.expandedOffsetY}px)` : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined,
                }}
                onClick={() => close()}
              >
                {card.decor}
                {card.expandedAction && (
                  <div className="absolute right-4 top-4 z-20" onClick={(e) => e.stopPropagation()}>
                    {card.expandedAction}
                  </div>
                )}
                <div
                  className={`card-body relative min-h-0 flex-1 gap-5 overflow-hidden ${
                    card.expandedPadding ?? "p-6"
                  }`}
                >
                  <div className="text-2xl">{card.header}</div>
                  {card.noScroll ? (
                    <div className="min-h-0 flex-1" onClick={(e) => e.stopPropagation()}>
                      {card.body(close)}
                    </div>
                  ) : (
                    <div
                      data-lenis-prevent
                      className="-mr-2 min-h-0 flex-1 overflow-y-auto pr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {card.body(close)}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
