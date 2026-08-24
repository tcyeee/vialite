import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";
import { KEYCODE_HELP } from "../picker/keycodeMeta.ts";

// 配置区域各页共用的键码瓦片:一个 {@link KeycodeTile} 是一个按键卡片,外面套一层
// 排布容器({@link KeycodeTileGrid} / {@link KeycodeTileList})。都是白字 + 半透明底,
// 铺在页面那块深色卡面上。

/**
 * 所有键码瓦片共用的外观,以「媒体按键」卡片里的瓦片为准 —— 47px 高、px-2 的左右
 * 内边距。宽度由容器给:定宽网格 / 等分列用 {@link TILE_W},自适应折行时它当保底
 * 宽度、标签更长就自己撑开。
 *
 * 编号槽位那种正方形瓦片(宏 / Tap Dance / 层)不走这套,见 `.combo-num-card`。
 */
const TILE_CLASS =
  "combo-item btn btn-sm h-[47px] px-2 border-white/20 bg-white/10 font-normal whitespace-nowrap text-white normal-case shadow-none leading-tight hover:border-white/40 hover:bg-white/25";

/** 瓦片基准宽度(px)。`useBalancedColumns` 排列数时也按这个宽度算。 */
export const TILE_W = 120;

/**
 * 一个按键卡片 —— 配置区域里点一下就把这个键码赋给选中按键的那块瓦片,各页共用。
 * 悬停时浮出这个键具体做什么:说明取自键码数据库({@link KEYCODE_HELP}),设备自定义
 * 键码没登记在库里、用它自己带的 `title`,再没有就报 qmk_id。
 *
 * 提示框 portal 到 `document.body` 并用 `position: fixed`:瓦片可能出现在滚动容器或
 * 任何 stacking context 里,提示留在原地会被裁掉,单靠 z-index 抬不出来。
 */
