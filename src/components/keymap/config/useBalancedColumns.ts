import { useCallback, useMemo, useRef, useState } from "react";
import { TILE_W } from "./keycodeTiles.tsx";

/**
 * 让横排的两张瓦片卡片行数尽量一致 —— 「媒体按键」页(Fn 键 + 媒体)和「更多」页
 * (键盘配置 + 其他)用。
 *
 * 两张卡是 `items-stretch` 等高的,所以矮的那张底部会空一块;行数差得越多,空得越多。
 * 这里量出整行的可用宽度,再在「左卡几列 × 右卡几列」的整数组合里挑一组行数最接近的。
 *
 * 关键在于弹性卡片的瓦片宽度是算出来的(等分剩余宽度,只保底 {@link MIN_ELASTIC_TILE}):
 * 定宽瓦片会把列数量子化成 128px 一档,常常明明宽度够却差一行贴不上;能拉伸之后列数
 * 可以自由取,再由瓦片自己撑满宽度,右边缘也不会参差。同排所有弹性卡片按列数分宽度,
 * 所以整行的瓦片是一样宽的,看不出是两张卡各排各的。
 */

/** 两张卡内部瓦片的 `gap-2`。 */
const TILE_GAP = 8;
/** 卡面 `p-6` 的左右内边距合计。 */
const CARD_PAD = 48;
/** 两张卡之间的 `gap-4`。 */
const ROW_GAP = 16;
/**
 * 弹性瓦片压到这么窄就该换更少的列了。扣掉 px-2 的内边距和边框还剩 86px 的字位,
 * 够放最长的那几个标签(Media Player / Web Refresh)。定得再宽一点(110)的话,Fn 卡按
 * {@link TILE_W} 占掉两列后,1000–1100px 这一档的媒体卡就只剩得下 5 列 = 8 行,和 Fn 卡
 * 的 6 行差两行。
 */
const MIN_ELASTIC_TILE = 104;
/**
 * 瓦片最多拉到这么宽。没有这个上限的话,窄屏下「行数完全相等」会赢过一切,解出来是
 * 「Fn 排成 1 列 12 行 + 媒体 3 列 260px 的大板砖」——行数是齐了,但难看。宁可差一行。
 */
const MAX_ELASTIC_TILE = 168;

/** 参与排布的一张卡。 */
export interface CardSpec {
  /** 这张卡要排的瓦片数。 */
  count: number;
  /**
   * 列宽固定在 {@link TILE_W},整张卡按内容取宽(如 Fn 键卡)。默认是弹性的:和同排
   * 其他弹性卡片一起按列数分掉剩余宽度。
   */
  fixed?: boolean;
}

/** 一张卡该怎么排。 */
export interface CardLayout {
  /** 排几列。 */
  columns: number;
  /**
   * 弹性卡片在整行里的占比:`flex-grow` 取列数,`flex-basis` 取卡片里除瓦片以外的固定
   * 部分(左右内边距 + 列间距)。浏览器按 grow 分掉剩下的宽度,于是每一列的瓦片在同排
   * 所有弹性卡片之间正好等宽。定宽卡片没有这一项(按内容取宽)。
   */
  flex?: { grow: number; basis: number };
}

export interface BalancedColumns {
  left: CardLayout;
  right: CardLayout;
  /**
   * 行数是不是已经贴齐了(差不超过一行)。贴齐了才让两张卡的网格撑满卡面高度、把那点
   * 零头摊进行间距;差得多的时候摊出来的行距会大得离谱(差两行 = 每个行距涨 20 多 px,
   * 看着像排版塌了),不如老老实实空在底部。
   */
  stretch: boolean;
}

/**
 * 还没量到宽度时先按这个排。回调 ref 是在 commit 阶段跑的,量到的宽度会在浏览器绘制
 * 前就换掉它,所以看不到这一帧;不撑高只是保险。
 */
const FALLBACK: BalancedColumns = {
  left: { columns: 2 },
  right: { columns: 6 },
  stretch: false,
};

