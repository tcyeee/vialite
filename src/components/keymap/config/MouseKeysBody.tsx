import { Icon } from "@iconify/react";
import { useI18n } from "../../../contexts/i18n.tsx";
import type { KeycodeDef } from "../../../protocol/keycodes.ts";

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
 * 配置区域「鼠标按键」页的正文:指针移动与滚轮各摆成一个方向键十字并排,鼠标按键
 * 与移动速度各占一行竖着排在下面。和其它页的方格键一样是 `combo-num-card` 白字瓦片,所以整页
 * 铺在深色卡面上。
 */
export function MouseKeysBody({
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
      <div className="flex justify-center gap-4">
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
      <div className="flex flex-col items-start gap-4">
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
