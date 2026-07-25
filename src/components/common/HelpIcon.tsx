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
 * The badge and the tooltip are ranked independently. The wrapper keeps a plain
 * `relative` (z-index `auto`, so it establishes *no* stacking context) — the badge
 * itself therefore sits at the default layer and won't paint over neighbouring UI.
 * The tooltip's own `before:z-[99] after:z-[99]` then participates directly in the
 * nearest real stacking context, so it still floats above neighbouring cards.
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
      className={`tooltip ${tooltipPos} relative before:z-[99] after:z-[99] before:max-w-xs before:whitespace-normal before:content-[attr(data-tip)]${
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
