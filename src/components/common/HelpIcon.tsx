import { useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";

type Position = "top" | "bottom" | "left" | "right";

interface Props {
  /** Tooltip text shown on hover. */
  text: string;
  /** Tooltip position; defaults to top. */
  position?: Position;
  /**
   * Badge color scheme. `"default"` is a dark badge for light surfaces;
   * `"light"` is a white badge for dark/colored cards (e.g. the layer-switch
   * cards). Defaults to `"default"`.
   */
  variant?: "default" | "light";
  /**
   * Render the tooltip in a portal on `<body>` instead of as the badge's own CSS pseudo-element.
   * Use inside a clipping ancestor (`overflow-*` scroll containers such as the combo table's
   * `overflow-x-auto` wrapper), where the normal tooltip gets cropped no matter its z-index.
   */
  floating?: boolean;
  className?: string;
}

/** Distance between the badge and the floating bubble, matching daisyUI's own tooltip offset. */
const GAP = 8;

/** Places the portalled bubble against the badge's viewport box, on the requested side. */
function floatingStyle(rect: DOMRect, position: Position): CSSProperties {
  switch (position) {
    case "bottom":
      return {
        left: rect.left + rect.width / 2,
        top: rect.bottom + GAP,
        transform: "translate(-50%, 0)",
      };
    case "left":
      return {
        left: rect.left - GAP,
        top: rect.top + rect.height / 2,
        transform: "translate(-100%, -50%)",
      };
    case "right":
      return {
        left: rect.right + GAP,
        top: rect.top + rect.height / 2,
        transform: "translate(0, -50%)",
      };
    default:
      return {
        left: rect.left + rect.width / 2,
        top: rect.top - GAP,
        transform: "translate(-50%, -100%)",
      };
  }
}

/**
 * A small circular "?" badge with a hover tooltip. Used next to titles/labels
 * to offer inline help. Referred to as "帮助图标" (help icon) across the app.
 *
 * The badge and the tooltip are ranked independently. The wrapper keeps a plain
 * `relative` (z-index `auto`, so it establishes *no* stacking context) — the badge
 * itself therefore sits at the default layer and won't paint over neighbouring UI.
 * The tooltip's own `before:z-[99] after:z-[99]` then participates directly in the
 * nearest real stacking context, so it still floats above neighbouring cards.
 * Note that a clipping ancestor (`overflow-hidden`, or any scroll container) will still
 * crop the tooltip regardless of z-index — pass {@link Props.floating} there, which
 * portals the bubble to `<body>` and positions it `fixed` against the badge instead.
 */
export function HelpIcon({
  text,
  position = "top",
  variant = "default",
  floating = false,
  className,
}: Props) {
  // Badge box captured on enter, anchoring the portalled bubble; null while it's hidden.
  const [rect, setRect] = useState<DOMRect | null>(null);

  const tooltipPos = {
    top: "tooltip-top",
    bottom: "tooltip-bottom",
    left: "tooltip-left",
    right: "tooltip-right",
  }[position];
  const badge =
    variant === "light"
      ? "bg-white/25 text-white"
      : "bg-brand-on-surface-variant/20 text-brand-on-surface-variant";
  const dot = (
    <span
      className={`flex size-4 cursor-help items-center justify-center rounded-full text-[10px] font-bold ${badge}`}
    >
      ?
    </span>
  );

  if (!floating) {
    return (
      <span
        className={`tooltip ${tooltipPos} relative before:z-[99] after:z-[99] before:max-w-xs before:whitespace-normal before:content-[attr(data-tip)]${
          className ? ` ${className}` : ""
        }`}
        data-tip={text}
      >
        {dot}
      </span>
    );
  }

  const show = (e: ReactMouseEvent<HTMLElement>) => setRect(e.currentTarget.getBoundingClientRect());

  return (
    <span
      className={`relative inline-flex${className ? ` ${className}` : ""}`}
      onMouseEnter={show}
      onMouseLeave={() => setRect(null)}
    >
      {dot}
      {rect &&
        createPortal(
          <span
            role="tooltip"
            className="pointer-events-none fixed z-[99] max-w-xs rounded-md bg-neutral px-2 py-1 text-center text-xs whitespace-normal text-neutral-content shadow-lg"
            style={floatingStyle(rect, position)}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
