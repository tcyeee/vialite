import { useState } from "react";
import { Icon } from "@iconify/react";
import { isBasicQmkId, type KeycodeDef } from "../../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { HelpIcon } from "../../common/HelpIcon.tsx";
import { MacroTapDanceCards } from "./MacroTapDanceCards.tsx";
import { BasicKeyboardGrid } from "./BasicKeyboardGrid.tsx";
import { SpecialKeyButtons } from "./SpecialKeyButtons.tsx";
import { CATEGORY_KEYS, KEYCODE_HELP, deviceCategories } from "../picker/keycodeMeta.ts";
import { LayerKeyPicker } from "./LayerKeyPicker.tsx";
import { FnMediaMouseCards } from "./FnMediaMouseCards.tsx";
import { KeyboardFunctionCards, type KeyboardFnCardGroup } from "./KeyboardFunctionCards.tsx";
import { ConfigSettingsSection } from "./ConfigSettingsSection.tsx";
import { MultiFunctionCardBody } from "./MultiFunctionCardBody.tsx";
import {
  ALWAYS_ENABLED_ATTR,
  comboMeta,
  entriesOf,
  FN_MEDIA_MOUSE_GROUPS,
  KEYBOARD_FN_NAME,
  OTHER_CARD_ENTRIES,
  VISIBLE_CATEGORIES,
  type ComboEditTarget,
  type KeycodeGroup,
  type VisibleCategory,
} from "./quickConfigData.ts";

