import { useEffect, useRef } from "react";

/**
 * Walk up from `from` to (but not including) `stop`, looking for a
 * vertically-scrollable ancestor that can still move in the wheel's direction —
 * so an open card's own scroll area keeps consuming the wheel instead of being
 * hijacked into a horizontal pan.
 */
function innerCanScrollY(from: Node | null, stop: HTMLElement, deltaY: number): boolean {
  let el = from instanceof HTMLElement ? from : (from?.parentElement ?? null);
  while (el && el !== stop) {
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if (deltaY < 0 && !atTop) return true;
      if (deltaY > 0 && !atBottom) return true;
    }
    el = el.parentElement;
  }
  return false;
}

/**
 * Turn a vertical mouse wheel into horizontal panning over a container that
 * overflows horizontally (e.g. the Basic tab's wide row of card columns). Only
 * takes over while there is something to pan and no inner vertical scroll area
 * under the pointer wants the delta; otherwise the wheel behaves normally.
 *
 * While panning is possible the container is marked `data-lenis-prevent` so the
 * root Lenis smooth-scroll doesn't also move the page — the attribute is dropped
 * again when there's no horizontal overflow, so normal page scrolling is
 * unaffected on wide viewports / other tabs.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const syncLenis = () => {
      if (el.scrollWidth > el.clientWidth) el.setAttribute("data-lenis-prevent", "");
      else el.removeAttribute("data-lenis-prevent");
    };
    syncLenis();
    const observer = new ResizeObserver(syncLenis);
    observer.observe(el);

    const onWheel = (e: WheelEvent) => {
      // Keep the attribute in step with the current layout (content/size changes
      // between resizes, e.g. a card floating open).
      syncLenis();
      if (el.scrollWidth <= el.clientWidth) return; // nothing to pan
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return; // already a horizontal gesture
      if (e.deltaY === 0) return;
      if (innerCanScrollY(e.target as Node, el, e.deltaY)) return; // let inner scroll win
      el.scrollLeft += e.deltaY;
      e.preventDefault();
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("wheel", onWheel);
      observer.disconnect();
    };
  }, []);

  return ref;
}
