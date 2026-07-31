import { useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { composeLayers, downloadCanvas, frameBoard, nodeToCanvas } from "./layoutImage.ts";
import { KeyboardLayoutPreview } from "../keymap/layout/KeyboardLayoutPreview.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";

interface Options {
  keyboard: Keyboard;
  /** Layer captured by {@link LayerImageExport.saveCurrentLayer}. */
  layer: number;
  /** Connected device's WebHID product name, stamped into the exported image. */
  productName?: string;
  /**
   * Preview zoom applied to the offscreen boards, so the exported image comes
   * out at the same scale as the visible one (both sides pass the caller's
   * `useAutoFitZoom` value).
   */
  zoomOverride?: number | null;
  /**
   * Visible board node to rasterize for the current-layer export. Omit it to
   * capture the offscreen board for {@link layer} instead — the keymap page has
   * no display-only board of its own (its board is the interactive editor).
   */
  currentBoardRef?: RefObject<HTMLDivElement | null>;
}

export interface LayerImageExport {
  /** True while a capture is in flight; both buttons disable on it. */
  saving: boolean;
  /** Download the current layer as a framed PNG. */
  saveCurrentLayer: () => Promise<void>;
  /** Download every configured layer stitched into one PNG. */
  saveAllLayers: () => Promise<void>;
  /** Layers the user has actually configured — empty means nothing to export. */
  configuredLayers: number[];
  /**
   * Offscreen boards backing the exports. Must be rendered by the caller (it is
   * inert, absolutely-positioned, `aria-hidden` markup) for either save to work.
   */
  offscreenBoards: ReactNode;
}

/**
 * Keyboard-layout image export (保存当前层图片 / 保存所有层图片), shared by the
 * 个性化 page's fullscreen board actions and the 键位 page's quick-config 个性化
 * block so both produce byte-identical images from one implementation.
 *
 * Capture reads real, laid-out DOM, so the boards it rasterizes have to be
 * mounted: {@link LayerImageExport.offscreenBoards} renders one hidden board per
 * exportable layer, letting the all-layers export run without flipping the
 * visible layer tab.
 */
export function useLayerImageExport({
  keyboard,
  layer,
  productName,
  zoomOverride,
  currentBoardRef,
}: Options): LayerImageExport {
  const { t } = useI18n();
  const hiddenBoardRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [saving, setSaving] = useState(false);
  // Only layers the user has actually configured get exported in the all-layers
  // image; recomputed each render since Keyboard mutates its keymap in place.
  const configuredLayers = useMemo(
    () =>
      Array.from({ length: keyboard.layers }, (_, i) => i).filter((l) =>
        keyboard.isLayerConfigured(l),
      ),
    [keyboard, keyboard.layoutOptions],
  );
  // The current layer gets an offscreen board even when unconfigured, so
  // "save current layer" works on a blank layer too (and so callers without a
  // display-only board of their own always have a node to capture).
  const offscreenLayers = useMemo(
    () => (configuredLayers.includes(layer) ? configuredLayers : [...configuredLayers, layer]),
    [configuredLayers, layer],
  );

  const saveCurrentLayer = async () => {
    const node = currentBoardRef?.current ?? hiddenBoardRefs.current[layer];
    if (!node || saving) {
      return;
    }
    setSaving(true);
    try {
      const canvas = await nodeToCanvas(node);
      downloadCanvas(frameBoard(canvas, productName), `keyboard-layer-${layer}.png`);
    } finally {
      setSaving(false);
    }
  };

  const saveAllLayers = async () => {
    if (saving || configuredLayers.length === 0) {
      return;
    }
    setSaving(true);
    try {
      const cells = [];
      for (const l of configuredLayers) {
        const node = hiddenBoardRefs.current[l];
        if (!node) {
          continue;
        }
        cells.push({ canvas: await nodeToCanvas(node), label: t("layerN", { n: l }) });
      }
      if (cells.length > 0) {
        downloadCanvas(composeLayers(cells, productName), "keyboard-all-layers.png");
      }
    } finally {
      setSaving(false);
    }
  };

  // Kept mounted even while the page around them is `hidden`, so a capture never
  // has to wait for a board to mount. `aria-hidden` + off-viewport positioning
  // keeps them out of the a11y tree and layout flow while still being real,
  // measurable DOM.
  const offscreenBoards = (
    <div aria-hidden style={{ position: "absolute", left: -99999, top: 0, pointerEvents: "none" }}>
      {offscreenLayers.map((l) => (
        <div
          key={l}
          ref={(el) => {
            hiddenBoardRefs.current[l] = el;
          }}
          style={{ width: "fit-content" }}
        >
          {/* Same zoom as the visible board, so the all-layers export and the
              current-layer export come out at one consistent scale. */}
          <KeyboardLayoutPreview keyboard={keyboard} layer={l} zoomOverride={zoomOverride} />
        </div>
      ))}
    </div>
  );

  return { saving, saveCurrentLayer, saveAllLayers, configuredLayers, offscreenBoards };
}
