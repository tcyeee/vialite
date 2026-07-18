import { type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { KEYCODE_HELP } from "../keycodeMeta.ts";
import { HelpIcon } from "../../common/HelpIcon.tsx";
import { ExpandableCardColumn, type ExpandableCardDef } from "./ExpandableCardColumn.tsx";
import { TileRevealBody } from "./TileRevealBody.tsx";

/** One function-key category shown as an expandable card (F13–F24, Mouse, Media). */
export interface FnCardGroup {
  /** Translation key for the card heading. */
  titleKey: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
  /**
   * Render the revealed keycodes as square `combo-num-card` tiles (the same
   * look as the Macros/Tap Dance cards) instead of the wider labelled pill
   * buttons. Used for the F13–F24 card, whose short labels fit the fixed
   * square tiles.
   */
  grid?: boolean;
  /**
   * Render the revealed keycodes with the bespoke Mouse layout: pointer-move
   * and wheel keys laid out as arrow-key crosses (↑ over ← ↓ →) and the
   * remaining buttons/speed keys below. Reuses the same square `combo-num-card`
   * tile look as {@link grid}. Only the Mouse card sets this.
   */
  mouse?: boolean;
  /**
   * mdi icon shown in the card heading, matching the Macros/Tap Dance cards'
   * heading glyphs (see {@link MacroTapDanceCards}). Set on the Layer card.
   */
  icon?: string;
  /**
   * A placeholder card with no keycodes yet: the card stays expandable and its
   * revealed body renders this node instead of the keycode list. Used by the
   * "Layer" card while its real content is being built out. Placeholder cards
   * also adopt the Macros-style dot pattern + watermark, keyed by
   * {@link watermark}.
   */
  placeholder?: ReactNode;
  /** Faint rotated watermark text shown behind a {@link placeholder} card. */
  watermark?: string;
  /** A top-right action on the expanded card (e.g. the Mouse card's "详细设置" jump). */
  expandedAction?: ReactNode;
  /**
   * Force the card dimmed and non-interactive regardless of content. Set by
   * QuickConfigPanel when a dual-role cap's tap half is selected — only basic
   * keycodes are valid there, so the Layer card is greyed out.
   */
  disabled?: boolean;
}

interface Props {
  groups: FnCardGroup[];
  /** Assign the picked keycode (routed through QuickConfigPanel's pick handler). */
  onPick: (entry: KeycodeDef) => void;
}

/** Background colors cycled across the function-key cards. */
const CARD_BG = ["#3E5C6E", "#6E5A3E", "#5C4E78"];

/**
 * A soft two-corner dot pattern echoing the Macros/Tap Dance cards, applied to
 * placeholder cards so the Layer card reads as the same family as its neighbours.
 */
const CARD_PATTERN =
  "bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-size-[4.95em_4.95em]";

/** A single square Mouse tile, styled like the F13–F24 grid's `combo-num-card`. */
function MouseTile({
  entry,
  text,
  delay,
  wide,
  icon,
  onPick,
}: {
  entry: KeycodeDef;
  /** Compact glyph/label to show (e.g. "↑", "1", "Slow"). */
  text: string;
  delay: number;
  /** Let the tile grow past the fixed square for a word label (Slow/Med/Fast). */
  wide?: boolean;
  /** mdi icon rendered above the label (the mouse glyph on the button tiles). */
  icon?: string;
  onPick: (entry: KeycodeDef) => void;
}) {
  return (
    <button
      className="combo-num-card"
      style={{
        animationDelay: `${delay}ms`,
        ...(wide ? { width: "auto", paddingInline: "0.6rem", fontSize: "0.8rem" } : {}),
      }}
      title={entry.title ?? entry.qmkId}
      onClick={() => onPick(entry)}
    >
      {icon ? (
        <span className="flex flex-col items-center gap-0.5 leading-none">
          <Icon icon={icon} className="text-lg" aria-hidden="true" />
          <span className="text-[0.7rem]">{text}</span>
        </span>
      ) : (
        text
      )}
    </button>
  );
}

/** A tiny placeholder holding an empty cell in a mouse cross (the blank corners). */
function MouseGap() {
  return <span className="pointer-events-none h-11 w-11" aria-hidden />;
}

/**
 * One arrow-key cross for a directional group (pointer move or wheel): the up
 * key sits centred over a bottom row of left/down/right, matching a keyboard's
 * inverted-T arrow cluster.
 */
function MouseCross({
  label,
  up,
  left,
  down,
  right,
  baseDelay,
  onPick,
}: {
  label: string;
  up?: KeycodeDef;
  left?: KeycodeDef;
  down?: KeycodeDef;
  right?: KeycodeDef;
  baseDelay: number;
  onPick: (entry: KeycodeDef) => void;
}) {
  const glyph = (e?: KeycodeDef) => (e?.label ?? "").split("\n").pop() ?? "";
  const tile = (e: KeycodeDef | undefined, i: number) =>
    e ? (
      <MouseTile entry={e} text={glyph(e)} delay={baseDelay + i * 30} onPick={onPick} />
    ) : (
      <MouseGap />
    );
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="text-[0.7rem] font-semibold tracking-wide uppercase opacity-60">{label}</div>
      <div className="grid grid-cols-3 gap-1.5">
        <MouseGap />
        {tile(up, 0)}
        <MouseGap />
        {tile(left, 1)}
        {tile(down, 2)}
        {tile(right, 3)}
      </div>
    </div>
  );
}

