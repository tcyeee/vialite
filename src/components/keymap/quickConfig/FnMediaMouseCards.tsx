import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { HelpIcon } from "../../common/HelpIcon.tsx";
import { ExpandableCardColumn, type ExpandableCardDef } from "./ExpandableCardColumn.tsx";

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
  /** Assign the picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Background colors cycled across the function-key cards. */
const CARD_BG = ["#3E5C6E", "#6E5A3E", "#5C4E78"];

/**
 * The Fn/Media/Mouse cards inside the Basic tab: one card per category (F13–F24,
 * Mouse, Media). Clicking a card floats an enlarged copy on top to reveal every
 * keycode as a labelled button; clicking one assigns it. Uses the shared
 * {@link ExpandableCardColumn}, the same layout the Combo Keys and Quantum
 * columns use.
 */
export function FnMediaMouseCards({ groups, onPick }: Props) {
  const { t } = useI18n();

  const cards: ExpandableCardDef[] = groups.map((group, i) => {
    const empty = group.entries.length === 0;
    return {
      key: group.titleKey,
      bg: CARD_BG[i % CARD_BG.length],
      disabled: empty,
      header: (
        <div className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
          <span>{t(group.titleKey)}</span>
          {group.helpKey && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpIcon text={t(group.helpKey)} variant="light" />
            </span>
          )}
        </div>
      ),
      overlay: (
        <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-white/20 font-medium text-white">
          {t("comboCardCount", { n: group.entries.length })}
        </div>
      ),
      hint: empty ? "—" : t("comboCardReveal"),
      body: empty
        ? undefined
        : () => (
            <div className="combo-num-grid flex flex-wrap gap-2">
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
            </div>
          ),
    };
  });

  return <ExpandableCardColumn cards={cards} idPrefix="fncard" />;
}