export function KeycodeTile({
  entry,
  index = 0,
  autoWidth = false,
  onPick,
}: {
  entry: KeycodeDef;
  /** 在同一组瓦片里的序号,只用来错开翻入动画。 */
  index?: number;
  /** 按标签宽度自适应,{@link TILE_W} 保底;默认填满所在的网格列。 */
  autoWidth?: boolean;
  onPick: (entry: KeycodeDef) => void;
}) {
  const { t } = useI18n();
  const [tip, setTip] = useState<{ top: number; left: number } | null>(null);

  const help = KEYCODE_HELP[entry.qmkId];
  // 去掉句尾的句号(半角 "." 和全角 "。"),一句话提示不带标点更利落。
  const text = (help ? t(help) : (entry.title ?? entry.qmkId)).replace(/[.。]$/, "");

  // `position: fixed` 的提示框不会跟着滚动,一滚就撤掉。
  useEffect(() => {
    if (!tip) return;
    const onScroll = () => setTip(null);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [tip]);

  const show = (e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    // 贴着瓦片上边缘居中,提示框自己的 transform 再把它拉到上方。
    setTip({ top: r.top - 8, left: r.left + r.width / 2 });
  };

  return (
    <>
      <button
        className={`${TILE_CLASS} ${autoWidth ? "" : "w-full"}`}
        style={{
          animationDelay: `${Math.min(index * 25, 300)}ms`,
          minWidth: autoWidth ? TILE_W : undefined,
        }}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        onClick={() => onPick(entry)}
      >
        {/*
          灯光标签自带换行(如 "RGB\nRainbow"),压成一行读起来更整齐。等分列里瓦片宽度
          是算出来的,设备自定义键码的标签可能比一格还长,truncate 让它省略号收尾而不是
          撑破卡面 —— 全名照样能悬停看到。
        */}
        <span className="min-w-0 truncate">{(entry.label || entry.qmkId).replace(/\n/g, " ")}</span>
      </button>
      {tip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: tip.top,
              left: tip.left,
              transform: "translate(-50%, -100%)",
            }}
            className="pointer-events-none z-[999] max-w-xs rounded-md bg-neutral px-2 py-1 text-xs whitespace-normal text-neutral-content shadow-lg"
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * 定宽列的瓦片网格 —— 「Fn 键」(F13–F24)卡片的正文。列宽固定在 {@link TILE_W},
 * 整块按内容取宽(`w-fit`),同排里当窄条、把剩余宽度让给邻卡。
 */
export function KeycodeTileGrid({
  entries,
  columns = 6,
  stretch = false,
  onPick,
}: {
  entries: KeycodeDef[];
  /** 列数(由 `useBalancedColumns` 算出来,让同排两张卡行数对齐)。 */
  columns?: number;
  /**
   * 撑满卡面高度,把和邻卡对不齐剩下的那点高度摊进行间距里,而不是全堆在底部。只在
   * 行数已经贴齐时开(见 `BalancedColumns.stretch`)——差得多还摊的话行距会大到离谱。
   */
  stretch?: boolean;
  onPick: (entry: KeycodeDef) => void;
}) {
  return (
    <div
      className={`combo-num-grid grid w-fit gap-2 ${stretch ? "grow content-between" : ""}`}
      style={{ gridTemplateColumns: `repeat(${columns}, ${TILE_W}px)` }}
    >
      {entries.map((entry, j) => (
        <KeycodeTile key={entry.qmkId} entry={entry} index={j} onPick={onPick} />
      ))}
    </div>
  );
}

/**
 * 编号槽位瓦片 —— 「宏」/「Tap Dance」页的正文。已配置过的槽位右上角点一个圆点。
 */
export function SlotTileGrid({
  entries,
  configured,
  onPick,
}: {
  entries: KeycodeDef[];
  /** Per-slot "already configured" flags, indexed like {@link entries}. */
  configured?: boolean[];
  onPick: (entry: KeycodeDef) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="combo-num-grid flex flex-wrap gap-2">
      {entries.map((entry, j) => (
        <button
          key={entry.qmkId}
          className="combo-num-card relative"
          style={{ animationDelay: `${Math.min(j * 30, 400)}ms` }}
          title={entry.title ?? entry.qmkId}
          onClick={() => onPick(entry)}
        >
          {j}
          {configured?.[j] && (
            <span
              className="absolute top-1 right-1 size-1.5 rounded-full bg-white"
              title={t("comboSlotConfigured")}
            />
          )}
        </button>
      ))}
    </div>
  );
}

/**
 * 弹性宽度的瓦片列表 —— 「媒体按键」「灯光」「键盘配置」「其他」页的正文。整块吃掉
 * 容器宽度,瓦片排成等分列撑满,列数有三种来法(见 {@link columns}):
 *
 *  - 给定列数:同排另一张卡也是瓦片卡,两边的列数由 `useBalancedColumns` 一起算,好让
 *    行数对齐(媒体按键、更多);
 *  - `"fill"`:同排没有能对齐行数的伙伴(灯光那张的邻居是鼠标十字),就按 {@link TILE_W}
 *    塞得下几列排几列,纯 CSS,不用量宽度;
 *  - 不给:按标签宽度自适应地折行,{@link TILE_W} 保底、更长的自己撑开。
 */
export function KeycodeTileList({
  entries,
  columns,
  stretch = false,
  onPick,
}: {
  entries: KeycodeDef[];
  /** 列数、`"fill"`(塞得下几列排几列)或不给(自适应折行),见上。 */
  columns?: number | "fill";
  /** 同 {@link KeycodeTileGrid} 的 `stretch`;只在列数由 `useBalancedColumns` 给时有意义。 */
  stretch?: boolean;
  onPick: (entry: KeycodeDef) => void;
}) {
  const template =
    columns === "fill"
      ? `repeat(auto-fill, minmax(${TILE_W}px, 1fr))`
      : columns
        ? `repeat(${columns}, minmax(0, 1fr))`
        : undefined;
  return (
    <div
      className={`combo-num-grid gap-2 ${
        template ? `grid ${stretch ? "grow content-between" : ""}` : "flex flex-wrap"
      }`}
      style={template ? { gridTemplateColumns: template } : undefined}
    >
      {entries.map((entry, j) => (
        <KeycodeTile
          key={entry.qmkId}
          entry={entry}
          index={j}
          autoWidth={!template}
          onPick={onPick}
        />
      ))}
    </div>
  );
}
