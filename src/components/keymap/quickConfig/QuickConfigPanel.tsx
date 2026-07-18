import { useState } from "react";
import { Icon } from "@iconify/react";
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
  deviceCategories,
} from "../keycodeMeta.ts";
import { LayerKeyPicker } from "./LayerKeyPicker.tsx";
import { FnMediaMouseCards } from "./FnMediaMouseCards.tsx";
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
 * The keycodes for the "其他" (Other) card at the end of the 其他 column: One-Shot
 * Mods, plus any Quantum keycodes matching none of the typed Quantum groups, plus
 * the two leftover Layer fn keys (FN_MO13/FN_MO23) that fit no per-type layer
 * group. The Quantum category is otherwise hidden; this flat list keeps those
 * keycodes reachable, rendered as an ordinary expandable card (not the removed
 * QuantumCards) via {@link KeyboardFunctionCards}.
 */
const OTHER_CARD_ENTRIES: KeycodeDef[] = (() => {
  const quantum = entriesOf("Quantum");
  const osm = QUANTUM_GROUPS.find((g) => g.key === "osm")!;
  const osmEntries = quantum.filter((e) => osm.match(e.qmkId));
  const misc = quantum.filter((e) => !QUANTUM_GROUPS.some((g) => g.match(e.qmkId)));
  const layerOther = entriesOf("Layers").filter((e) => !LAYER_GROUPS.some((g) => g.match(e.qmkId)));
  return [...osmEntries, ...misc, ...layerOther];
})();

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

/** Editor pages the Combo Keys cards can jump to via their hover "编辑" action. */
export type ComboEditTarget = "macro" | "tapdance" | "combo";

/**
 * The two Multi-Function categories the 多功能 card offers:
 *  - "modified" (red): layer modifiers onto a base keycode.
 *  - "taphold" (blue): tap sends the base keycode, hold activates a layer/mod.
 */
export type MultiFuncMode = "modified" | "taphold";

/**
 * The dual-role "framework" keycode written to the selected key the moment a
 * Multi-Function category is chosen — an empty skeleton the user later fills in by
 * editing the cap's top/bottom halves on the keyboard itself (a future step, out
 * of scope here):
 *  - modified: 左Ctrl+左Alt on an empty base (`LCA(KC_NO)`).
 *  - taphold: Layer-Tap holding layer 0 with an empty tap (`LT(0,KC_NO)`).
 */
const MULTI_FUNC_FRAMEWORK: Record<MultiFuncMode, string> = {
  modified: "LCA(KC_NO)",
  taphold: "LT(0,KC_NO)",
};