/**
 * The expanded Mouse card body: pointer-move and wheel keys as two arrow crosses
 * side by side, with the mouse buttons and speed keys in rows underneath.
 */
function MouseBody({
  entries,
  onPick,
}: {
  entries: KeycodeDef[];
  onPick: (entry: KeycodeDef) => void;
}) {
  const { t } = useI18n();
  const by = (id: string) => entries.find((e) => e.qmkId === id);
  const buttons = [1, 2, 3, 4, 5].map((n) => by(`KC_BTN${n}`)).filter((e): e is KeycodeDef => !!e);
  const speeds: [string, string][] = [
    ["KC_ACL0", "Slow"],
    ["KC_ACL1", "Med"],
    ["KC_ACL2", "Fast"],
  ];
  return (
    <div className="combo-num-grid flex flex-col items-center gap-5">
      <div className="flex justify-center gap-6">
        <MouseCross
          label={t("groupMouseMove")}
          up={by("KC_MS_U")}
          left={by("KC_MS_L")}
          down={by("KC_MS_D")}
          right={by("KC_MS_R")}
          baseDelay={0}
          onPick={onPick}
        />
        <MouseCross
          label={t("groupMouseWheel")}
          up={by("KC_WH_U")}
          left={by("KC_WH_L")}
          down={by("KC_WH_D")}
          right={by("KC_WH_R")}
          baseDelay={120}
          onPick={onPick}
        />
      </div>
      <div className="flex flex-wrap items-start justify-start gap-6">
        {buttons.length > 0 && (
          <div className="flex flex-col items-start gap-1.5">
            <div className="text-[0.7rem] font-semibold tracking-wide uppercase opacity-60">
              {t("groupMouseButtons")}
            </div>
            <div className="flex flex-wrap justify-start gap-1.5">
              {buttons.map((e, i) => (
                <MouseTile
                  key={e.qmkId}
                  entry={e}
                  text={String(i + 1)}
                  icon="mdi:mouse-outline"
                  delay={240 + i * 30}
                  onPick={onPick}
                />
              ))}
            </div>
          </div>
        )}
        {speeds.some(([id]) => by(id)) && (
          <div className="flex flex-col items-start gap-1.5">
            <div className="text-[0.7rem] font-semibold tracking-wide uppercase opacity-60">
              {t("groupMouseSpeed")}
            </div>
            <div className="flex flex-wrap justify-start gap-1.5">
              {speeds.map(([id, text], i) => {
                const e = by(id);
                return e ? (
                  <MouseTile
                    key={id}
                    entry={e}
                    text={text}
                    delay={360 + i * 30}
                    wide
                    onPick={onPick}
                  />
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The expanded Media card body: every media keycode as a labelled button with a
 * hover tooltip describing what the key does. Delegates to the shared
 * {@link TileRevealBody} (also used by the Quantum "Other" card) so the tile
 * look, no-wrap labels, and portaled tooltip stay identical across both cards.
 */
function MediaBody({
  entries,
  onPick,
}: {
  entries: KeycodeDef[];
  onPick: (entry: KeycodeDef) => void;
}) {
  const { t } = useI18n();
  const helpFor = (entry: KeycodeDef) => {
    const help = KEYCODE_HELP[entry.qmkId];
    return help ? t(help) : undefined;
  };
  return <TileRevealBody entries={entries} onPick={onPick} helpFor={helpFor} />;
}

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
    const empty = group.entries.length === 0 && !group.placeholder;
    return {
      key: group.titleKey,
      bg: CARD_BG[i % CARD_BG.length],
      disabled: empty || group.disabled,
      expandedAction: group.expandedAction,
      // Placeholder cards adopt the Macros-style dot pattern (see CARD_PATTERN).
      ...(group.placeholder ? { cardClassName: CARD_PATTERN } : {}),
      // Nudge every enlarged Fn/Media/Mouse card 20px left of its anchored edge.
      expandedOffsetX: -20,
      header: (
        <div className="flex items-center gap-1.5 font-bold tracking-tight">
          {group.mouse && <Icon icon="mdi:mouse-outline" aria-hidden="true" />}
          {group.icon && (
            <Icon icon={group.icon} className="h-6 w-6 shrink-0 opacity-90" aria-hidden="true" />
          )}
          <span>{t(group.titleKey)}</span>
          {group.helpKey && (
            <span onClick={(e) => e.stopPropagation()}>
              <HelpIcon text={t(group.helpKey)} variant="light" />
            </span>
          )}
        </div>
      ),
      // A faint rotated watermark behind the placeholder card, echoing the
      // Macros/Tap Dance cards' background lettering.
      decor: group.watermark ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
          <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
            {group.watermark}
          </span>
        </div>
      ) : undefined,
      hint: empty
        ? "—"
        : group.placeholder
          ? t("comboCardReveal")
          : `${t("comboCardReveal")} · ${t("comboCardCount", { n: group.entries.length })}`,
      // F13–F24 opens as a fixed 6-column grid (12 keys → 2 tidy rows), and the
      // Mouse card as its bespoke cross layout. Both use symmetric padding and no
      // scroll gutter so all four margins around the tiles stay equal; the Mouse
      // card sizes to its content (`w-fit`) while F13–F24 keeps its fixed width.
      ...(group.grid
        ? { expandedWidth: "w-[400px]", expandedPadding: "p-7", noScroll: true }
        : {}),
      ...(group.mouse
        ? {
            expandedWidth: "w-[400px]",
            expandedHeight: "400px",
            expandedOffsetX: -100,
            expandedOffsetY: -100,
            expandedPadding: "p-7",
            noScroll: true,
          }
        : {}),
      // The Media card (neither grid nor mouse) opens to a fixed 411×319 box; its
      // labelled buttons scroll within that height.
      ...(!group.grid && !group.mouse && !group.placeholder
        ? { expandedWidth: "w-[810px]", expandedHeight: "430px", expandedOffsetY: 100, expandedOffsetX: -300 }
        : {}),
      // The placeholder Layer card opens to a 412px-wide box holding its picker;
      // it grows to content height (uncapped) so its layer-number grid is never
      // clipped.
      ...(group.placeholder
        ? { expandedWidth: "w-[520px]", noScroll: true, expandedUncapped: true }
        : {}),
      body: empty
        ? undefined
        : group.placeholder
          ? () => <div className="text-sm text-white">{group.placeholder}</div>
          : group.mouse
          ? () => <MouseBody entries={group.entries} onPick={onPick} />
          : group.grid
          ? () => (
              <div className="combo-num-grid grid grid-cols-6 gap-2">
                {group.entries.map((entry, j) => (
                  <button
                    key={entry.qmkId}
                    className="combo-num-card"
                    style={{ animationDelay: `${Math.min(j * 30, 400)}ms` }}
                    title={entry.title ?? entry.qmkId}
                    onClick={() => onPick(entry)}
                  >
                    {entry.label || entry.qmkId}
                  </button>
                ))}
              </div>
            )
          : () => <MediaBody entries={group.entries} onPick={onPick} />,
    };
  });

  return <ExpandableCardColumn cards={cards} idPrefix="fncard" />;
}
