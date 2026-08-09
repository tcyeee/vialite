// Corner-tucked, magnet-pull close/back button — extracted from StyleConfig.tsx's
// fullscreen preview overlay so other fullscreen-style pages can reuse the same
// affordance instead of re-implementing the hover-grow + cursor-magnet behavior.

import { forwardRef, useEffect, useState } from "react";
import { Icon } from "@iconify/react";

/** Scale applied while hovered — it grows from its corner-anchored resting size back into full view. */
const HOVER_SCALE = 2;

/** Matches the button's own `h-20 w-20` Tailwind size (5rem) — used below to locate its resting center without reading back a `getBoundingClientRect` that the magnet effect's own translate would otherwise feed back into. */
const BTN_SIZE = 80;
/** Matches the button's `-right-5 -top-5` Tailwind offset (-1.25rem) — how far outside the viewport corner it rests before any magnet pull is applied. */
const BTN_REST_OFFSET = -20;
/** Distance (px, from the button's resting center) within which the cursor starts pulling it closer — see {@link MAGNET_MAX_SHIFT}. Falls off linearly to 0 at this radius so the pull eases in instead of snapping on. */
const MAGNET_RADIUS = 220;
/** Cap (px) on how far the cursor can pull the button down/left from its corner — it only ever moves toward the page content, never further up/right off-screen. */
const MAGNET_MAX_SHIFT = 50;

/** The button's resting center (before any magnet translate), derived from its own fixed Tailwind offset/size rather than measuring the live (possibly already-translated) DOM rect. */
function restCenter() {
  return {
    x: window.innerWidth - BTN_REST_OFFSET - BTN_SIZE / 2,
    y: BTN_REST_OFFSET + BTN_SIZE / 2,
  };
}

export interface CornerCloseButtonProps {
  onClick: () => void;
  /** aria-label / title — describes what closing does (e.g. "退出全屏预览"). */
  label: string;
  /**
   * Whether the button is actually visible right now — gates the `mousemove`
   * listener so it isn't tracking the cursor while unmounted-in-spirit (e.g.
   * a caller that keeps this mounted but toggles visibility via CSS rather
   * than conditional rendering).
   */
  active: boolean;
  /**
   * Iconify id drawn in the middle. Defaults to a close cross; pages that are
   * one step of a round trip rather than a dead end pass a back arrow instead
   * (see App.tsx's 配置区域 → 宏/Tap Dance/组合 编辑页 round trip).
   */
  icon?: string;
}

/**
 * Fixed top-right button that rests mostly off-screen (`-right-5 -top-5`) and
 * scales up from that corner on hover, plus a magnetic pull that slides it
 * toward the cursor as it nears — so the user doesn't have to hunt for a
 * target that starts mostly outside the viewport. See `useFullscreenPreview`
 * in `StyleConfig.tsx` for the original context this was pulled out of.
 */
export const CornerCloseButton = forwardRef<HTMLButtonElement, CornerCloseButtonProps>(
  function CornerCloseButton({ onClick, label, active, icon = "mdi:close" }, ref) {
    const [hover, setHover] = useState(false);
    const [magnet, setMagnet] = useState({ x: 0, y: 0 });

    useEffect(() => {
      if (!active) return;
      setMagnet({ x: 0, y: 0 });
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let raf: number | null = null;
      const onMouseMove = (e: MouseEvent) => {
        if (raf != null) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const rest = restCenter();
          const dx = rest.x - e.clientX; // positive: cursor is left of the resting corner
          const dy = e.clientY - rest.y; // positive: cursor is below the resting corner
          const distance = Math.hypot(dx, dy);
          if (distance >= MAGNET_RADIUS) {
            setMagnet({ x: 0, y: 0 });
            return;
          }
          const pull = 1 - distance / MAGNET_RADIUS;
          setMagnet({
            x: Math.max(0, Math.min(dx, MAGNET_MAX_SHIFT)) * pull,
            y: Math.max(0, Math.min(dy, MAGNET_MAX_SHIFT)) * pull,
          });
        });
      };
      window.addEventListener("mousemove", onMouseMove);
      return () => {
        window.removeEventListener("mousemove", onMouseMove);
        if (raf != null) cancelAnimationFrame(raf);
      };
    }, [active]);

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={label}
        className="fixed -right-5 -top-5 z-20 flex h-20 w-20 items-center justify-center rounded-full bg-black/5 text-brand-on-surface-variant backdrop-blur transition-transform duration-200 ease-out hover:bg-red-500/15 hover:text-red-500 dark:bg-white/10 dark:hover:bg-red-500/20"
        style={{
          transformOrigin: "top right",
          transform: `translate(${-magnet.x}px, ${magnet.y}px) scale(${hover ? HOVER_SCALE : 1})`,
        }}
      >
        <Icon icon={icon} className="h-10 w-10" />
      </button>
    );
  },
);