interface Props {
  onPick: (qmkId: string) => void;
  /** Connected device, for the Combo Keys cards' used/total slot counts. */
  keyboard: Keyboard;
  /** Navigate to a dedicated editor page (the cards' "编辑" action). */
  onNavigate: (target: ComboEditTarget) => void;
  /**
   * Jump to a section of the QMK Settings (高级设置) page — the expandable cards'
   * "详细设置" action. The section is identified by its title MessageKey (the id
   * QmkSettingsSection tags onto its `<section>`).
   */
  onOpenQmkSection: (section: MessageKey) => void;
  /** "自动选取下一个": whether assigning a key auto-advances the selection. */
  autoAdvance: boolean;
  /** Toggle {@link autoAdvance}. */
  onAutoAdvanceChange: (value: boolean) => void;
  /** 未选中按键:在基础按键的模拟键盘上浮出「请先选择按键」提示。 */
  disabled?: boolean;
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
  onOpenQmkSection,
  autoAdvance,
  onAutoAdvanceChange,
  disabled = false,
}: Props) {
  const { t } = useI18n();
  // The "详细设置" pill shown at the top-right of an expanded card, jumping to the
  // matching QMK Settings section. Its own click is stopped from bubbling to the
  // card so it never doubles as a keycode assignment.
  const detailSettingsAction = (section: MessageKey) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenQmkSection(section);
      }}
      className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 transition-colors hover:bg-white/25"
    >
      <Icon icon="mdi:cog-outline" className="text-sm" aria-hidden="true" />
      {t("detailSettings")}
    </button>
  );
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
      icon: "mdi:lightbulb-on-outline",
      // Nudge the enlarged card up 33px from the 150px default.
      expandedOffsetY: 0,
      entries: entriesOf("Lighting"),
    },
    ...(custom
      ? [
          {
            titleKey: "categoryKeyboardConfig" as MessageKey,
            icon: "mdi:tune-variant",
            expandedOffsetY: 50,
            entries: custom.entries,
          },
        ]
      : []),
    // 其他: One-Shot Mods + misc Quantum + leftover Layer fn keys. The Quantum
    // column was removed, but these keycodes stay reachable here as a plain card.
    ...(OTHER_CARD_ENTRIES.length > 0
      ? [
          {
            titleKey: "cardMore" as MessageKey,
            icon: "mdi:checkbox-blank-circle-outline",
            // Widened 59px past the 550px default, and nudged down.
            expandedWidth: "w-[800px]",
            expandedOffsetY: 100,
            // Grow to fit its keycodes instead of a fixed 320px box.
            expandedUncapped: true,
            entries: OTHER_CARD_ENTRIES,
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

  // 未选中按键时把面板整体置灰。置灰按块施加(而非用一个 opacity 祖先包裹整块),
  // 这样基础按键模拟键盘上的提示徽标能保持不透明——opacity 会向所有后代传递并封顶。
  const dim = disabled ? " opacity-40" : "";

  return (
    <div>
      {allCategories.length > 1 && (
        <div className={`flex flex-wrap items-center gap-x-4 gap-y-2${dim}`}>
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
            <BasicKeyboardGrid
              onPick={(qmkId) => pick({ qmkId, label: qmkId })}
              disabled={disabled}
            />
            <div className={`mt-4 pb-[200px]${dim}`}>
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
          <div className={`mt-4 lg:mt-0${dim}`}>
            <h4 className="mb-1 text-sm font-semibold opacity-70">{t("categoryFnMediaMouse")}</h4>
            <FnMediaMouseCards
              groups={[
                ...FN_MEDIA_MOUSE_GROUPS.map((g) => ({
                  titleKey: g.titleKey!,
                  helpKey: g.helpKey,
                  entries: g.entries,
                  grid: g.grid,
                  mouse: g.titleKey === "groupMouse",
                  // The Mouse card jumps to the QMK Settings "鼠标按键" section.
                  expandedAction:
                    g.titleKey === "groupMouse"
                      ? detailSettingsAction("mouseKeySettingsTitle")
                      : undefined,
                  icon:
                    g.titleKey === "groupFnKeys"
                      ? "mdi:alpha-f-box-outline"
                      : g.titleKey === "groupMedia"
                        ? "mdi:apple-safari"
                        : undefined,
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
          <div className={`mt-4 flex flex-wrap gap-6 lg:mt-0 lg:flex-nowrap${dim}`}>
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
                    // Jumps to the QMK Settings "轻触与长按 (Tap-Hold)" section.
                    expandedAction: detailSettingsAction("tapHoldSettingsTitle"),
                    custom: (
                      <div className="flex flex-col gap-3">
                        <p className="text-xs leading-snug opacity-70">
                          {t("multiFuncIntro")}
                        </p>
                        <div className="flex gap-3">
                          {(
                            [
                              {
                                mode: "modified",
                                desc: t("multiFuncModified"),
                                // 修饰键:单个 ⌘ 图标。
                                iconNode: (
                                  <Icon
                                    icon="mdi:apple-keyboard-command"
                                    className="size-10 shrink-0"
                                    aria-hidden="true"
                                  />
                                ),
                              },
                              {
                                mode: "taphold",
                                desc: t("multiFuncTapHold"),
                                // 长按激活层/修饰键:⌘ 叠加 层图标,左上角 ⌘、右下角
                                // 层,表达"轻触出键、长按切层/修饰"的双重角色。
                                iconNode: (
                                  <span className="relative block size-10 shrink-0" aria-hidden="true">
                                    <Icon
                                      icon="mdi:apple-keyboard-command"
                                      className="absolute top-0 left-0 size-6"
                                    />
                                    <Icon
                                      icon="mdi:layers-outline"
                                      className="absolute right-0 bottom-0 size-6"
                                    />
                                    {/* 分隔两枚图标的白色斜线(左下 → 右上)。 */}
                                    <span
                                      className="pointer-events-none absolute inset-0"
                                      style={{
                                        background:
                                          "linear-gradient(to bottom right, transparent calc(50% - 0.75px), #ffffff calc(50% - 0.75px), #ffffff calc(50% + 0.75px), transparent calc(50% + 0.75px))",
                                      }}
                                    />
                                  </span>
                                ),
                              },
                            ] as const
                          ).map(({ mode, desc, iconNode }) => (
                            <button
                              key={mode}
                              type="button"
                              // Clicking a category is the whole interaction: the
                              // framework keycode is written to the selected key at
                              // once. Editing its halves happens later on the
                              // keyboard itself (out of scope here).
                              onClick={(e) => {
                                e.stopPropagation();
                                onPick(MULTI_FUNC_FRAMEWORK[mode]);
                              }}
                              className="flex flex-1 flex-col items-center gap-3 rounded-lg bg-white/10 p-3 text-center transition-colors hover:bg-white/20"
                            >
                              {iconNode}
                              <span className="text-xs leading-snug">{desc}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ),
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
            </div>
          </div>
        </div>
      )}
      {activeCat.groups
        ? activeCat.groups.map((group) => (
            <div key={group.titleKey ?? ""} className={`mt-3${dim}`}>
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
            <div className={`mt-3 flex flex-wrap gap-1${dim}`}>{entries.map(keyButton)}</div>
          )}
    </div>
  );
}
