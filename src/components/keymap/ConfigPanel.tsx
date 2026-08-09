import { Fragment, type ReactNode, useState } from "react";
import { Icon } from "@iconify/react";
import { isBasicQmkId, type KeycodeDef } from "../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { BasicKeyboardGrid } from "./config/BasicKeyboardGrid.tsx";
import { SpecialKeyButtons } from "./config/SpecialKeyButtons.tsx";
import { KeycodeTileGrid, KeycodeTileList, SlotTileGrid } from "./config/keycodeTiles.tsx";
import { MouseKeysBody } from "./config/MouseKeysBody.tsx";
import { ConfigSettingsSection } from "./config/ConfigSettingsSection.tsx";
import { LayerKeyPicker } from "./config/LayerKeyPicker.tsx";
import { MultiFunctionBody } from "./config/MultiFunctionBody.tsx";
import { useBalancedColumns } from "./config/useBalancedColumns.ts";
import { deviceCategories } from "./picker/keycodeMeta.ts";
import {
  comboMeta,
  entriesOf,
  MULTI_FUNC_CARD,
  MULTI_FUNC_MODES,
  OTHER_CARD_ENTRIES,
  type ComboEditTarget,
} from "./config/configData.ts";

/**
 * 一个菜单项(= 顶部一个文件夹标签 + 它的内容面板)。一个配置项一项,内容直接摊在
 * 面板里。
 */
/** 「自定义按键」三张卡片的两角柔和圆点底纹,沿用旧配置区域里同一组卡片的花纹。 */
const CARD_PATTERN =
  "bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-size-[4.95em_4.95em]";

/**
 * 一块深色卡面 —— 一个标签页要么整页就是一张这样的卡(`ConfigItem.bg` + `body`),
 * 要么把两张横向排开(`ConfigItem.cards`,如「媒体按键」= Fn 键 + 媒体)。
 */
interface ConfigCard {
  titleKey: MessageKey;
  icon: string;
  /** 卡面底色,沿用各配置项原本的配色。 */
  bg: string;
  /** 标题右侧的一行小字(共 n 个)。 */
  hint?: string;
  /** 卡面右上角的动作(详细设置)。 */
  action?: ReactNode;
  /** 产出的是基础键码,选中双功能键轻触半区时这张卡仍可用。 */
  basicOnly?: boolean;
  /** 吃掉这一行的剩余宽度(而不是按内容取宽),同排的其他卡按内容宽度占位。 */
  grow?: boolean;
  /**
   * 由 `useBalancedColumns` 算出的横向占比,让同排两张瓦片卡的瓦片等宽、行数对齐。
   * 给了就按它分宽度,而不是和同排其他 `grow` 的卡平分。
   */
  flex?: { grow: number; basis: number };
  body: ReactNode;
}

interface ConfigItem {
  /** 只在本组件内用来记选中态。 */
  id: string;
  titleKey: MessageKey;
  icon: string;
  /**
   * 内容底色。卡片正文(combo-num-card 等)是白字配深色卡面的,所以带 bg 的项把正文
   * 放进一块同色卡面里,视觉上就是原来那张卡片展开的样子。不带 bg 的项(基础按键 /
   * 配置设置)自带浅色排版,直接铺在面板上。
   */
  bg?: string;
  /** 产出的是基础键码,选中双功能键轻触半区时仍可用(其余项此时置灰)。 */
  basicOnly?: boolean;
  /** 面板级设置,未选中按键时照样可用,不跟随置灰。 */
  alwaysEnabled?: boolean;
  /** 卡面右上角的动作(详细设置 / 编辑)。 */
  action?: ReactNode;
  /** 标题右侧的一行小字(共 n 个 / 共计 used/total 个)。 */
  hint?: string;
  /**
   * 多张卡横向排开的页(媒体按键、鼠标与灯光)。给了 cards 就不看 bg/body/hint/action,
   * 置灰也改成逐卡判断(见 {@link ConfigCard.basicOnly})。
   */
  cards?: ConfigCard[];
  /** 挂到装 cards 的那个 flex 行上,用来量宽度(见 `useBalancedColumns`)。 */
  cardsRowRef?: (node: HTMLDivElement | null) => void;
  body?: ReactNode;
}

