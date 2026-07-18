import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { LAYER_GROUPS } from "../keycodeMeta.ts";

interface Props {
  /** The full "Layers" keycode list (MO(0)…DF(15) plus FN_MO*), used to resolve
   *  the concrete keycode once a type + layer number are chosen. */
  layerEntries: KeycodeDef[];
  /** Layers the connected keyboard exposes — the 层编号 square count. */
  layerCount: number;
  /** Assign the resolved keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** A distinct icon tint per layer-switch type, so the 层类型 row reads as six
 *  colour-coded layer glyphs rather than plain text. */
const LAYER_TYPE_COLORS: Record<string, string> = {
  MO: "#6EC1E4",
  TG: "#7DD87D",
  TT: "#E4B36E",
  OSL: "#C08CE4",
  TO: "#E48C8C",
  DF: "#E4D96E",
};

/** The six layer-switch functions offered as the 层类型 row, reusing the shared
 *  {@link LAYER_GROUPS} metadata so the labels/help stay in sync with the tab. */
const LAYER_TYPES = LAYER_GROUPS.map((g) => ({
  fn: g.key,
  helpKey: g.helpKey,
  color: LAYER_TYPE_COLORS[g.key] ?? "#9AA7B0",
}));

/**
 * The expanded 层按键 card body: a two-step picker. First the user chooses a
 * layer-switch type (MO / TG / TT / OSL / TO / DF) from the 层类型 row; that
 * enables the 层编号 grid of the keyboard's layer numbers, which stays greyed out
 * until a type is picked. Choosing a number resolves the concrete keycode
 * (e.g. `MO(3)`) and assigns it.
 */
export function LayerKeyPicker({ layerEntries, layerCount, onPick }: Props) {
  const { t } = useI18n();
  const [fn, setFn] = useState<string | null>(null);
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);

  const pickNum = (num: number) => {
    if (!fn) return;
    const entry = layerEntries.find((e) => e.qmkId === `${fn}(${num})`);
    if (entry) onPick(entry);
  };

  // The enlarged card is `overflow-hidden`, so an in-flow daisyUI tooltip would
  // be clipped by it. Portal the tip to `document.body` with `position: fixed`
  // (the same escape the Media card uses) so it sits above every stacking box.
  const showTip = (e: MouseEvent<HTMLButtonElement>, helpKey?: MessageKey) => {
    if (!helpKey) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTip({ text: t(helpKey), top: r.top - 8, left: r.left + r.width / 2 });
  };
  const hideTip = () => setTip(null);

  // A `position: fixed` tip doesn't follow the card's scrolling body, so drop it
  // as soon as anything scrolls (matching the Media card's portaled tip).
  useEffect(() => {
    if (!tip) return;
    const onScroll = () => setTip(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [tip]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-2 text-xs font-semibold tracking-wide uppercase opacity-60">
          {t("layerPickType")}
        </div>
        <div className="combo-num-grid flex flex-wrap gap-2">
          {LAYER_TYPES.map((type, i) => {
            const active = fn === type.fn;
            // Once a type is chosen, dim the others so the selection stands out.
            const dimmed = fn !== null && !active;
            return (
              <button
                key={type.fn}
                className={`combo-num-card !w-auto gap-1.5 px-3 transition-opacity ${
                  active ? "!border-white/70 !bg-white/30 ring-2 ring-white/50" : ""
                } ${dimmed ? "opacity-40 hover:opacity-100" : ""}`}
                style={{ minWidth: "3.5rem", animationDelay: `${Math.min(i * 25, 200)}ms` }}
                onClick={() => setFn(type.fn)}
                onMouseEnter={(e) => showTip(e, type.helpKey)}
                onMouseLeave={hideTip}
              >
                <Icon
                  icon="mdi:layers"
                  className="text-base"
                  style={{ color: type.color }}
                  aria-hidden="true"
                />
                {type.fn}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-xs font-semibold tracking-wide uppercase opacity-60">
            {t("layerPickNum")}
          </span>
          {!fn && <span className="text-[0.7rem] opacity-40">{t("layerPickNumHint")}</span>}
        </div>
        <div
          className={`combo-num-grid flex flex-wrap gap-2 ${
            fn ? "" : "pointer-events-none opacity-40"
          }`}
        >
          {Array.from({ length: layerCount }, (_, num) => (
            <button
              key={num}
              className="combo-num-card"
              disabled={!fn}
              style={{ animationDelay: `${Math.min(num * 20, 300)}ms` }}
              onClick={() => pickNum(num)}
            >
              {num}
            </button>
          ))}
        </div>
      </div>

      {tip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: tip.top,
              left: tip.left,
              transform: "translate(-50%, -100%)",
            }}
            className="pointer-events-none z-[999] max-w-xs rounded-md bg-neutral px-2 py-1 text-xs whitespace-normal text-neutral-content shadow-lg"
          >
            {tip.text}
          </div>,
          document.body,
        )}
    </div>
  );
}
