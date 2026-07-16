interface Props {
  /** Tooltip text shown on hover. */
  text: string;
  /** Tooltip position; defaults to top. */
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}

/**
 * A small circular "?" badge with a hover tooltip. Used next to titles/labels
 * to offer inline help. Referred to as "帮助图标" (help icon) across the app.
 */
export function HelpIcon({ text, position = "top", className }: Props) {
  const tooltipPos = {
    top: "tooltip-top",
    bottom: "tooltip-bottom",
    left: "tooltip-left",
    right: "tooltip-right",
  }[position];
  return (
    <span
      className={`tooltip ${tooltipPos} before:z-50 after:z-50 before:max-w-xs before:whitespace-normal before:content-[attr(data-tip)]${
        className ? ` ${className}` : ""
      }`}
      data-tip={text}
    >
      <span className="flex size-4 cursor-help items-center justify-center rounded-full bg-brand-on-surface-variant/20 text-[10px] font-bold text-brand-on-surface-variant">
        ?
      </span>
    </span>
  );
}
