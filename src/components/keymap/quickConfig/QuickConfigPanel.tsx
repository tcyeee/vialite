import { useState } from "react";
import {
  KEYCODE_CATEGORIES,
  isBasicQmkId,
  type KeycodeDef,
} from "../../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { HelpIcon } from "../../common/HelpIcon.tsx";
import { useHorizontalWheelScroll } from "../../common/useHorizontalWheelScroll.ts";
import { MacroTapDanceCards } from "./MacroTapDanceCards.tsx";
import { BasicKeyboardGrid } from "./BasicKeyboardGrid.tsx";
import {
  CATEGORY_KEYS,
  KEYCODE_HELP,
  LAYER_GROUPS,
  QUANTUM_GROUPS,
  QUANTUM_GROUP_MISC,
  deviceCategories,
} from "../keycodeMeta.ts";
import { LayerKeyPicker } from "./LayerKeyPicker.tsx";
import { FnMediaMouseCards } from "./FnMediaMouseCards.tsx";
import { QuantumCards } from "./QuantumCards.tsx";
import {
  KeyboardFunctionCards,
  type KeyboardFnCardGroup,
} from "./KeyboardFunctionCards.tsx";

/** Categories hidden from the inline homepage picker. Quantum is not a tab of its
 *  own: it's folded into the Combo Keys tab as a labelled section (below). */
const HIDDEN_CATEGORIES: ReadonlySet<string> = new Set([
  "ISO/International",
  "Navigation",
  "Shifted",
  "Numpad",
  "Quantum",
]);

/** Source categories folded into the Basic tab as the vertical Fn/Media/Mouse cards. */
const MERGE_SOURCES: ReadonlySet<string> = new Set(["Fn keys", "Media", "Mouse"]);

/** Name of the tab that folds Lighting and the device's Custom keycodes into one. */
const KEYBOARD_FN_NAME = "Keyboard Function";

/** A labelled block of keycodes rendered within a tab. */
interface KeycodeGroup {
  /** Translation key for the group heading; omit for an unlabelled block. */
  titleKey?: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
  /** Render the entries in a fixed 4-column grid rather than a flowing wrap. */
  grid?: boolean;
  /**
   * When present, the card body splits {@link entries} into labelled sections
   * (used by the Quantum "Other" card to fold One-Shot Mods in as a section).
   */
  sections?: { titleKey: MessageKey; helpKey?: MessageKey; entries: KeycodeDef[] }[];
}

interface VisibleCategory {
  name: string;
  /** Flat entry list (unlabelled tabs). */
  entries: KeycodeDef[];
  /** When present, the tab renders these labelled sub-groups instead of {@link entries}. */
  groups?: KeycodeGroup[];
}

const entriesOf = (name: string): KeycodeDef[] =>
  KEYCODE_CATEGORIES.find((c) => c.name === name)?.entries ?? [];

/**
 * Used/total slot counts and the "编辑" jump target for one Combo Keys card,
 * keyed off the sub-group's heading (Macros vs Tap Dance).
 */
function comboMeta(
  keyboard: Keyboard,
  titleKey: MessageKey,
  onNavigate: (target: ComboEditTarget) => void,
): { used: number; total: number; onEdit: () => void; configured: boolean[] } {
  if (titleKey === "groupTapDance") {
    const configured = keyboard.tapDanceEntries.map(
      (e) =>
        e.onTap !== "KC_NO" ||
        e.onHold !== "KC_NO" ||
        e.onDoubleTap !== "KC_NO" ||
        e.onTapHold !== "KC_NO",
    );
    return {
      used: configured.filter(Boolean).length,
      total: keyboard.tapDanceCount,
      onEdit: () => onNavigate("tapdance"),
      configured,
    };
  }
  const configured = keyboard.macros.map((m) => m.length > 0);
  return {
    used: configured.filter(Boolean).length,
    total: keyboard.macroCount,
    onEdit: () => onNavigate("macro"),
    configured,
  };
}

