import { Icon } from "@iconify/react";
import { useI18n } from "../../../contexts/i18n.tsx";
import { useLayerImageExport } from "../../color/useLayerImageExport.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import { ALWAYS_ENABLED_ATTR } from "./quickConfigData.ts";

interface Props {
  keyboard: Keyboard;
  /** Layer the 保存当前层图片 export captures — the keymap page's active layer. */
  layer: number;
  /** Connected device's WebHID product name, stamped into exported images. */
  productName?: string;
  /**
   * The keymap board's auto-fit zoom, forwarded to the offscreen export boards so
   * the saved image comes out at the same scale as the board on screen.
   */
  zoomOverride?: number | null;
  /** Opens the 个性化 page via the same hero View Transition NewHomePage uses. */
  onOpenPersonalization: (origin: Element) => void;
}

/**
 * Basic tab's 个性化 block, sitting below 特殊按键区域: the two layout-image
 * exports plus a jump into the 个性化 page. Like 配置设置 it's panel-level — none
 * of it depends on a key being selected — so it carries {@link
 * ALWAYS_ENABLED_ATTR} and is never dimmed by `QuickConfigPanel`.
 */
export function PersonalizationSection({
  keyboard,
  layer,
  productName,
  zoomOverride,
  onOpenPersonalization,
}: Props) {
  const { t } = useI18n();
  const { saving, saveCurrentLayer, saveAllLayers, configuredLayers, offscreenBoards } =
    useLayerImageExport({ keyboard, layer, productName, zoomOverride });

  return (
    <section
      className="flex w-full flex-col items-center"
      {...{ [ALWAYS_ENABLED_ATTR]: "" }}
    >
      <h4 className="mb-2 text-sm font-semibold opacity-70">{t("navKeyboardColor")}</h4>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => void saveCurrentLayer()}
          disabled={saving}
        >
          <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
          {saving ? t("colorSaving") : t("colorSaveCurrentLayer")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={() => void saveAllLayers()}
          disabled={saving || configuredLayers.length === 0}
        >
          <Icon icon="mdi:content-save-outline" className="h-4 w-4" />
          {saving ? t("colorSaving") : t("colorSaveAllLayers")}
        </button>
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={(e) => onOpenPersonalization(e.currentTarget)}
        >
          <Icon icon="mdi:palette-outline" className="h-4 w-4" />
          {t("personalizationSettings")}
        </button>
      </div>
      {/* Offscreen boards the two exports rasterize — inert, off-viewport DOM. */}
      {offscreenBoards}
    </section>
  );
}