interface Props {
  onPick: (qmkId: string) => void;
  /** Connected device, for the Combo Keys cards' used/total slot counts. */
  keyboard: Keyboard;
  /** Navigate to a dedicated editor page (the cards' "编辑" action). */
  onNavigate: (target: ComboEditTarget) => void;
  /**
   * 当前选中的标签页 id。提到 App.tsx 存,是因为「编辑」入口会整页跳到宏 / Tap Dance /
   * 组合 的编辑页、把这个组件卸载掉,而回来时用户应当看到自己离开时的那一页。
   */
  activeTab: string;
  /** 切换标签页(状态由 App.tsx 持有,见 {@link activeTab})。 */
  onActiveTabChange: (id: string) => void;
  /** Jump to a section of the QMK Settings page (the cards' "详细设置" action). */
  onOpenQmkSection: (section: MessageKey) => void;
  /** "自动选取下一个": whether assigning a key auto-advances the selection. */
  autoAdvance: boolean;
  /** Toggle {@link autoAdvance}. */
  onAutoAdvanceChange: (value: boolean) => void;
  /** 选中双功能键的轻触半区时,非基础键码的项置灰。 */
  dualRoleTap?: boolean;
  /** 选中键当前写着的 qmk_id,「按键叠加」(多功能)据此决定叠加还是清空。 */
  currentQmkId?: string | null;
  /** True while a `.vil` import write is in flight. */
  importing: boolean;
  /** Export the current layout to a `.vil` file. */
  onExport: () => void;
  /** Import a layout from a user-picked `.vil` file. */
  onImportFile: (file: File) => void;
}

/**
 * 配置区域 — 键盘预览下方的键码调色板,选中按键/编码器后在这里给它赋值。顶部一排
 * 文件夹式标签(daisyUI `tabs-lift`),选中哪一项,下方面板就只渲染那一项的内容。
 *
 * 每个配置项一个标签:基础按键、媒体按键(媒体 + F13–F24 两张卡横排)、层按键、
 * 自定义按键(宏 / Tap Dance / 组合 三张卡片横排在同一页)、多功能、鼠标与灯光
 * (鼠标 + 灯光两张卡横排)、更多(键盘配置 + 其他两张卡横排)、配置。设备没有的项
 * (Tap Dance / 组合 / 键盘配置)不出标签,自定义按键 / 更多页里也不出对应的那张卡片。
 *
 * 没选中按键时面板照常可点(不再置灰拦截),写入时才由 App.tsx 的 handleAssign 弹
 * 「请选择需要配置的按键」。
 *
 * 这一版取代了旧的 `QuickConfigPanel`(一屏排开、需要点开的可展开卡片,连同它那套浮层
 * 展开动画一起已删除)。每页的正文组件都在 `config/` 下:键码瓦片与编号槽位
 * (keycodeTiles.tsx)、鼠标十字(MouseKeysBody.tsx)、层按键、多功能、配置。
 */