/**
 * Split the flat "Quantum" list into one-shot mods, held modifiers, mod-tap,
 * layer-tap, and everything else — partitioned by qmk_id shape.
 */
function quantumGroups(): KeycodeGroup[] {
  const src = entriesOf("Quantum");
  const metaFor = (key: string) => QUANTUM_GROUPS.find((g) => g.key === key)!;
  // Top-level cards: held mods, mod-tap, layer-tap (in that order).
  const groups: KeycodeGroup[] = ["mods", "modtap", "layertap"]
    .map((key) => {
      const g = metaFor(key);
      return { titleKey: g.titleKey, helpKey: g.helpKey, entries: src.filter((e) => g.match(e.qmkId)) };
    })
    .filter((g) => g.entries.length > 0);
  // One-Shot Mods and everything that fits no group are folded into a single
  // "Other" card, shown as two labelled sections inside that card.
  const osm = metaFor("osm");
  const osmEntries = src.filter((e) => osm.match(e.qmkId));
  const miscEntries = src.filter((e) => !QUANTUM_GROUPS.some((g) => g.match(e.qmkId)));
  const otherSections = [
    osmEntries.length > 0 && { titleKey: osm.titleKey, helpKey: osm.helpKey, entries: osmEntries },
    miscEntries.length > 0 && {
      titleKey: QUANTUM_GROUP_MISC.titleKey,
      helpKey: QUANTUM_GROUP_MISC.helpKey,
      entries: miscEntries,
    },
  ].filter((s): s is { titleKey: MessageKey; helpKey: MessageKey; entries: KeycodeDef[] } => Boolean(s));
  if (otherSections.length > 0)
    groups.push({
      titleKey: "groupQuantumOther",
      helpKey: QUANTUM_GROUP_MISC.helpKey,
      entries: [...osmEntries, ...miscEntries],
      sections: otherSections,
    });
  return groups;
}

/**
 * The three Fn/Media/Mouse groups, shown as vertically-stacked expandable cards
 * inside the Basic tab (they used to live in a dedicated "Function" tab). Ordered
 * F13–F24, Mouse, then Media; the F-keys render in a 2×6 grid once expanded.
 */
const FN_MEDIA_MOUSE_GROUPS: KeycodeGroup[] = [
  { titleKey: "groupFnKeys", entries: entriesOf("Fn keys"), grid: true },
  { titleKey: "groupMouse", entries: entriesOf("Mouse") },
  { titleKey: "groupMedia", entries: entriesOf("Media") },
];

/**
 * Visible tabs for the inline picker: hidden categories dropped, and the three
 * small Fn/Media/Mouse groups pulled out entirely — they're rendered inside the
 * Basic tab (see {@link FN_MEDIA_MOUSE_GROUPS}) rather than as a tab of their own.
 */
const VISIBLE_CATEGORIES = (() => {
  const out: VisibleCategory[] = [];
  for (const c of KEYCODE_CATEGORIES) {
    if (HIDDEN_CATEGORIES.has(c.name)) continue;
    // Folded into the Basic tab as vertical cards, not a standalone tab.
    if (MERGE_SOURCES.has(c.name)) continue;
    // The Macros/Tap Dance/Combo + Quantum cards also live inside the Basic tab
    // (its far-right columns), so Macros is no longer a tab of its own.
    if (c.name === "Macros") continue;
    // Layers (层切换) and Lighting → Keyboard Function (键盘功能) are likewise
    // folded into the Basic tab's far-right columns, not standalone tabs.
    if (c.name === "Layers" || c.name === "Lighting") continue;
    out.push({ name: c.name, entries: c.entries });
  }
  return out;
})();

/**
 * Quantum sub-category cards, precomputed once (the display entries are
 * version-independent). Rendered as a labelled section inside the Combo Keys tab
 * rather than as a standalone tab (see {@link QuickConfigPanel}).
 */
const QUANTUM_CARD_GROUPS = quantumGroups();

