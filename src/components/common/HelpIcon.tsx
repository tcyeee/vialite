interface Props {
  /** Tooltip text shown on hover. */
  text: string;
  /** Tooltip position; defaults to top. */
  position?: "top" | "bottom" | "left" | "right";
  /**
   * Badge color scheme. `"default"` is a dark badge for light surfaces;
   * `"light"` is a white badge for dark/colored cards (e.g. the layer-switch
   * cards). Defaults to `"default"`.
   */
  variant?: "default" | "light";
  className?: string;
}

/**
 * A small circular "?" badge with a hover tooltip. Used next to titles/labels
 * to offer inline help. Referred to as "帮助图标" (help icon) across the app.
 *
 * The wrapper is `relative z-40` so its `z-[99]` tooltip floats above neighbouring
 * cards and, critically, above the sticky Navbar (`z-30`) — the pseudo-element
 * tooltip is trapped in this wrapper's stacking context, so the wrapper's own
 * z-index (not the inner `z-[99]`) is what actually ranks it against the Navbar.
 * Note that a clipping ancestor (`overflow-hidden`) will still crop the tooltip
 * regardless of z-index, so hosts that clip must render it un-clipped.
 */
export function HelpIcon({ text, position = "top", variant = "default", className }: Props) {
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
  return (
    <span
      className={`tooltip ${tooltipPos} relative z-40 before:z-[99] after:z-[99] before:max-w-xs before:whitespace-normal before:content-[attr(data-tip)]${
        className ? ` ${className}` : ""
      }`}
      data-tip={text}
    >
      <span
        className={`flex size-4 cursor-help items-center justify-center rounded-full text-[10px] font-bold ${badge}`}
      >
        ?
      </span>
    </span>
  );
}
