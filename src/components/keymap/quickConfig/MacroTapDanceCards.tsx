import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import { useToast } from "../../../contexts/toast.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { ExpandableCardColumn, type ExpandableCardDef } from "./ExpandableCardColumn.tsx";

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
  /** Assign the picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Per-card cosmetic theme, cycled by card position so the cards read differently. */
const THEMES = [
  { bg: "#3E5C6E", watermark: "MACRO" },
  { bg: "#73575E", watermark: "TAP DANCE" },
  { bg: "#4A5C4E", watermark: "COMBO" },
] as const;

/**
 * The card heading icon per category, matching the sidebar nav glyphs (see
 * shell/Sidebar.tsx's NAV_ITEMS) so the Macros / Tap Dance / Combo cards read as
 * the same features as their left-menu entries.
 */
const CARD_ICONS: Partial<Record<MessageKey, string>> = {
  groupMacros: "mdi:script-text-outline",
  groupTapDance: "mdi:animation",
  groupCombo: "mdi:vector-combine",
};

/** A soft two-corner dot pattern echoing the Tap Dance preview cards. */
const CARD_PATTERN =
  "bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-size-[4.95em_4.95em]";

/**
 * The Macros / Tap Dance / Combo cards inside the Basic tab. Clicking a category
 * floats an enlarged copy on top to reveal every slot as a numbered tile;
 * clicking one assigns it. The Combo card is informational only (combos apply on
 * creation, with no key binding) — clicking it pops a toast. Uses the shared
 * {@link ExpandableCardColumn}, matching the Fn/Media/Mouse and Quantum columns.
 */
export function MacroTapDanceCards({ groups, onPick }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const cards: ExpandableCardDef[] = groups.map((group, i) => {
    const theme = THEMES[i % THEMES.length];
    // The Combo card is informational only: it never expands, so it's never
    // "empty" (which would dim/disable a category card).
    const empty = !group.info && group.entries.length === 0;
    return {
      key: group.titleKey,
      bg: theme.bg,
      disabled: empty,
      cardClassName: CARD_PATTERN,
      // Per-card sizing/position of the enlarged copy. Macros and Tap Dance both
      // open to a fixed 177px width nudged 20px left of their anchored edge; the
      // Macro card additionally drops 50px so its enlarged copy clears the card
      // above it.
      ...(group.titleKey === "groupMacros"
        ? {
            expandedWidth: "w-[410px]",
            expandedOffsetX: -20,
            expandedOffsetY: 20,
            expandedUncapped: true,
          }
        : {}),
      ...(group.titleKey === "groupTapDance"
        ? { expandedWidth: "w-[410px]", expandedOffsetX: -20, expandedUncapped: true }
        : {}),
      header: (
        <div className="flex items-center gap-2 font-bold tracking-tight">
          {CARD_ICONS[group.titleKey] && (
            <Icon icon={CARD_ICONS[group.titleKey]!} className="h-6 w-6 shrink-0 opacity-90" />
          )}
          {t(group.titleKey)}
        </div>
      ),
      decor: (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
            {theme.watermark}
          </span>
        </div>
      ),
      overlay: empty ? undefined : (
        <button
          type="button"
          className="absolute right-3 bottom-3 z-10 text-xs font-medium text-white/80 opacity-0 transition-opacity group-hover/expandcard:opacity-100 hover:text-white"
          onClick={(e) => {
            e.stopPropagation();
            group.onEdit();
          }}
        >
          {t("comboCardEdit")} →
        </button>
      ),
      hint: group.info
        ? t("comboCardInfoHint")
        : empty
          ? "—"
          : `${t("comboCardReveal")} · ${t("comboCardUsed", { used: group.used, total: group.total })}`,
      // Combos take effect on creation with no key binding, so the card just
      // explains that via a toast instead of expanding.
      onActivate: group.info ? () => showToast(t("comboAutoApply"), "info") : undefined,
      body:
        group.info || empty
          ? undefined
          : () => (
              <div className="combo-num-grid flex flex-wrap gap-2">
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
              </div>
            ),
    };
  });

  return <ExpandableCardColumn cards={cards} idPrefix="combocard" />;
}
