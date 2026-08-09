import type { ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../../contexts/i18n.tsx";
import { isBasicQmkId, withTap } from "../../../protocol/keycodes.ts";
import { MULTI_FUNC_FRAMEWORK, type MultiFuncMode } from "./configData.ts";

interface Props {
  /** 这张卡片代表的叠加方式,决定图标、说明和写进去的框架键码。 */
  mode: MultiFuncMode;
  /** 选中的键/编码器当前写着的 qmk_id(未选中时为 null)。据此决定框架的 tap
   *  基础:是基础键码就叠加进去,否则清空。 */
  currentQmkId?: string | null;
  onPick: (qmkId: string) => void;
}

/**
 * 斜线分隔的复合图标:左上是轻触发出的基础按键,右下是长按扮演的角色(修饰键 / 层)
 * ——和键帽上双功能键分成上下两半的画法是同一套语言。
 */
function SplitIcon({ hold }: { hold: string }) {
  return (
    <span className="relative block size-10 shrink-0" aria-hidden="true">
      <Icon icon="mdi:keyboard-outline" className="absolute top-0 left-0 size-6" />
      <Icon icon={hold} className="absolute right-0 bottom-0 size-6" />
      {/* 分隔两枚图标的白色斜线(左下 → 右上)。 */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom right, transparent calc(50% - 0.75px), #ffffff calc(50% - 0.75px), #ffffff calc(50% + 0.75px), transparent calc(50% + 0.75px))",
        }}
      />
    </span>
  );
}

/** 每张卡片正文里那枚大图标。单击叠加是「一起发出」,所以不劈成两半。 */
const MODE_ICON: Record<MultiFuncMode, ReactNode> = {
  tapMod: (
    <Icon icon="mdi:apple-keyboard-command" className="size-10 shrink-0" aria-hidden="true" />
  ),
  holdMod: <SplitIcon hold="mdi:apple-keyboard-command" />,
  holdLayer: <SplitIcon hold="mdi:layers-outline" />,
};

const MODE_DESC: Record<MultiFuncMode, MessageKey> = {
  tapMod: "multiFuncTapModDesc",
  holdMod: "multiFuncHoldModDesc",
  holdLayer: "multiFuncHoldLayerDesc",
};

/**
 * 配置区域「按键叠加」页里一张卡片的正文:一句说明 + 一块点击区,点一下就把这张卡片
 * 对应的框架键码写进当前选中的键。修饰键组合 / 目标层的细调留给键盘上那颗键的长按
 * 半区(`DualRoleEditor`),这里只负责搭框架。
 */
export function MultiFunctionBody({ mode, currentQmkId, onPick }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex w-full flex-col gap-3">
      <p className="text-xs leading-relaxed opacity-70">{t(MODE_DESC[mode])}</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          // 选中键当前是基础键码就叠加进新框架的 tap 半区,
          // 否则(非基础键码 / 未选中)清空,用空 KC_NO 基础。
          const base = currentQmkId && isBasicQmkId(currentQmkId) ? currentQmkId : "KC_NO";
          onPick(withTap(MULTI_FUNC_FRAMEWORK[mode], base));
        }}
        className="mt-auto flex flex-col items-center gap-3 rounded-lg bg-white/10 p-4 text-center transition-colors hover:bg-white/20"
      >
        {MODE_ICON[mode]}
        <span className="text-xs leading-snug">{t("multiFuncApply")}</span>
      </button>
    </div>
  );
}
