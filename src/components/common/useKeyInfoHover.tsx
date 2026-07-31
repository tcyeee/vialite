import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { KeyInfoCard } from "../keymap/picker/KeyInfoCard.tsx";

/** How long the pointer must rest on a key before its card appears — long enough that sweeping
 *  across a row of keys doesn't flash it. Matches the interactive board's own hover delay. */
const HOVER_DELAY_MS = 500;

/**
 * Delayed "what does this key do" hover card for keys rendered outside the interactive board
 * (the combo table's trigger / output cells, …), showing the same {@link KeyInfoCard} the board
 * does: raw keycode, name, and — for a dual-role Quantum key — its tap and hold halves described
 * separately.
 *
 * Spread `hoverProps(qmkId)` on each key element and render `infoCard` once. The card is
 * portalled to `<body>`: it's `position: fixed`, but a transformed or filtered ancestor would
 * still make itself the containing block and pull it back inside a clipping scroller.
 */
export function useKeyInfoHover(): {
  hoverProps: (qmkId: string) => {
    onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => void;
    onMouseLeave: () => void;
  };
  infoCard: ReactNode;
} {
  // `rect` is the hovered element's viewport box, captured on enter, that anchors the card.
  const [hover, setHover] = useState<{ qmkId: string; rect: DOMRect } | null>(null);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => cancel, []);

  const hoverProps = (qmkId: string) => ({
    onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => {
      cancel();
      const rect = e.currentTarget.getBoundingClientRect();
      timer.current = window.setTimeout(() => setHover({ qmkId, rect }), HOVER_DELAY_MS);
    },
    onMouseLeave: () => {
      cancel();
      setHover(null);
    },
  });

  const infoCard = hover
    ? createPortal(
        <KeyInfoCard
          qmkId={hover.qmkId}
          style={{
            position: "fixed",
            left: hover.rect.left + hover.rect.width / 2,
            top: hover.rect.top - 8,
            transform: "translate(-50%, -100%)",
          }}
        />,
        document.body,
      )
    : null;

  return { hoverProps, infoCard };
}