/**
 * The Quantum column's own cards (Modifiers, Mod-Tap, Layer-Tap) — everything
 * except the catch-all "Other" card, which is relocated to the end of the 其他
 * (categoryOther) column below.
 */
const QUANTUM_MAIN_GROUPS = QUANTUM_CARD_GROUPS.filter((g) => g.titleKey !== "groupQuantumOther");

/**
 * The leftover Layer keycodes (FN_MO13/FN_MO23) that matched none of the six
 * per-type layer-switch groups. The dedicated 层切换 column was removed (层按键's
 * two-step picker covers the per-type cards), so these two fn keys are folded
 * into the Quantum "Other" card below instead.
 */
const LAYER_OTHER_ENTRIES = entriesOf("Layers").filter(
  (e) => !LAYER_GROUPS.some((g) => g.match(e.qmkId)),
);

/**
 * The Quantum "Other" card (One-Shot Mods + misc quantum keycodes), pulled out
 * of the Quantum column and appended to the 其他 column. Kept rendered by
 * {@link QuantumCards} so it keeps its `quantumHelp` tooltips and reveal layout.
 * The leftover Layer fn keys ({@link LAYER_OTHER_ENTRIES}) are appended to its
 * flat reveal so the removed 层切换 column's keycodes stay reachable.
 */
const QUANTUM_OTHER_GROUPS = QUANTUM_CARD_GROUPS.filter(
  (g) => g.titleKey === "groupQuantumOther",
).map((g) => ({ ...g, entries: [...g.entries, ...LAYER_OTHER_ENTRIES] }));

/** Editor pages the Combo Keys cards can jump to via their hover "编辑" action. */
export type ComboEditTarget = "macro" | "tapdance" | "combo";

interface Props {
  onPick: (qmkId: string) => void;
  /** Connected device, for the Combo Keys cards' used/total slot counts. */
  keyboard: Keyboard;
  /** Navigate to a dedicated editor page (the cards' "编辑" action). */
  onNavigate: (target: ComboEditTarget) => void;
  /** "自动选取下一个": whether assigning a key auto-advances the selection. */
  autoAdvance: boolean;
  /** Toggle {@link autoAdvance}. */
  onAutoAdvanceChange: (value: boolean) => void;
}

/**
 * Inline, tabbed keycode palette shown below the keyboard once a key/encoder is
 * selected. Each tab is one KEYCODE_CATEGORIES group (Basic, Media, …). The
 * Basic tab renders the physical keyboard grid plus a Config Settings block
 * (the auto-advance toggle). Masked templates (Layer-Tap, Mod-Tap, …) set a
 * pending state and wait for the user to click an inner basic key.
 */