export { ALWAYS_ENABLED_ATTR };
export type { ComboEditTarget };

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
  /** True while a `.vil` import write is in flight — disables both export/import buttons. */
  importing: boolean;
  /** Export the current layout to a `.vil` file. */
  onExport: () => void;
  /** Import a layout from a user-picked `.vil` file. */
  onImportFile: (file: File) => void;
  /** "配置键盘颜色" row: opens the 个性化 page via the same hero View Transition NewHomePage uses. */
  onOpenPersonalization: (origin: Element) => void;
  /**
   * 选中了双功能键(dualRole)的上半部分(轻触/tap 半区)时置 true。此时该半区只能
   * 是基础键码,所以除「功能」列前三张卡片(F13~F24 / 鼠标 / 媒体,连同基础模拟键盘)
   * 之外的所有卡片——层按键、宏 / TapDance / 组合 / 多功能、灯光 / 键盘配置 / 更多——
   * 全部置灰且不可交互。
   */
  dualRoleTap?: boolean;
  /**
   * 选中的键/编码器当前写着的 qmk_id(未选中时为 null)。「按键叠加」(多功能卡片)
   * 据此决定 modified/taphold 框架的 tap 基础:是基础键码就叠加进去,否则清空。
   */
  currentQmkId?: string | null;
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
  dualRoleTap = false,
  currentQmkId = null,
  importing,
  onExport,
  onImportFile,
  onOpenPersonalization,
}: Props) {
  const { t } = useI18n();
  // Preview scaling is no longer duplicated here: the board follows the 个性化
  // page's 预览区域自适应大小 / 预览区域缩放 settings, reachable via the
  // 预览样式 row's "去配置" link below.
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
  // True while any of the Basic tab's expandable cards (Fn/Media/Mouse,
  // Macros/Tap Dance, Keyboard Function, …) is open. Each card column reports its
  // open/closed card here; only one card is open panel-wide at a time (an outside
  // click collapses the others), so a boolean captures it. When set, every
  // collapsed card dims so the single expanded card stands out.
  const [anyCardExpanded, setAnyCardExpanded] = useState(false);
  const onCardExpandedChange = (key: string | null) => setAnyCardExpanded(key !== null);

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
      disabled: dualRoleTap,
    },
    ...(custom
      ? [
          {
            titleKey: "categoryKeyboardConfig" as MessageKey,
            icon: "mdi:tune-variant",
            expandedOffsetY: 50,
            entries: custom.entries,
            disabled: dualRoleTap,
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
            disabled: dualRoleTap,
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
        // 2026-07-28 起,基础按键区改为两个纵向排布、整体居中的 row(整页向下
        // 滚动,不再有任何横向滚动):1. 基础按键 + 清空/穿透/任意按键,同一横轴,
        // 窄屏下换行 2. 特殊按键区域(功能 / 组合按键 / 其他)+ 配置设置,同样同一
        // 横轴、配置设置列宽度尽可能窄,窄屏下换行而不是横向滚动。
        <div className="mt-4 flex flex-col items-center gap-8">
          {/* Row 1: 基础按键(89 键模拟键盘)+ 清空/穿透/任意按键,并排显示在
              同一横轴上;窄屏下换行而不是横向滚动。 */}
          <section className="flex w-full flex-col items-center">
            <div className="flex w-full flex-row flex-wrap items-start justify-center gap-6">
              <div className="shrink-0">
                <BasicKeyboardGrid
                  onPick={(qmkId) => pick({ qmkId, label: qmkId })}
                  disabled={disabled}
                />
              </div>
              <div className="shrink-0">
                <SpecialKeyButtons
                  onPick={(qmkId) => pick({ qmkId, label: qmkId })}
                  disabled={disabled}
                />
              </div>
            </div>
          </section>

          {/* Row 2: 特殊按键区域 — Fn/Media/Mouse + 层按键, Macros/Tap
              Dance/Combo + 多功能, Lighting/键盘配置/其他,以及配置设置(列宽
              尽可能窄),全部并排显示在同一横轴上,窄屏下换行而不是横向滚动。 */}
          <section className="flex w-full flex-col items-center">
            <h4 className="mb-2 text-sm font-semibold opacity-70">{t("sectionSpecialKeys")}</h4>
            <div className="flex w-full flex-row flex-wrap items-start justify-center gap-6">
              {/* Fn/Media/Mouse cards + 层按键. */}
              <div className={`shrink-0${dim}`}>
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
                      // 层键不是基础键码,不能作为双功能键的轻触半区。
                      disabled: dualRoleTap,
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
                  anyExpanded={anyCardExpanded}
                  onExpandedChange={onCardExpandedChange}
                />
              </div>
              {/* Far-right: the former Combo Keys tab, folded in as two columns —
                  Macros / Tap Dance / Combo on the left, Quantum on the right.
                  Always side-by-side; this row scrolls horizontally instead of
                  wrapping on narrow viewports. */}
              <div className={`flex shrink-0 flex-nowrap gap-6${dim}`}>
                <div className="shrink-0">
                  <h4 className="mb-1 text-sm font-semibold opacity-70">{t("categoryMacrosTapDance")}</h4>
                  <MacroTapDanceCards
                    groups={[
                      ...comboKeyGroups.map((g) => ({
                        titleKey: g.titleKey!,
                        entries: g.entries,
                        ...comboMeta(keyboard, g.titleKey!, onNavigate),
                        disabled: dualRoleTap,
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
                              disabled: dualRoleTap,
                            },
                          ]
                        : []),
                      // 多功能: a custom-body card that expands to arbitrary content
                      // rather than a keycode slot grid.
                      {
                        titleKey: "groupMultiFunction" as MessageKey,
                        entries: [],
                        disabled: dualRoleTap,
                        // Jumps to the QMK Settings "轻触与长按 (Tap-Hold)" section.
                        expandedAction: detailSettingsAction("tapHoldSettingsTitle"),
                        custom: <MultiFunctionCardBody currentQmkId={currentQmkId} onPick={onPick} />,
                      },
                    ]}
                    onPick={pick}
                    anyExpanded={anyCardExpanded}
                    onExpandedChange={onCardExpandedChange}
                  />
                </div>
                {/* 其他 (Other): the Lighting (灯光) and Keyboard Config (键盘配置,
                    the device's Custom keycodes) cards, rendered as the same
                    expandable colored cards the Fn/Media/Mouse column uses. */}
                <div className="shrink-0">
                  <h4 className="mb-1 text-sm font-semibold opacity-70">{t("categoryOther")}</h4>
                  <KeyboardFunctionCards
                    groups={keyboardFnCardGroups}
                    onPick={pick}
                    anyExpanded={anyCardExpanded}
                    onExpandedChange={onCardExpandedChange}
                  />
                </div>
              </div>
              {/* 配置设置,列宽尽可能窄,置于特殊按键区域最后方(同一横轴上的
                  最后一列)。它不跟随 `dim`:是面板级设置(自动选取下一个 /
                  导入导出),未选中按键时同样可以调整,所以既不置灰也不被点击
                  拦截器吞掉。「配置预览样式」行已移除——个性化改由 NewHomePage
                  的入口进入。 */}
              <ConfigSettingsSection
                autoAdvance={autoAdvance}
                onAutoAdvanceChange={onAutoAdvanceChange}
                importing={importing}
                onExport={onExport}
                onImportFile={onImportFile}
                onOpenPersonalization={onOpenPersonalization}
              />
            </div>
          </section>
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