/** 字典序比较打分向量,越小越好。 */
function better(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** 弹性卡片的 flex 占比;定宽卡片返回 undefined。 */
function weight(spec: CardSpec, columns: number): CardLayout {
  if (spec.fixed) return { columns };
  return { columns, flex: { grow: columns, basis: CARD_PAD + (columns - 1) * TILE_GAP } };
}

/**
 * 在 `width` 放得下、且弹性瓦片宽度落在 [{@link MIN_ELASTIC_TILE}, `maxTile`] 里的所有
 * 列数组合里挑最协调的一组。打分依次是:行数差、两张卡末行的空格总数、瓦片宽度离基准
 * 宽度的距离。一组都挑不出来时返回 null。
 */
function search(
  width: number,
  a: CardSpec,
  b: CardSpec,
  maxTile: number,
): BalancedColumns | null {
  let best: BalancedColumns | null = null;
  let bestScore: number[] | null = null;

  for (let ca = 1; ca <= a.count; ca++) {
    for (let cb = 1; cb <= b.count; cb++) {
      // 每张卡除瓦片本身以外固定占掉的宽度:左右内边距 + 列间距。定宽卡的瓦片也算进去。
      const chrome =
        CARD_PAD * 2 +
        (ca - 1) * TILE_GAP +
        (cb - 1) * TILE_GAP +
        (a.fixed ? ca * TILE_W : 0) +
        (b.fixed ? cb * TILE_W : 0);
      const elasticCols = (a.fixed ? 0 : ca) + (b.fixed ? 0 : cb);
      const rest = width - ROW_GAP - chrome;
      if (elasticCols === 0) {
        if (rest < 0) continue;
      } else {
        const tile = rest / elasticCols;
        if (tile < MIN_ELASTIC_TILE || tile > maxTile) continue;
      }

      const rowsA = Math.ceil(a.count / ca);
      const rowsB = Math.ceil(b.count / cb);
      const tile = elasticCols === 0 ? TILE_W : rest / elasticCols;
      const score = [
        Math.abs(rowsA - rowsB),
        ca * rowsA - a.count + (cb * rowsB - b.count),
        Math.abs(tile - TILE_W),
      ];
      if (!bestScore || better(score, bestScore)) {
        bestScore = score;
        best = {
          left: weight(a, ca),
          right: weight(b, cb),
          stretch: Math.abs(rowsA - rowsB) <= 1,
        };
      }
    }
  }

  return best;
}

/**
 * 瓦片宽度上限是「有得挑的时候才守」的软约束:列数是整数,瓦片宽度也就跟着一档一档
 * 跳,某些宽度下可能每一档都超上限(尤其列数少的时候,相邻两档差近一倍)。那种情况下
 * 宁可放宽上限,也不能没有解。
 */
function solve(width: number, a: CardSpec, b: CardSpec): BalancedColumns {
  return search(width, a, b, MAX_ELASTIC_TILE) ?? search(width, a, b, Infinity) ?? FALLBACK;
}

/**
 * 量一行的宽度,给出两张卡各自该排几列、各自占多宽。返回的 ref 挂到装两张卡的那个
 * flex 行上(回调 ref:那一行只在对应标签页选中时才存在,挂上/摘下都要跟着接/断
 * observer)。
 */
export function useBalancedColumns(
  left: CardSpec,
  right: CardSpec,
): readonly [(node: HTMLElement | null) => void, BalancedColumns] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    setWidth(node.clientWidth);
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    observer.current = ro;
  }, []);

  // 两张卡的规格是每次渲染新建的字面量,所以按各字段做依赖,别按对象引用。
  const { count: leftCount, fixed: leftFixed } = left;
  const { count: rightCount, fixed: rightFixed } = right;
  const cols = useMemo(
    () =>
      solve(width, { count: leftCount, fixed: leftFixed }, { count: rightCount, fixed: rightFixed }),
    [width, leftCount, leftFixed, rightCount, rightFixed],
  );
  return [ref, cols] as const;
}
