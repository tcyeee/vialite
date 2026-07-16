import { useState } from "react";
import { flushSync } from "react-dom";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../protocol/keycodes.ts";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { startViewTransition } from "../common/viewTransition.ts";

/** One function-key category shown as an expandable card (F13–F24, Mouse, Media). */
export interface FnCardGroup {
  /** Translation key for the card heading. */
  titleKey: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
}

interface Props {
  groups: FnCardGroup[];
  /** Assign the picked keycode (routed through KeycodeTabs' pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Background colors cycled across the function-key cards. */
const CARD_BG = ["#3E5C6E", "#6E5A3E", "#5C4E78"];

/**
 * The Fn/Media/Mouse tab's landing view: one card per category (F13–F24, Mouse,
 * Media). Clicking a card expands it inside a View Transition to reveal every
 * keycode as a labelled button; clicking one assigns it. Only one card is open
 * at a time. Mirrors {@link LayerCategoryCards} and {@link MacroTapDanceCards}.
 */
export function FnMediaMouseCards({ groups, onPick }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<string | null>(null);

  /** Toggle a card open/closed, animating the layout change via a View Transition. */
  const toggle = (titleKey: string) => {
    startViewTransition(() =>
      flushSync(() => setExpanded((cur) => (cur === titleKey ? null : titleKey))),
    );
  };

  return (
    <div className="mt-3 flex flex-wrap gap-4">
      {groups.map((group, i) => {
        const isOpen = expanded === group.titleKey;
        const empty = group.entries.length === 0;
        return (
          <div
            key={group.titleKey}
            className={`group/fncard card relative select-none text-brand-background transition-shadow ${
              isOpen ? "w-full" : "w-56"
            } ${empty ? "cursor-default opacity-60" : "cursor-pointer hover:shadow-lg"}`}
            style={{ backgroundColor: CARD_BG[i % CARD_BG.length], viewTransitionName: `fncard-${i}` }}
            onClick={() => !empty && toggle(group.titleKey)}
          >
            <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-white/20 font-medium text-white">
              {t("comboCardCount", { n: group.entries.length })}
            </div>
            <div className="card-body relative gap-3 p-5">
              <div className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
                <span>{t(group.titleKey)}</span>
                {group.helpKey && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <HelpIcon text={t(group.helpKey)} variant="light" />
                  </span>
                )}
              </div>

              {!isOpen ? (
                <div className="text-xs tracking-widest uppercase opacity-40">
                  {empty ? "—" : t("comboCardReveal")}
                </div>
              ) : (
                <div className="combo-num-grid flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {group.entries.map((entry, j) => (
                    <button
                      key={entry.qmkId}
                      className="combo-item btn btn-sm h-auto min-h-8 min-w-12 border-white/20 bg-white/10 py-1 font-normal whitespace-pre-line text-white normal-case hover:border-white/40 hover:bg-white/25"
                      style={{ animationDelay: `${Math.min(j * 25, 300)}ms` }}
                      title={entry.title ?? entry.qmkId}
                      onClick={() => onPick(entry)}
                    >
                      {entry.label || entry.qmkId}
                    </button>
                  ))}
                  <button
                    className="btn btn-sm btn-ghost ml-auto self-start text-white/70 hover:bg-white/15 hover:text-white"
                    onClick={() => toggle(group.titleKey)}
                  >
                    {t("comboCardBack")}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
