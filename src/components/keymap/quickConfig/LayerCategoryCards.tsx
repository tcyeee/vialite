import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { HelpIcon } from "../../common/HelpIcon.tsx";
import { ExpandableCardColumn, type ExpandableCardDef } from "./ExpandableCardColumn.tsx";

/** One layer-switch function shown as an expandable card (MO, TG, …, Other). */
export interface LayerCardGroup {
  /** Translation key for the card heading. */
  titleKey: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
}

interface Props {
  groups: LayerCardGroup[];
  /** Assign the picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Background colors cycled across the seven layer-function cards. */
const CARD_BG = ["#3E5C6E", "#4A5478", "#5C4E78", "#73575E", "#6E5A3E", "#3E6E5C", "#555A66"];

/** Cards per column before wrapping into the next column (7 cards → 4 + 3). */
const CARDS_PER_COLUMN = 4;

/** Extract the trailing "(n)" layer index for a compact inner label, else null. */
function shortNum(qmkId: string): string | null {
  const m = /\((\d+)\)$/.exec(qmkId);
  return m ? m[1] : null;
}

/**
 * The Layers tab's landing view: one card per layer-switch function (MO, TG, TT,
 * OSL, TO, DF, Other) — seven in all. Clicking a card floats an enlarged copy on
 * top to reveal every target layer as a square number card; clicking one assigns
 * it. Uses the shared {@link ExpandableCardColumn}, the same layout and expansion
 * the Fn/Media/Mouse, Combo Keys, and Quantum columns use. The seven cards lay
 * out as two side-by-side columns (4 + 3) rather than one tall stack.
 */
export function LayerCategoryCards({ groups, onPick }: Props) {
  const { t } = useI18n();

  /** Build one expandable card; `i` is the global index (for colour + name). */
  const toCard = (group: LayerCardGroup, i: number): ExpandableCardDef => {
    const empty = group.entries.length === 0;
    return {
      key: group.titleKey,
      bg: CARD_BG[i % CARD_BG.length],
      disabled: empty,
      header: (
        <div className="flex items-center gap-1.5 text-2xl font-bold tracking-tight">
          <Icon icon="mdi:layers" aria-hidden="true" />
          <span>{t(group.titleKey)}</span>
          {group.helpKey && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpIcon text={t(group.helpKey)} variant="light" />
            </span>
          )}
        </div>
      ),
      overlay:
        group.titleKey === "groupLayerMO" ? (
          <div className="badge badge-sm absolute -top-2 -left-2 z-20 border-none bg-amber-400 font-semibold text-brand-background shadow">
            {t("layerCardCommon")}
          </div>
        ) : undefined,
      hint: empty
        ? "—"
        : `${t("comboCardReveal")} · ${t("comboCardCount", { n: group.entries.length })}`,
      body: empty
        ? undefined
        : () => (
            <div className="combo-num-grid flex flex-wrap gap-2">
              {group.entries.map((entry, j) => {
                const num = shortNum(entry.qmkId);
                return num ? (
                  <button
                    key={entry.qmkId}
                    className="combo-num-card"
                    style={{ animationDelay: `${Math.min(j * 25, 300)}ms` }}
                    title={entry.title ?? entry.qmkId}
                    onClick={() => onPick(entry)}
                  >
                    {num}
                  </button>
                ) : (
                  <button
                    key={entry.qmkId}
                    className="combo-item btn btn-sm h-auto min-h-8 min-w-12 border-white/20 bg-white/10 py-1 font-normal whitespace-pre-line text-white normal-case hover:border-white/40 hover:bg-white/25"
                    style={{ animationDelay: `${Math.min(j * 25, 300)}ms` }}
                    title={entry.title ?? entry.qmkId}
                    onClick={() => onPick(entry)}
                  >
                    {entry.label || entry.qmkId}
                  </button>
                );
              })}
            </div>
          ),
    };
  };

  // Lay the cards out in columns of at most CARDS_PER_COLUMN, side by side, so
  // the seven layer-function cards read as two columns (4 + 3) instead of one
  // tall stack. Each column is its own ExpandableCardColumn (distinct idPrefix so
  // their view-transition names don't collide), keeping each card's global index
  // for stable colours.
  const columns: ExpandableCardDef[][] = [];
  for (let i = 0; i < groups.length; i += CARDS_PER_COLUMN)
    columns.push(groups.slice(i, i + CARDS_PER_COLUMN).map((g, gi) => toCard(g, i + gi)));

  return (
    <div className="flex items-start gap-4">
      {columns.map((cards, ci) => (
        <ExpandableCardColumn key={ci} cards={cards} idPrefix={`layercard-${ci}`} />
      ))}
    </div>
  );
}