export function QuickConfigPanel({
  onPick,
  keyboard,
  onNavigate,
  autoAdvance,
  onAutoAdvanceChange,
}: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(VISIBLE_CATEGORIES[0].name);
  const [pending, setPending] = useState<KeycodeDef | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  // The Basic tab lays its keyboard grid + three card columns out in one wide
  // row; on large screens that row scrolls horizontally, and a vertical mouse
  // wheel over it is turned into a horizontal pan (see the hook).
  const basicRowRef = useHorizontalWheelScroll<HTMLDivElement>();

  const pick = (entry: KeycodeDef) => {
    setHint(null);
    if (entry.masked) {
      setPending(entry);
      return;
    }
    if (pending) {
      if (!isBasicQmkId(entry.qmkId)) {
        setHint(t("cannotNest", { qmkId: entry.qmkId, template: pending.qmkId }));
        return;
      }
      onPick(pending.qmkId.replace("kc", entry.qmkId));
      setPending(null);
      return;
    }
    onPick(entry.qmkId);
  };

  // Device-specific tabs (custom keycodes, tap dance) are appended live so they
  // appear only when a keyboard exposing them is connected. Tap Dance isn't a
  // tab of its own: it's folded into the Macros tab as a labelled sub-group (so
  // one "Macros / Tap Dance" tab covers both), mirroring the Fn/Media/Mouse
  // merge. When the device has no tap-dance slots the Macros tab stays as-is.
  const device = deviceCategories();
  const tapDance = device.find((c) => c.name === "Tap Dance" && c.entries.length > 0);
  const custom = device.find((c) => c.name === "Custom" && c.entries.length > 0);
  // Custom keycodes are folded into the "Keyboard Function" tab (below), so keep
  // only any other future device categories to append separately.
  const otherDevice = device.filter((c) => c.name !== "Tap Dance" && c.name !== "Custom");
  // The "Keyboard Function" column's two expandable cards: Lighting (灯光) and
  // the device's Custom keycodes, retitled "键盘配置" (Keyboard Config). Custom
  // only exists once a device exposing it is connected, so its card is dropped
  // when absent.
  const keyboardFnCardGroups: KeyboardFnCardGroup[] = [
    {
      titleKey: "categoryLighting",
      helpKey: "cascadeDescLighting",
      icon: "mdi:lightbulb-on-outline",
      entries: entriesOf("Lighting"),
    },
    ...(custom
      ? [
          {
            titleKey: "categoryKeyboardConfig" as MessageKey,
            helpKey: "cascadeDescCustom" as MessageKey,
            icon: "mdi:tune-variant",
            entries: custom.entries,
          },
        ]
      : []),
  ];
  // The Macros + Tap Dance cards that used to fill a dedicated "Combo Keys" tab,
  // now folded into the Basic tab's far-right column next to the Quantum cards.
  // Tap Dance only exists once a device exposing it is connected.
  const comboKeyGroups: KeycodeGroup[] = [
    { titleKey: "groupMacros", entries: entriesOf("Macros") },
    ...(tapDance ? [{ titleKey: "groupTapDance" as MessageKey, entries: tapDance.entries }] : []),
  ];
  const allCategories: VisibleCategory[] = [...VISIBLE_CATEGORIES, ...otherDevice];
  const activeCat = allCategories.find((c) => c.name === active) ?? allCategories[0];
  const isBasic = activeCat.name === "Basic";
  // The Basic tab renders the physical keyboard grid instead of a flat list, so
  // its category entries are unused.
  const entries = activeCat.entries;

  const keyButton = (entry: KeycodeDef) => (
    <button
      key={entry.qmkId}
      className={`btn btn-sm btn-outline h-auto min-h-8 min-w-12 whitespace-pre-line py-1 font-normal normal-case leading-tight${
        entry.masked ? " italic" : ""
      }`}
      title={entry.title ?? entry.qmkId}
      onClick={() => pick(entry)}
    >
      {entry.label || entry.qmkId}
    </button>
  );

  // Lighting and Custom tabs share a uniform tile: fixed height, a soft
  // translucent border and fill instead of btn-outline's solid currentColor
  // border, so the flat list reads as one consistent grid.
  const tileButton = (entry: KeycodeDef, nowrap = false) => (
    <button
      key={entry.qmkId}
      className={`btn btn-sm h-14 min-w-[4.5rem] ${
        nowrap ? "whitespace-nowrap" : "whitespace-pre-line"
      } border border-base-content/15 bg-base-content/[0.04] py-1 font-normal normal-case leading-tight hover:border-base-content/30 hover:bg-base-content/10${
        entry.masked ? " italic" : ""
      }`}
      title={entry.title ?? entry.qmkId}
      onClick={() => pick(entry)}
    >
      {entry.label || entry.qmkId}
    </button>
  );

  // Concrete-function help text for a "Keyboard Function" key: the Lighting
  // description table, or a custom keycode's device-provided title. Returns null
  // when no meaningful description exists (so no help icon is shown).
  const helpText = (entry: KeycodeDef): string | null => {
    const key = KEYCODE_HELP[entry.qmkId];
    if (key) return t(key);
    if (entry.title && entry.title !== entry.label) return entry.title;
    return null;
  };

  // A tile with a corner HelpIcon describing its concrete function. Falls back
  // to a plain tile when no description is available. The help badge stops click
  // propagation so hovering for help never assigns the keycode.
  const tileWithHelp = (entry: KeycodeDef, nowrap = false) => {
    const help = helpText(entry);
    if (!help) return tileButton(entry, nowrap);
    return (
      <div key={entry.qmkId} className="relative">
        {tileButton(entry, nowrap)}
        <span
          className="absolute right-0.5 top-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <HelpIcon text={help} />
        </span>
      </div>
    );
  };

  // The merged "Keyboard Function" tab renders its grouped keys with the uniform
  // tile look (soft translucent border/fill) plus a per-key help badge.
  const isTileGroups = activeCat.name === KEYBOARD_FN_NAME;
  const groupButton =
    activeCat.name === KEYBOARD_FN_NAME ? (entry: KeycodeDef) => tileWithHelp(entry) : keyButton;
  const groupGap = isTileGroups ? "gap-2" : "gap-1";

  return (
    <div>
      {allCategories.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div role="tablist" className="tabs tabs-box w-fit">
            {allCategories.map((cat) => (
              <button
                key={cat.name}
                role="tab"
                className={`tab${cat.name === activeCat.name ? " tab-active" : ""}`}
                onClick={() => setActive(cat.name)}
              >
                {CATEGORY_KEYS[cat.name] ? t(CATEGORY_KEYS[cat.name]) : cat.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {pending && (
        <div className="alert alert-info alert-soft mt-3 flex items-center py-1 text-sm">
          <span>{t("pickInnerKey", { template: pending.qmkId.replace("kc", "…") })}</span>
          <button className="btn btn-xs ml-auto" onClick={() => setPending(null)}>
            {t("cancel")}
          </button>
        </div>
      )}
      {hint && (
        <div className="alert alert-warning alert-soft mt-3 py-1 text-sm">
          <span>{hint}</span>
        </div>
      )}
      {isBasic && (
        <div
          ref={basicRowRef}
          className="flex flex-col gap-6 lg:flex-row lg:flex-nowrap lg:items-start lg:overflow-x-auto"
        >
          {/* Left column: physical keyboard grid + special keys (both inside
              BasicKeyboardGrid) followed by the config-settings block. */}
          <div>
            <BasicKeyboardGrid onPick={(qmkId) => pick({ qmkId, label: qmkId })} />
            <div className="mt-4 pb-[200px]">
              <h4 className="mb-1 text-sm font-semibold opacity-70">{t("groupConfigSettings")}</h4>
              <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 text-sm">
                <span>{t("autoAdvance")}</span>
                <HelpIcon text={t("autoAdvanceHelp")} />
                <input
                  type="checkbox"
                  className="toggle toggle-sm toggle-primary"
                  checked={autoAdvance}
                  onChange={(e) => onAutoAdvanceChange(e.target.checked)}
                />
              </label>
            </div>
          </div>
          {/* Middle column: the vertical Fn/Media/Mouse cards. */}
          <div className="mt-4 lg:mt-0">
            <h4 className="mb-1 text-sm font-semibold opacity-70">{t("categoryFnMediaMouse")}</h4>
            <FnMediaMouseCards
              groups={[
                ...FN_MEDIA_MOUSE_GROUPS.map((g) => ({
                  titleKey: g.titleKey!,
                  helpKey: g.helpKey,
                  entries: g.entries,
                  grid: g.grid,
                  mouse: g.titleKey === "groupMouse",
                })),
                // 层按键: below Media, a two-step type → layer-number picker.
                {
                  titleKey: "groupLayerKeys" as MessageKey,
                  entries: [],
                  icon: "mdi:layers-outline",
                  watermark: "LAYER",
                  placeholder: (
                    <LayerKeyPicker
                      layerEntries={entriesOf("Layers")}
                      layerCount={keyboard.layers}
                      onPick={pick}
                    />
                  ),
                },
              ]}
              onPick={pick}
            />
          </div>
          {/* Far-right: the former Combo Keys tab, folded in as two columns —
              Macros / Tap Dance / Combo on the left, Quantum on the right. Kept
              side-by-side on large screens (where the whole Basic row scrolls
              horizontally); only allowed to stack on narrow viewports. */}
          <div className="mt-4 flex flex-wrap gap-6 lg:mt-0 lg:flex-nowrap">
            <div>
              <h4 className="mb-1 text-sm font-semibold opacity-70">{t("categoryMacrosTapDance")}</h4>
              <MacroTapDanceCards
                groups={[
                  ...comboKeyGroups.map((g) => ({
                    titleKey: g.titleKey!,
                    entries: g.entries,
                    ...comboMeta(keyboard, g.titleKey!, onNavigate),
                  })),
                  // Combo is a third, non-expandable info card — combos apply on
                  // creation with no key binding, so it has no keycodes to
                  // assign. Shown only when the device exposes combo slots.
                  ...(keyboard.comboCount > 0
                    ? [
                        {
                          titleKey: "groupCombo" as MessageKey,
                          entries: [],
                          used: keyboard.comboEntries.filter(
                            (e) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO"),
                          ).length,
                          total: keyboard.comboCount,
                          onEdit: () => onNavigate("combo"),
                          info: true,
                        },
                      ]
                    : []),
                  // 多功能: a custom-body card that expands to arbitrary content
                  // rather than a keycode slot grid.
                  {
                    titleKey: "groupMultiFunction" as MessageKey,
                    entries: [],
                    custom: <div className="text-lg font-medium">hellowold</div>,
                  },
                ]}
                onPick={pick}
              />
            </div>
            {/* 其他 (Other): the Lighting (灯光) and Keyboard Config (键盘配置,
                the device's Custom keycodes) cards, rendered as the same
                expandable colored cards the Fn/Media/Mouse column uses. */}
            <div>
              <h4 className="mb-1 text-sm font-semibold opacity-70">{t("categoryOther")}</h4>
              <KeyboardFunctionCards groups={keyboardFnCardGroups} onPick={pick} />
              {/* The Quantum "其他" card, relocated here as the column's last card
                  (its own column, keyed off a distinct idPrefix so the two Quantum
                  card instances don't share a view-transition-name). */}
              {QUANTUM_OTHER_GROUPS.length > 0 && (
                <QuantumCards
                  idPrefix="quantumothercard"
                  groups={QUANTUM_OTHER_GROUPS.map((g) => ({
                    titleKey: g.titleKey!,
                    helpKey: g.helpKey,
                    entries: g.entries,
                    sections: g.sections,
                  }))}
                  onPick={pick}
                  keyboard={keyboard}
                />
              )}
            </div>
            <div>
              <h4 className="mb-1 flex items-center gap-1 text-sm font-semibold">
                <span className="opacity-70">{t("categoryQuantum")}</span>
                <HelpIcon text={t("cascadeDescQuantum")} />
              </h4>
              <QuantumCards
                groups={QUANTUM_MAIN_GROUPS.map((g) => ({
                  titleKey: g.titleKey!,
                  helpKey: g.helpKey,
                  entries: g.entries,
                  sections: g.sections,
                }))}
                onPick={pick}
                keyboard={keyboard}
              />
            </div>
          </div>
        </div>
      )}
      {activeCat.groups
        ? activeCat.groups.map((group) => (
            <div key={group.titleKey ?? ""} className="mt-3">
              {group.titleKey && (
                <h4 className="mb-1 flex items-center gap-1 text-sm font-semibold">
                  <span className="opacity-70">{t(group.titleKey)}</span>
                  {group.helpKey && <HelpIcon text={t(group.helpKey)} />}
                </h4>
              )}
              {group.grid ? (
                <div className={`grid w-fit grid-cols-4 ${groupGap}`}>
                  {group.entries.map(groupButton)}
                </div>
              ) : (
                <div className={`flex flex-wrap ${groupGap}`}>
                  {group.entries.map(groupButton)}
                </div>
              )}
            </div>
          ))
        : !isBasic && entries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">{entries.map(keyButton)}</div>
          )}
    </div>
  );
}