export function ConfigPanel({
  onPick,
  keyboard,
  onNavigate,
  activeTab,
  onActiveTabChange,
  onOpenQmkSection,
  autoAdvance,
  onAutoAdvanceChange,
  dualRoleTap = false,
  currentQmkId = null,
  importing,
  onExport,
  onImportFile,
}: Props) {
  const { t } = useI18n();
  // 掩码模板(Layer-Tap / Mod-Tap …)先落在这里,等用户再点一个基础键把它填进去。
  const [pending, setPending] = useState<KeycodeDef | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  // 「媒体按键」页两张卡的列数,随内容区宽度重算,让 Fn 键那张和媒体那张行数尽量一致。
  // Fn 键那张列宽固定(标签都是 F13–F24,不跟着拉伸),媒体那张吃掉剩下的宽度。
  const fnEntries = entriesOf("Fn keys");
  const mediaEntries = entriesOf("Media");
  const [mediaRowRef, mediaCols] = useBalancedColumns(
    { count: fnEntries.length, fixed: true },
    { count: mediaEntries.length },
  );

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

  /** 卡面右上角的胶囊按钮(详细设置 / 编辑),两种动作共用一套外观。 */
  const pill = (label: string, icon: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-medium text-white/90 transition-colors hover:bg-white/25"
    >
      <Icon icon={icon} className="text-sm" aria-hidden="true" />
      {label}
    </button>
  );
  const detailSettings = (section: MessageKey) =>
    pill(t("detailSettings"), "mdi:cog-outline", () => onOpenQmkSection(section));
  const editPage = (target: ComboEditTarget) =>
    pill(t("comboCardEdit"), "mdi:pencil-outline", () => onNavigate(target));

  const device = deviceCategories();
  const tapDance = device.find((c) => c.name === "Tap Dance" && c.entries.length > 0);
  const custom = device.find((c) => c.name === "Custom" && c.entries.length > 0);
  const count = (n: number) => t("comboCardCount", { n });

  // 「更多」页两张卡的列数。和媒体页不同,这两张都是弹性的:各自按列数分掉整行宽度,
  // 于是两张卡的瓦片等宽、行数也贴齐。设备没有自定义键码时只剩一张卡,这时不用它算
  // (见下面 moreCards 里的 "fill")。
  const customCount = custom?.entries.length ?? 0;
  const [moreRowRef, moreCols] = useBalancedColumns(
    { count: customCount },
    { count: OTHER_CARD_ENTRIES.length },
  );
  const moreBalanced = customCount > 0 && OTHER_CARD_ENTRIES.length > 0;

  const macros = entriesOf("Macros");
  const macroMeta = comboMeta(keyboard, "groupMacros", onNavigate);
  const tapDanceMeta = comboMeta(keyboard, "groupTapDance", onNavigate);
  const combosUsed = keyboard.comboEntries.filter(
    (e) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO"),
  ).length;

  /**
   * 「自定义按键」页里的三张卡片 —— 宏 / Tap Dance / 组合。三者都是「在别处建好、
   * 这里挑一个槽位赋给按键」的同一类东西,所以合并在一页里横向排开,每张卡片保留原来
   * 配置区域里的样子:自己的底色、斜排水印、标题 + 共计 (used/total) + 「编辑」入口。
   * 设备不支持的(没有 Tap Dance / 没有组合)那张卡片直接不出现。组合没有键码可赋值
   * (建好即生效),所以它的正文只是一句说明。
   */
  const customCards: {
    titleKey: MessageKey;
    icon: string;
    /** 卡面底色 + 斜排水印,沿用旧配置区域里这三张卡片各自的配色。 */
    bg: string;
    watermark: string;
    hint: string;
    target: ComboEditTarget;
    body: ReactNode;
  }[] = [
    {
      titleKey: "groupMacros",
      icon: "mdi:script-text-outline",
      bg: "#3E5C6E",
      watermark: "MACRO",
      hint: t("comboCardUsed", { used: macroMeta.used, total: macroMeta.total }),
      target: "macro",
      body: <SlotTileGrid entries={macros} configured={macroMeta.configured} onPick={pick} />,
    },
    ...(tapDance
      ? [
          {
            titleKey: "groupTapDance" as MessageKey,
            icon: "mdi:animation",
            bg: "#73575E",
            watermark: "TAP DANCE",
            hint: t("comboCardUsed", { used: tapDanceMeta.used, total: tapDanceMeta.total }),
            target: "tapdance" as ComboEditTarget,
            body: (
              <SlotTileGrid
                entries={tapDance.entries}
                configured={tapDanceMeta.configured}
                onPick={pick}
              />
            ),
          },
        ]
      : []),
    ...(keyboard.comboCount > 0
      ? [
          {
            titleKey: "groupCombo" as MessageKey,
            icon: "mdi:vector-combine",
            bg: "#4A5C4E",
            watermark: "COMBO",
            hint: t("comboCardUsed", { used: combosUsed, total: keyboard.comboCount }),
            target: "combo" as ComboEditTarget,
            body: <p className="text-sm leading-relaxed opacity-80">{t("comboAutoApply")}</p>,
          },
        ]
      : []),
  ];

  /**
   * 「更多」页里的卡片 —— 键盘配置(设备自定义键码)+ 其他(单次修饰、零散量子键、
   * 不成组的层键)。两者都是「剩下的、不好归类的键码」,原本各占一个标签页,现在合并
   * 成一页横向排开,每张卡片保留原来的标题、底色和计数。设备没有自定义键码时那张卡片
   * 直接不出现,剩下的那张就不用 useBalancedColumns 了(没有要对齐的伙伴),按 "fill"
   * 塞得下几列排几列。
   */
  const moreCards: ConfigCard[] = [
    ...(custom
      ? [
          {
            titleKey: "categoryKeyboardConfig" as MessageKey,
            icon: "mdi:tune-variant",
            bg: "#5E4A6E",
            grow: true,
            flex: moreBalanced ? moreCols.left.flex : undefined,
            hint: count(custom.entries.length),
            body: (
              <KeycodeTileList
                entries={custom.entries}
                columns={moreBalanced ? moreCols.left.columns : "fill"}
                stretch={moreCols.stretch}
                onPick={pick}
              />
            ),
          },
        ]
      : []),
    ...(OTHER_CARD_ENTRIES.length > 0
      ? [
          {
            titleKey: "cardMore" as MessageKey,
            icon: "mdi:checkbox-blank-circle-outline",
            bg: "#4A5A6E",
            grow: true,
            flex: moreBalanced ? moreCols.right.flex : undefined,
            hint: count(OTHER_CARD_ENTRIES.length),
            body: (
              <KeycodeTileList
                entries={OTHER_CARD_ENTRIES}
                columns={moreBalanced ? moreCols.right.columns : "fill"}
                stretch={moreCols.stretch}
                onPick={pick}
              />
            ),
          },
        ]
      : []),
  ];

  // 卡面底色沿用旧配置区域里各卡片的配色,同一个配置项还是同一个颜色。
  const items: ConfigItem[] = [
    {
      id: "basic",
      titleKey: "categoryBasic",
      icon: "mdi:keyboard-outline",
      basicOnly: true,
      // 模拟键盘一行,特殊按键(清空 / 穿透 / 任意按键)在它下方单开一行。
      body: (
        <div className="flex w-full justify-center">
          {/* w-fit:整列宽度跟着模拟键盘走,特殊按键那一行左对齐到键盘左边缘。 */}
          <div className="flex w-fit max-w-full flex-col gap-5">
            <BasicKeyboardGrid onPick={(qmkId) => pick({ qmkId, label: qmkId })} />
            <SpecialKeyButtons onPick={(qmkId) => pick({ qmkId, label: qmkId })} />
          </div>
        </div>
      ),
    },
    {
      // Fn 键 + 媒体按键:两张卡横排。两张卡的列数都由 useBalancedColumns 按整行宽度
      // 一起算(见那里的说明)—— Fn 键那张按算出的列数取宽固定在左边,媒体那张吃掉剩下
      // 的宽度(grow)、瓦片等分拉伸。目标是两张卡行数一致,底部不各空一块。
      id: "media",
      titleKey: "groupMedia",
      icon: "mdi:apple-safari",
      cardsRowRef: mediaRowRef,
      cards: [
        {
          titleKey: "groupFnKeys",
          icon: "mdi:alpha-f-box-outline",
          bg: "#3E5C6E",
          basicOnly: true,
          body: (
            <KeycodeTileGrid
              entries={fnEntries}
              columns={mediaCols.left.columns}
              stretch={mediaCols.stretch}
              onPick={pick}
            />
          ),
        },
        {
          titleKey: "groupMedia",
          icon: "mdi:apple-safari",
          bg: "#5C4E78",
          basicOnly: true,
          grow: true,
          flex: mediaCols.right.flex,
          hint: count(mediaEntries.length),
          body: (
            <KeycodeTileList
              entries={mediaEntries}
              columns={mediaCols.right.columns}
              stretch={mediaCols.stretch}
              onPick={pick}
            />
          ),
        },
      ],
    },
    {
      id: "layer",
      titleKey: "groupLayerKeys",
      icon: "mdi:layers-outline",
      bg: "#3E5C6E",
      body: (
        <div className="text-sm text-white">
          <LayerKeyPicker
            layerEntries={entriesOf("Layers")}
            layerCount={keyboard.layers}
            onPick={pick}
          />
        </div>
      ),
    },
    {
      id: "macro",
      titleKey: "groupCustomKeys",
      icon: "mdi:script-text-outline",
      // 不设 bg:三张卡片各有各的底色,页面本身不再套一层统一卡面。
      body: (
        <div className="flex flex-row flex-wrap items-stretch justify-center gap-4">
          {customCards.map((card) => (
            <div
              key={card.titleKey}
              // 三张卡等分整行宽度(flex-1 + basis 0),不再钉死 300px;min-w 是折行保底,
              // 行放不下时(窄屏)才换行,而不是把卡片压扁。
              className={`card relative min-w-[260px] flex-1 overflow-hidden text-brand-background shadow-md ${CARD_PATTERN}`}
              style={{ backgroundColor: card.bg }}
            >
              {/* 斜排大字水印,和旧配置区域里这三张卡片一样压在正文底下。 */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
                  {card.watermark}
                </span>
              </div>
              <div className="card-body relative gap-4 p-5">
                <div className="flex items-center gap-2">
                  <Icon icon={card.icon} className="h-6 w-6 shrink-0 opacity-90" aria-hidden="true" />
                  <span className="text-lg font-bold tracking-tight">{t(card.titleKey)}</span>
                  <span className="ml-auto">{editPage(card.target)}</span>
                </div>
                <span className="text-xs tracking-widest uppercase opacity-40">{card.hint}</span>
                {card.body}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      // 按键叠加:三种叠加方式各一张卡横排 —— 单击叠加修饰键(一起发出)、长按叠加
      // 修饰键(Mod-Tap)、长按叠加层按键(Layer-Tap)。「详细设置」只给两张长按卡片,
      // 轻触/长按的判定时间对第一张(单击就一起发出)没有意义。
      id: "multi",
      titleKey: "groupMultiFunction",
      icon: "mdi:apps",
      cards: MULTI_FUNC_MODES.map((mode) => ({
        titleKey: MULTI_FUNC_CARD[mode].titleKey,
        icon: MULTI_FUNC_CARD[mode].icon,
        bg: MULTI_FUNC_CARD[mode].bg,
        // 三张卡等宽平分整行(flex-1 + basis 0),不按各自内容撑宽。
        grow: true,
        action: mode === "tapMod" ? undefined : detailSettings("tapHoldSettingsTitle"),
        body: <MultiFunctionBody mode={mode} currentQmkId={currentQmkId} onPick={onPick} />,
      })),
    },
    {
      // 鼠标按键 + 灯光:两张卡横排。鼠标产出基础键码、灯光不产出,所以置灰是逐卡判断的
      // ——选中双功能键轻触半区时只有灯光那张变灰。
      id: "lighting",
      titleKey: "groupMouseLighting",
      icon: "mdi:mouse-outline",
      cards: [
        {
          titleKey: "groupMouse",
          icon: "mdi:mouse-outline",
          bg: "#6E5A3E",
          basicOnly: true,
          action: detailSettings("mouseKeySettingsTitle"),
          body: <MouseKeysBody entries={entriesOf("Mouse")} onPick={pick} />,
        },
        {
          titleKey: "categoryLighting",
          icon: "mdi:lightbulb-on-outline",
          bg: "#3E6E64",
          // 不再钉死 512px:占满鼠标卡片之外的剩余宽度,瓦片等分列铺满。同排的鼠标那张
          // 是方向键十字、不是瓦片网格,行数没法互相迁就,所以列数不走
          // useBalancedColumns,按 "fill" 塞得下几列排几列就行。
          grow: true,
          hint: count(entriesOf("Lighting").length),
          body: <KeycodeTileList entries={entriesOf("Lighting")} columns="fill" onPick={pick} />,
        },
      ],
    },
    ...(moreCards.length > 0
      ? [
          {
            id: "other",
            titleKey: "cardMore" as MessageKey,
            icon: "mdi:checkbox-blank-circle-outline",
            cardsRowRef: moreRowRef,
            cards: moreCards,
          },
        ]
      : []),
    {
      id: "settings",
      titleKey: "groupConfigSettings",
      icon: "mdi:cog-outline",
      alwaysEnabled: true,
      body: (
        <div className="flex justify-center">
          <ConfigSettingsSection
            autoAdvance={autoAdvance}
            onAutoAdvanceChange={onAutoAdvanceChange}
            importing={importing}
            onExport={onExport}
            onImportFile={onImportFile}
          />
        </div>
      ),
    },
  ];

  // 设备变化会让某些项消失(如换到没有 Tap Dance 的键盘),此时回落到第一项。
  const item = items.find((i) => i.id === activeTab) ?? items[0];

  // 选中双功能键的轻触半区时只收基础键码,其余项整块置灰并挡住点击。多卡片的页逐卡
  // 判断(见下面的 cardShell 调用),整页不拦。未选中按键不再置灰:这时整个面板照常
  // 可点,点到键码才弹「请选择需要配置的按键」(见 App.tsx 的 handleAssign)。
  const blocked = !item.alwaysEnabled && !item.cards && dualRoleTap && !item.basicOnly;

  /**
   * 一块与原卡片同色的卡面:卡片正文本就是白字深底,搬到这里也得有底色兜着。整页只有
   * 一张卡时标题大一号(text-2xl),横排的两张卡用小一号。
   */
  const cardShell = (card: ConfigCard, solo: boolean) => (
    <div
      className={`card h-full max-w-full text-brand-background shadow-md ${
        card.grow ? "w-full" : "w-fit"
      }`}
      style={{ backgroundColor: card.bg }}
    >
      <div className="card-body gap-5 p-6">
        <div className="flex items-center gap-2">
          <Icon icon={card.icon} className="h-6 w-6 shrink-0 opacity-90" aria-hidden="true" />
          <span className={`${solo ? "text-2xl" : "text-xl"} font-bold tracking-tight`}>
            {t(card.titleKey)}
          </span>
          {card.hint && (
            <span className="text-xs tracking-widest uppercase opacity-40">{card.hint}</span>
          )}
          {card.action && <span className="ml-auto pl-4">{card.action}</span>}
        </div>
        {card.body}
      </div>
    </div>
  );

  const body = item.cards ? (
    <div
      ref={item.cardsRowRef}
      className="flex flex-row flex-wrap items-stretch justify-center gap-4"
    >
      {item.cards.map((card) => (
        <div
          key={card.titleKey}
          className={`${card.grow ? "min-w-0" : ""}${card.grow && !card.flex ? " flex-1" : ""}${
            dualRoleTap && !card.basicOnly ? " pointer-events-none opacity-40" : ""
          }`}
          style={card.flex && { flexGrow: card.flex.grow, flexBasis: card.flex.basis }}
        >
          {cardShell(card, false)}
        </div>
      ))}
    </div>
  ) : item.bg ? (
    <div className="flex justify-center">
      {cardShell(
        {
          titleKey: item.titleKey,
          icon: item.icon,
          bg: item.bg,
          hint: item.hint,
          action: item.action,
          body: item.body,
        },
        true,
      )}
    </div>
  ) : (
    item.body
  );

  return (
    // 顶部文件夹标签 + 下方内容:daisyUI 的 tabs-lift 让选中的标签与内容面板连成一体,
    // 像一叠手风琴文件夹。tab-content 必须紧跟在选中的那个 tab 之后(daisyUI 用相邻
    // 兄弟选择器控制显隐),所以只渲染当前项的内容,而不是渲染全部再靠 CSS 藏起来。
    // --tab-bg 覆盖成 base-200,让选中标签的底色和内容面板一致(默认是 base-100 = 纯白)。
    // 注意必须写在 .tab 上而不是 tablist 上:daisyUI 是在 `.tab` 自己身上声明
    // `--tab-bg: var(--color-base-100)` 的,写在父级会被子元素这条声明盖掉。
    // 整块有 1000px 的最小宽度(标签一排放得下、基础按键那台 104 键模拟键盘不被挤到
    // 横向滚动);窗口比这更窄时由外层 overflow-x-auto 整体横向滚动,而不是压缩内容。
    <section className="mt-4 overflow-x-auto">
      <div role="tablist" className="tabs tabs-lift min-w-[1000px]">
        {items.map((it) => (
          <Fragment key={it.id}>
            <button
              type="button"
              role="tab"
              aria-selected={it.id === item.id}
              className={`tab gap-1.5 font-medium [--tab-bg:var(--color-base-200)]${
                it.id === item.id ? " tab-active" : ""
              }`}
              onClick={() => onActiveTabChange(it.id)}
            >
              <Icon icon={it.icon} className="text-base" aria-hidden="true" />
              {t(it.titleKey)}
            </button>
            {/* 内容紧跟在选中的标签之后(daisyUI 的显隐是相邻兄弟选择器);它自带
                order:1,所以视觉上仍排在整排标签下方,不会插进标签中间。 */}
            {it.id === item.id && (
              <div className="tab-content min-w-0 border-base-300 bg-base-200 p-6">
                {pending && (
                  <div className="alert alert-info alert-soft mb-3 flex items-center py-1 text-sm">
                    <span>{t("pickInnerKey", { template: pending.qmkId.replace("kc", "…") })}</span>
                    <button className="btn btn-xs ml-auto" onClick={() => setPending(null)}>
                      {t("cancel")}
                    </button>
                  </div>
                )}
                {hint && (
                  <div className="alert alert-warning alert-soft mb-3 py-1 text-sm">
                    <span>{hint}</span>
                  </div>
                )}
                <div className={blocked ? "pointer-events-none opacity-40" : undefined}>{body}</div>
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  );
}
