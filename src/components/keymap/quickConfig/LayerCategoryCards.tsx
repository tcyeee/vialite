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

/** Stacked-layers glyph shown on each layer-function card heading. */
function LayersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M0 0h24v24H0z" fill="none" />
      <path
        fill="currentColor"
        d="m13.387 3.425l6.365 4.243a1 1 0 0 1 0 1.664l-6.365 4.244a2.5 2.5 0 0 1-2.774 0L4.248 9.332a1 1 0 0 1 0-1.664l6.365-4.243a2.5 2.5 0 0 1 2.774 0m6.639 8.767a2 2 0 0 1-.577.598l-6.05 4.084a2.5 2.5 0 0 1-2.798 0l-6.05-4.084a2 2 0 0 1-.779-2.29l6.841 4.56a2.5 2.5 0 0 0 2.613.098l.16-.098l6.841-4.56a2 2 0 0 1-.201 1.692m0 3.25a2 2 0 0 1-.577.598l-6.05 4.084a2.5 2.5 0 0 1-2.798 0l-6.05-4.084a2 2 0 0 1-.779-2.29l6.841 4.56a2.5 2.5 0 0 0 2.613.098l.16-.098l6.841-4.56a2 2 0 0 1-.201 1.692"
      />
    </svg>
  );
}

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
        <div className="flex items-center gap-1.5 text-xl font-bold tracking-tight">
          <LayersIcon />
          <span>{t(group.titleKey)}</span>
          {group.helpKey && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpIcon text={t(group.helpKey)} variant="light" />
            </span>
          )}
        </div>
      ),
      overlay: (
        <>
          {group.titleKey === "groupLayerMO" && (
            <div className="badge badge-sm absolute -top-2 -left-2 z-20 border-none bg-amber-400 font-semibold text-brand-background shadow">
              {t("layerCardCommon")}
            </div>
          )}
          <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-white/20 font-medium text-white">
            {t("comboCardCount", { n: group.entries.length })}
          </div>
        </>
      ),
      hint: empty ? "—" : t("comboCardReveal"),
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
