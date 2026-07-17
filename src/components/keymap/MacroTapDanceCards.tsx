import { useState } from "react";
import { flushSync } from "react-dom";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import { useToast } from "../../contexts/toast.tsx";
import type { KeycodeDef } from "../../protocol/keycodes.ts";
import { startViewTransition } from "../common/viewTransition.ts";

/** One expandable category shown as a card (Macros or Tap Dance). */
export interface ComboGroup {
  /** Translation key for the card heading. */
  titleKey: MessageKey;
  entries: KeycodeDef[];
  /** Number of slots already configured, for the "共计(used/total)个" badge. */
  used: number;
  /** Total slots available on the device. */
  total: number;
  /**
   * Per-slot "already configured" flags, indexed like {@link entries}. Slots
   * marked true get a dot on their numbered tile. Absent on {@link info} cards.
   */
  configured?: boolean[];
  /** Jump to this category's dedicated editor page (the hover "编辑" action). */
  onEdit: () => void;
  /**
   * Marks a purely informational card (Combo): it never expands and has no
   * keycodes to assign. Clicking it pops a toast explaining that combos apply
   * automatically. Its {@link entries} are ignored.
   */
  info?: boolean;
}

interface Props {
  groups: ComboGroup[];
  /** Assign the picked keycode (routed through KeycodeTabs' pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Per-card cosmetic theme, cycled by card position so the cards read differently. */
const THEMES = [
  { bg: "#3E5C6E", watermark: "MACRO" },
  { bg: "#73575E", watermark: "TAP DANCE" },
  { bg: "#4A5C4E", watermark: "COMBO" },
] as const;

/**
 * The Combo Keys tab's landing view: one card per category (Macros, Tap Dance),
 * styled after the Tap Dance preview cards. Clicking a card expands it — inside a
 * View Transition so the morph animates — to reveal every keycode in that
 * category; clicking one of those assigns it. Only one card is open at a time.
 */
export function MacroTapDanceCards({ groups, onPick }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
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
        const theme = THEMES[i % THEMES.length];
        const isOpen = expanded === group.titleKey;
        // The Combo card is informational only: it never expands, so it's never
        // "empty" (which would dim/disable a category card).
        const empty = !group.info && group.entries.length === 0;
        // Combos take effect on creation with no key binding, so clicking the
        // card just explains that via a toast instead of expanding.
        const onCardClick = group.info
          ? () => showToast(t("comboAutoApply"), "info")
          : () => !empty && toggle(group.titleKey);
        return (
          <div
            key={group.titleKey}
            className={`group/combocard card relative select-none overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-size-[4.95em_4.95em] text-brand-background transition-shadow ${
              isOpen ? "w-full" : "w-64"
            } ${empty ? "cursor-default opacity-60" : "cursor-pointer hover:shadow-lg"}`}
            style={{ backgroundColor: theme.bg, viewTransitionName: `combocard-${i}` }}
            onClick={onCardClick}
          >
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
              <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
                {theme.watermark}
              </span>
            </div>
            <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-white/20 font-medium text-white">
              {empty
                ? t("comboCardEmpty")
                : t("comboCardUsed", { used: group.used, total: group.total })}
            </div>
            {!empty && !isOpen && (
              <button
                type="button"
                className="absolute right-3 bottom-3 z-10 text-xs font-medium text-white/80 opacity-0 transition-opacity group-hover/combocard:opacity-100 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  group.onEdit();
                }}
              >
                {t("comboCardEdit")} →
              </button>
            )}
            <div className="card-body relative gap-3 p-5">
              <div className="text-3xl font-bold tracking-tight">{t(group.titleKey)}</div>

              {group.info ? (
                <div className="text-xs tracking-widest uppercase opacity-40">
                  {t("comboCardInfoHint")}
                </div>
              ) : !isOpen ? (
                <div className="text-xs tracking-widest uppercase opacity-40">
                  {empty ? "—" : t("comboCardReveal")}
                </div>
              ) : (
                <div className="combo-num-grid flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                  {group.entries.map((entry, j) => (
                    <button
                      key={entry.qmkId}
                      className="combo-num-card relative"
                      style={{ animationDelay: `${Math.min(j * 30, 400)}ms` }}
                      title={entry.title ?? entry.qmkId}
                      onClick={() => onPick(entry)}
                    >
                      {j + 1}
                      {group.configured?.[j] && (
                        <span
                          className="absolute top-1 right-1 size-1.5 rounded-full bg-white"
                          title={t("comboSlotConfigured")}
                        />
                      )}
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
