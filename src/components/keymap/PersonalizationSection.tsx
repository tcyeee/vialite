import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useLayerImageExport } from "../color/useLayerImageExport.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";

interface Props {
  keyboard: Keyboard;
  /** Layer the 导出当前层图片 export captures — the keymap page's active layer. */
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
 * The keymap page's 个性化 button row — 配置键盘颜色 / 导出当前层图片 /
 * 导出所有层图片 — laid out horizontally between the keyboard preview and the
 * config area below it. None of it depends on a key being selected, so it sits
 * outside `QuickConfigPanel`'s dim/swallow wrapper (but still inside
 * `[data-key-config]`, so clicking a button doesn't clear the selection).
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
    <section className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        className="btn btn-sm btn-outline"
        onClick={(e) => onOpenPersonalization(e.currentTarget)}
      >
        <Icon icon="mdi:palette-outline" className="h-4 w-4" />
        {t("configKeyboardColor")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        onClick={() => void saveCurrentLayer()}
        disabled={saving}
      >
        <Icon icon="mdi:image-outline" className="h-4 w-4" />
        {saving ? t("colorSaving") : t("exportCurrentLayerImage")}
      </button>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        onClick={() => void saveAllLayers()}
        disabled={saving || configuredLayers.length === 0}
      >
        <Icon icon="mdi:image-multiple-outline" className="h-4 w-4" />
        {saving ? t("colorSaving") : t("exportAllLayersImage")}
      </button>
      {/* Offscreen boards the two exports rasterize — inert, off-viewport DOM. */}
      {offscreenBoards}
    </section>
  );
}
