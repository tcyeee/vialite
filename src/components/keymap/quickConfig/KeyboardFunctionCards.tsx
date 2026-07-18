import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { KEYCODE_HELP } from "../keycodeMeta.ts";
import { ExpandableCardColumn, type ExpandableCardDef } from "./ExpandableCardColumn.tsx";

/**
 * One "Keyboard Function" category shown as an expandable card: the device's
 * Lighting keycodes (灯光) or its Custom keycodes (键盘配置). Both are flat
 * keycode lists — the card reveals them as labelled buttons.
 */
export interface KeyboardFnCardGroup {
  /** Translation key for the card heading. */
  titleKey: MessageKey;
  /** mdi icon shown in the card heading, matching the Fn/Media/Mouse cards' glyphs. */
  icon?: string;
  /** Per-card vertical nudge (px) of the enlarged card; positive moves it down. */
  expandedOffsetY?: number;
  /** Per-card horizontal nudge (px) of the enlarged card; positive moves it right. */
  expandedOffsetX?: number;
  entries: KeycodeDef[];
}

interface Props {
  groups: KeyboardFnCardGroup[];
  /** Assign the picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Background colors for the Lighting / Keyboard-Config cards. */
const CARD_BG = ["#3E6E64", "#5E4A6E"];

/**
 * The expanded card body: every keycode as a labelled button with a hover
 * tooltip describing what it does (from the Lighting help table, or a custom
 * keycode's device-provided title).
 *
 * The tooltip is portaled to `document.body` with `position: fixed` — the same
 * escape {@link ../quickConfig/FnMediaMouseCards MediaBody} uses — because the
 * enlarged card is `overflow-hidden` with a scrolling body, so an in-flow
 * tooltip would be clipped by that box.
 */
function KeyList({
  entries,
  onPick,
}: {
  entries: KeycodeDef[];
  onPick: (entry: KeycodeDef) => void;
}) {
  const { t } = useI18n();
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);

  const show = (e: MouseEvent<HTMLButtonElement>, entry: KeycodeDef) => {
    const help = KEYCODE_HELP[entry.qmkId];
    const raw = help ? t(help) : (entry.title ?? entry.qmkId);
    // Drop a trailing sentence period (both ASCII "." and full-width "。").
    const text = raw.replace(/[.。]$/, "");
    const r = e.currentTarget.getBoundingClientRect();
    // Anchor above the button's top-centre; the tip's own transform pulls it up.
    setTip({ text, top: r.top - 8, left: r.left + r.width / 2 });
  };
  const hide = () => setTip(null);

  // A `position: fixed` tip doesn't follow the card's scrolling body, so drop it
  // as soon as anything scrolls (matching MediaBody's portaled tip).
  useEffect(() => {
    if (!tip) return;
    const onScroll = () => setTip(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [tip]);

  return (
    <div className="combo-num-grid flex flex-wrap gap-2">
      {entries.map((entry, j) => (
        <button
          key={entry.qmkId}
          className="combo-item btn btn-sm h-[47px] min-w-[92px] border-white/20 bg-white/10 px-3 font-normal whitespace-nowrap text-white normal-case shadow-none leading-tight hover:border-white/40 hover:bg-white/25"
          style={{ animationDelay: `${Math.min(j * 25, 300)}ms` }}
          onMouseEnter={(e) => show(e, entry)}
          onMouseLeave={hide}
          onClick={() => onPick(entry)}
        >
          {/* Lighting labels carry a two-line "\n" (e.g. "RGB\nRainbow"); flatten
              it to a single space so each key reads on one line. */}
          {(entry.label || entry.qmkId).replace(/\n/g, " ")}
        </button>
      ))}
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

/**
 * The "Keyboard Function" (键盘功能) column's cards — Lighting (灯光) and the
 * device's Custom keycodes (键盘配置) — shown as the same expandable colored
 * cards the Fn/Media/Mouse column uses. Clicking a card floats an enlarged copy
 * on top to reveal every keycode as a labelled button; clicking one assigns it.
 *
 * This is the rightmost card column in the Basic tab, so it grows its enlarged
 * copies leftward (`growLeft`) to avoid spilling past — and being clipped by —
 * the horizontally-scrolling row's right edge.
 */
export function KeyboardFunctionCards({ groups, onPick }: Props) {
  const { t } = useI18n();

  const cards: ExpandableCardDef[] = groups.map((group, i) => {
    const empty = group.entries.length === 0;
    return {
      key: group.titleKey,
      bg: CARD_BG[i % CARD_BG.length],
      disabled: empty,
      expandedWidth: "w-[550px]",
      expandedHeight: "320px",
      // Default the enlarged card 150px down its anchor; a group can nudge from there.
      expandedOffsetY: group.expandedOffsetY ?? 150,
      expandedOffsetX: group.expandedOffsetX ?? 0,
      header: (
        <div className="flex items-center gap-1.5 font-bold tracking-tight">
          {group.icon && (
            <Icon icon={group.icon} className="h-6 w-6 shrink-0 opacity-90" aria-hidden="true" />
          )}
          <span>{t(group.titleKey)}</span>
        </div>
      ),
      hint: empty
        ? "—"
        : `${t("comboCardReveal")} · ${t("comboCardCount", { n: group.entries.length })}`,
      body: empty ? undefined : () => <KeyList entries={group.entries} onPick={onPick} />,
    };
  });

  return <ExpandableCardColumn cards={cards} idPrefix="kbfncard" growLeft />;
}
