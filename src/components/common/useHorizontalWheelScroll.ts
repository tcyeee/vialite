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

/** Slack (px) at either end before the container counts as "scrolled to the edge". */
const EDGE_EPS = 1;

/**
 * Time constant (ms) of the pan's exponential ease — roughly how long it takes to
 * cover ~63% of the remaining distance. Tuned to sit close to the root Lenis feel
 * so the hand-off between horizontal pan and page scroll doesn't change character.
 */
const SMOOTH_TAU = 90;

/**
 * Turn a vertical mouse wheel into horizontal panning over a container that
 * overflows horizontally (e.g. the Basic tab's wide row of card columns), chained
 * with the page's own vertical scroll: scrolling down over the row pans it right
 * until the right edge is reached, after which the wheel falls through and the
 * page keeps scrolling down — and symmetrically upwards (pan left to the start,
 * then the page scrolls up).
 *
 * The takeover is skipped entirely when there is nothing to pan, when the gesture
 * is already horizontal, or when an inner vertical scroll area under the pointer
 * still wants the delta.
 *
 * The pan itself is eased on a rAF loop rather than jumping per wheel event, so it
 * reads like the page's own Lenis inertia. A dedicated horizontal Lenis instance
 * would fight the edge hand-off (it decides on its own when to consume a wheel),
 * hence the small hand-rolled lerp. Reduced-motion falls back to instant jumps.
 *
 * `data-lenis-prevent` is toggled per-wheel-event rather than left on the element:
 * the root Lenis smooth-scroll must keep moving the page for every wheel we don't
 * consume, so the attribute is only present for the events we actually take over.
 * Our listener sits on the container, so it runs before Lenis's window-level one
 * in the same dispatch and Lenis sees the up-to-date attribute.
 */
export function useHorizontalWheelScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Where the pan is heading. Wheel deltas accumulate here immediately (so the
    // edge checks and the page hand-off react to the *final* position, not the
    // lagging animated one) while `scrollLeft` eases toward it in `tick`.
    let target = el.scrollLeft;
    let raf = 0;
    let last = 0;

    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 64) : 16;
      last = now;
      const diff = target - el.scrollLeft;
      if (Math.abs(diff) < 0.5) {
        el.scrollLeft = target;
        raf = 0;
        return;
      }
      // Framerate-independent exponential ease: the same time constant whether the
      // display runs at 60 or 120 Hz.
      el.scrollLeft += diff * (1 - Math.exp(-dt / SMOOTH_TAU));
      raf = requestAnimationFrame(tick);
    };

    const onWheel = (e: WheelEvent) => {
      const max = el.scrollWidth - el.clientWidth;
      // Collapse sub-pixel residue onto the exact edge before the gate below runs.
      // That gate hands the wheel back to the page once within EDGE_EPS of an end,
      // so without this a target of e.g. 1 is a hard floor: panning left is refused
      // from then on and the row sits a pixel short of the start, clipping the
      // first column. Snapping keeps the hand-off tolerance while still letting the
      // row actually reach 0 / max.
      if (target <= EDGE_EPS) target = 0;
      else if (target >= max - EDGE_EPS) target = max;
      if (!raf && el.scrollLeft !== target) el.scrollLeft = target;

      // Room left to pan in the wheel's direction? At either extreme the event is
      // handed back to the page so vertical scrolling resumes where the row ends.
      const canPan =
        max > EDGE_EPS &&
        e.deltaY !== 0 &&
        Math.abs(e.deltaY) > Math.abs(e.deltaX) &&
        (e.deltaY > 0 ? target < max - EDGE_EPS : target > EDGE_EPS) &&
        !innerCanScrollY(e.target as Node, el, e.deltaY);

      if (!canPan) {
        el.removeAttribute("data-lenis-prevent");
        return;
      }
      el.setAttribute("data-lenis-prevent", "");
      target = Math.max(0, Math.min(max, target + e.deltaY));
      if (smooth) {
        if (!raf) {
          last = 0;
          raf = requestAnimationFrame(tick);
        }
      } else {
        el.scrollLeft = target;
      }
      e.preventDefault();
    };

    // Anything that moves the row without going through us — the first-run peek
    // demo, a trackpad's native horizontal swipe, a focus-driven scrollIntoView —
    // re-seeds the target, so the next wheel eases on from where it actually is
    // instead of snapping back to a stale destination.
    const onScroll = () => {
      if (!raf) target = el.scrollLeft;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      el.removeAttribute("data-lenis-prevent");
    };
  }, []);

  return ref;
}
