import { Icon } from "@iconify/react";
import { useI18n } from "../../../contexts/i18n.tsx";
import { isBasicQmkId, withTap } from "../../../protocol/keycodes.ts";
import { MULTI_FUNC_FRAMEWORK } from "./quickConfigData.ts";

interface Props {
  /** 选中的键/编码器当前写着的 qmk_id(未选中时为 null)。据此决定 modified/taphold
   *  框架的 tap 基础:是基础键码就叠加进去,否则清空。 */
  currentQmkId?: string | null;
  onPick: (qmkId: string) => void;
}

/**
 * The 多功能 (Multi-Function) card's custom body: two category buttons
 * (modified / tap-hold) that write a dual-role framework keycode to the
 * selected key on click. Extracted from `QuickConfigPanel`, which supplies
 * this as the card's `custom:` content.
 */
export function MultiFunctionCardBody({ currentQmkId, onPick }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-snug opacity-70">{t("multiFuncIntro")}</p>
      <div className="flex gap-3">
        {(
          [
            {
              mode: "modified",
              desc: t("multiFuncModified"),
              // 修饰键:单个 ⌘ 图标。
              iconNode: (
                <Icon icon="mdi:apple-keyboard-command" className="size-10 shrink-0" aria-hidden="true" />
              ),
            },
            {
              mode: "taphold",
              desc: t("multiFuncTapHold"),
              // 长按激活层/修饰键:⌘ 叠加 层图标,左上角 ⌘、右下角
              // 层,表达"轻触出键、长按切层/修饰"的双重角色。
              iconNode: (
                <span className="relative block size-10 shrink-0" aria-hidden="true">
                  <Icon icon="mdi:apple-keyboard-command" className="absolute top-0 left-0 size-6" />
                  <Icon icon="mdi:layers-outline" className="absolute right-0 bottom-0 size-6" />
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
            // Clicking a category is the whole interaction: the framework
            // keycode is written to the selected key at once. Editing its
            // halves happens later on the keyboard itself (out of scope here).
            onClick={(e) => {
              e.stopPropagation();
              // 选中键当前是基础键码就叠加进新框架的 tap 半区,
              // 否则(非基础键码 / 未选中)清空,用空 KC_NO 基础。
              const base = currentQmkId && isBasicQmkId(currentQmkId) ? currentQmkId : "KC_NO";
              onPick(withTap(MULTI_FUNC_FRAMEWORK[mode], base));
            }}
            className="flex flex-1 flex-col items-center gap-3 rounded-lg bg-white/10 p-3 text-center transition-colors hover:bg-white/20"
          >
            {iconNode}
            <span className="text-xs leading-snug">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
