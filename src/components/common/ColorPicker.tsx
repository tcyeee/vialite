import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorInput, HexColorPicker } from "react-colorful";

/** Palette offered under the picker — neutrals a keyboard case/plate/legend usually is. */
const PRESETS = [
  "#ffffff",
  "#e4e3db",
  "#b0b0b0",
  "#6b6b6b",
  "#2b2b2b",
  "#000000",
  "#d94f4f",
  "#e08b3c",
  "#e5c34a",
  "#4f9e5a",
  "#3d7bd9",
  "#8b5cd9",
];

interface Props {
  /** Current color, a `#rrggbb` string. */
  value: string;
  /** Fired continuously while dragging, so the preview tracks the pointer. */
  onChange: (color: string) => void;
  /** Fired once when the popover closes — the point at which a pick is "finished". */
  onCommit?: (color: string) => void;
  /** Accessible label / tooltip for the trigger swatch. */
  label: string;
  disabled?: boolean;
}

/**
 * Color picker used by the 个性化 appearance rows, replacing the native
 * `<input type="color">` (whose popup is the OS color dialog — unstyleable, and
 * jarringly different per platform).
 *
 * The trigger is a swatch button; the panel is a react-colorful saturation area +
 * hue bar plus a hex field and a preset row. Like {@link RenumberPicker} it's a
 * controlled popover portaled to `document.body` with a fixed position anchored to
 * the trigger — the settings rows scroll under a sticky preview, so an in-flow
 * `absolute` panel would be clipped by the row list's rounded/overflow box.
 *
 * `onChange` fires on every drag frame (live preview); `onCommit` fires once on
 * close, which is what callers use to push onto their recent-colors list so
 * dragging through the spectrum doesn't spam history.
 */
export function ColorPicker({ value, onChange, onCommit, label, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  // Read in the close handler rather than closing over `value`, which would be
  // stale by the time the outside-click listener runs.
  const valueRef = useRef(value);
  valueRef.current = value;

  const close = () => {
    setOpen(false);
    onCommit?.(valueRef.current);
  };

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const width = 232;
    // Right-align to the trigger (these rows sit at the panel's right edge, so a
    // left-aligned panel would hang off-screen), clamped into the viewport.
    const left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
    // Open upwards: the trigger swatches sit low in the settings rows, so a panel
    // below often lands under the fold. Fall back to below when there isn't room
    // above (measured, since the panel's height depends on the preset rows).
    const height = panelRef.current?.offsetHeight ?? 0;
    const above = r.top - 6 - height;
    setPos({ top: above >= 8 ? above : r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    // A fixed panel doesn't follow the trigger as the settings list scrolls.
    const onScroll = () => close();
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => (open ? close() : setOpen(true))}
        // The checkerboard shows through nothing today (colors are always opaque),
        // but keeps the swatch legible if an alpha-capable picker lands later.
        className="h-8 w-14 cursor-pointer rounded border border-brand-outline/40 disabled:cursor-not-allowed disabled:opacity-50"
        style={{ backgroundColor: value }}
        title={`${label}: ${value}`}
        aria-label={`${label}: ${value}`}
      />
      {open &&
        createPortal(
          <div
            ref={panelRef}
            data-lenis-prevent
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 232 }}
            className="vialite-color-picker z-50 flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
          >
            <HexColorPicker color={value} onChange={onChange} />
            <div className="flex items-center gap-2">
              <span
                className="h-7 w-7 shrink-0 rounded border border-brand-outline/40"
                style={{ backgroundColor: value }}
              />
              <label className="input input-sm flex flex-1 items-center gap-1">
                <span className="opacity-50">#</span>
                <HexColorInput
                  color={value}
                  onChange={onChange}
                  className="w-full bg-transparent uppercase tabular-nums outline-none"
                  aria-label={label}
                />
              </label>
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChange(preset)}
                  className={
                    "h-6 w-full rounded border" +
                    (preset.toLowerCase() === value.toLowerCase()
                      ? " border-brand-on-surface ring-1 ring-brand-on-surface"
                      : " border-brand-outline/40")
                  }
                  style={{ backgroundColor: preset }}
                  title={preset}
                  aria-label={preset}
                />
              ))}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
