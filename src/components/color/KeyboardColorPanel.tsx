import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useToast } from "../../contexts/toast.tsx";
import { useLayerImageExport } from "./useLayerImageExport.tsx";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { keyFor, usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import {
  configSwapName,
  KEYBOARD_HERO_NAME,
  type ConfigSwapSide,
} from "../common/viewTransition.ts";
import { ColorPicker } from "../common/ColorPicker.tsx";
import { LayoutOptions } from "../layout/LayoutOptions.tsx";
import { LayerTabBar } from "../keymap/LayerTabs.tsx";
import { paintCursor, type PaintBrush } from "../keymap/layout/appearance.tsx";
import { useAutoFitZoom } from "../keymap/layout/autoFitSize.ts";
import { FullscreenPreviewOverlay, useFullscreenPreview } from "../keymap/style/StyleConfig.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";
import {
  FONT_SIZES,
  KeyboardLayoutPreview,
  KEYCAP_RADIUS_LEVELS,
  SPACING_LEVELS,
  type FontPosition,
  type PreviewContextTarget,
  type PreviewSize,
} from "../keymap/layout/KeyboardLayoutPreview.tsx";
import { KeycapColorManager } from "./KeycapColorManager.tsx";

const CASE_RECENT_KEY = "vialite-color-case-recent";
const PLATE_RECENT_KEY = "vialite-color-plate-recent";
const FONT_RECENT_KEY = "vialite-color-font-recent";
const MAX_RECENT_COLORS = 3;
const SIZES: PreviewSize[] = ["xs", "s", "m", "l", "xl"];
const LEVEL_LABELS = { xs: "XS", s: "S", m: "M", l: "L", xl: "XL" } as const;

function readStoredColors(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c): c is string => typeof c === "string")
          .slice(0, MAX_RECENT_COLORS);
      }
    }
  } catch {
    // Fall through to default.
  }
  return [];
}

function store(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Non-persistent is fine.
  }
}

/**
 * 键盘配色 (Keyboard Color) page. Shows a compact, display-only preview of the
 * physical layout read from the connected board — no per-key color action
 * wired up yet — plus a button into the fullscreen config page
 * (`FullscreenPreviewOverlay`), which is where every appearance setting
 * (size, font, keycap, case, layout options) actually lives: physical layout,
 * display size, key spacing, case, and plate. Their rows reuse {@link
 * SettingsRow} for a consistent look with the QMK Settings page.
 */
export function KeyboardColorPanel({
  keyboard,
  productName,
  heroArriving,
  configSwapFrom,
  onBackToHome,
  onOpenPreview3d,
  onOpenKeymap,
}: {
  keyboard: Keyboard;
  /** Connected device's WebHID product name, stamped into exported images — see `saveCurrentLayer`/`saveAllLayers`. */
  productName?: string;
  /**
   * True for the brief window (driven by `App.tsx`'s `handlePersonalize`)
   * while a page-level View Transition is morphing the hero keyboard from
   * NewHomePage's preview box into this page's board. Tags the current-layer
   * board wrapper with the same `KEYBOARD_HERO_NAME` the outgoing NewHomePage
   * box carries, so the browser animates between the two instead of a hard
   * cut — same mechanism `useFullscreenPreview` uses for the compact↔fullscreen
   * toggle within this page, just spanning the App-level route swap instead.
   */
  heroArriving?: boolean;
  /**
   * 本次导航是从 键盘配置 还是 个性化 离开的,只在这两个页面互切时非 null(见
   * `usePageNavigation` 的 `configSwapFrom`)。转成 `view-transition-name` 挂到
   * 全屏页那块设置区上,让它跟 键盘配置 页下方的配置区做接力式的上滑/下滑切换。
   */
  configSwapFrom?: ConfigSwapSide | null;
  /**
   * The fullscreen 个性化 page's corner "back" button routes here instead of
   * just collapsing to this component's own compact preview — see
   * `App.tsx`'s `handleBackToHome`. Forwarded straight through to
   * `FullscreenPreviewOverlay`'s `onBack`.
   */
  onBackToHome: (origin: Element) => void;
  /**
   * Pushes to the standalone 3D 预览 page (see `App.tsx`'s `nav.navigateSlide`).
   * Its only entry point used to be a NewHomePage menu item; it now lives here
   * instead, at the bottom of 个性化, right next to the fullscreen button.
   */
  onOpenPreview3d?: () => void;
  /**
   * "键盘按键配置", the button left of 保存当前层图片 below the board: jumps to the
   * keymap page via `App.tsx`'s `nav.handleGoToKeymap`, so the hero keyboard
   * morphs across the route swap the same way entering this page does.
   */
  onOpenKeymap?: (origin: Element) => void;
}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const { keyDisplay, setKeyDisplay, mediaReset, setMediaReset } = useKeyDisplay();
  // Arriving via NewHomePage's hero "个性化" button should land directly on
  // this page's fullscreen 个性化 settings (StyleConfig.tsx), not the compact
  // preview underneath it — see useFullscreenPreview's initialFullscreen doc.
  // Reached via QuickConfigPanel's "配置预览样式" row instead, heroArriving is
  // false and the compact page shows as before.
  const fsPreview = useFullscreenPreview(heroArriving);
  // Appearance settings are shared with the main keymap board via context, so
  // tuning them here also restyles the interactive layout on the 键位 page.
  const {
    autoFit,
    size,
    spacing,
    caseRadius,
    keycapRadius,
    caseThickness,
    caseColor,
    plateColor,
    style,
    fontSize,
    fontColor,
    fontPosition,
    setAutoFit,
    setSize,
    setSpacing,
    setCaseRadius,
    setKeycapRadius,
    setCaseThickness,
    setCaseColor,
    setPlateColor,
    setStyle,
    setFontSize,
    setFontColor,
    setFontPosition,
    keycapPalette,
    keycapColors,
    addKeycapColor,
    updateKeycapColor,
    removeKeycapColor,
    paintKeycap,
  } = usePreviewAppearance();
  // Which layer's keycaps the preview labels; the layer tabs above the board
  // switch it, mirroring the 键盘布局 page. Purely a preview concern — no write.
  const [previewLayer, setPreviewLayer] = useState(0);
  // 键帽上色: while true, `settings` below swaps every section for
  // <KeycapColorManager>'s 颜色管理区 and the pinned board becomes paintable —
  // see the `paint`/`settings` props passed to FullscreenPreviewOverlay.
  const [coloringMode, setColoringMode] = useState(false);
  const [activeBrush, setActiveBrush] = useState<string | "eraser" | null>(null);
  const keycapHexById = useMemo(
    () => Object.fromEntries(keycapPalette.map((c) => [c.id, c.hex])),
    [keycapPalette],
  );
  // Distinct palette colors actually assigned to a key right now — shown as
  // the "键盘用到的颜色" swatches in keycapSection below, ahead of the "上色"
  // button that opens the full management panel.
  const usedPalette = useMemo(() => {
    const usedIds = new Set(Object.values(keycapColors));
    return keycapPalette.filter((c) => usedIds.has(c.id));
  }, [keycapPalette, keycapColors]);
  const handleCancelColoring = () => {
    setColoringMode(false);
    setActiveBrush(null);
  };
  const handlePaint = (row: number, col: number) => {
    if (activeBrush === null) {
      return;
    }
    paintKeycap(row, col, activeBrush === "eraser" ? null : activeBrush);
  };
  // Selected brush as a `PaintBrush`, or null while nothing (or the picker
  // itself) is selected — shared by the `paint` prop below and the
  // page-wide cursor effect so both agree on what's "currently selected".
  const activeTool: PaintBrush | null = useMemo(
    () =>
      activeBrush === null
        ? null
        : activeBrush === "eraser"
          ? { kind: "eraser" }
          : { kind: "color", hex: keycapHexById[activeBrush] },
    [activeBrush, keycapHexById],
  );
  // The 键帽上色 cursor (color dot / eraser ring) should follow the user
  // anywhere on the page while a brush is selected — not just while
  // hovering the board, since a "coloring mode" should read as globally
  // active until deselected or the page is left. Cleanup always resets to
  // the default, whether the brush is cleared or this page unmounts.
  useEffect(() => {
    if (!activeTool) return;
    document.body.style.cursor = paintCursor(activeTool);
    return () => {
      document.body.style.cursor = "";
    };
  }, [activeTool]);
  // Refs for image export: the visible board (current-layer save) and an
  // offscreen board per configured layer (all-layers save, stitched together).
  const currentBoardRef = useRef<HTMLDivElement>(null);
  // Overflow-scrolling viewport around the visible preview; its width is
  // independent of the board's, so auto-fit can measure it without feedback.
  const { ref: previewViewportRef, zoom: autoFitZoom } = useAutoFitZoom(keyboard);
  // Image export (保存当前层图片 / 保存所有层图片) is shared with the 键位 page's
  // quick-config 个性化 block; this page captures its own visible board for the
  // current layer so the export matches exactly what's on screen.
  const {
    saving,
    saveCurrentLayer,
    saveAllLayers,
    configuredLayers,
    offscreenBoards,
  } = useLayerImageExport({
    keyboard,
    layer: previewLayer,
    productName,
    zoomOverride: autoFitZoom,
    currentBoardRef,
  });

  // Right-click assign from the preview board, writing to the layer the preview
  // is currently showing.
  const handleContextAssign = async (target: PreviewContextTarget, qmkId: string) => {
    try {
      if (target.kind === "key") {
        await keyboard.setKey(previewLayer, target.row, target.col, qmkId);
      } else {
        await keyboard.setEncoder(previewLayer, target.index, target.direction, qmkId);
      }
    } catch (err) {
      showToast(t("writeKeyFailed", { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  // Scoped by keyboard.uid (see contexts/previewAppearance.tsx's `keyFor` doc
  // comment) so a second board's recent-color swatches don't bleed into this
  // one's — this component only mounts while a keyboard is connected and
  // fully unmounts on disconnect, so the lazy initializers below always read
  // the *currently* connected board's own history.
  const [caseRecent, setCaseRecent] = useState<string[]>(() =>
    readStoredColors(keyFor(CASE_RECENT_KEY, keyboard.uid)),
  );
  const [plateRecent, setPlateRecent] = useState<string[]>(() =>
    readStoredColors(keyFor(PLATE_RECENT_KEY, keyboard.uid)),
  );
  const [fontRecent, setFontRecent] = useState<string[]>(() =>
    readStoredColors(keyFor(FONT_RECENT_KEY, keyboard.uid)),
  );

  const sizeIndex = SIZES.indexOf(size);
  const fontSizeIndex = FONT_SIZES.indexOf(fontSize);
  const spacingIndex = SPACING_LEVELS.indexOf(spacing);
  const caseRadiusIndex = SPACING_LEVELS.indexOf(caseRadius);
  const keycapRadiusIndex = KEYCAP_RADIUS_LEVELS.indexOf(keycapRadius);
  // Thickness 0 hides the case entirely, so its color has nothing to paint —
  // grey the row out to signal it's inert.
  const caseHidden = caseThickness === 0;

  const onSizeChange = (index: number) => {
    setSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, index))]);
  };

  const onFontSizeChange = (index: number) => {
    setFontSize(FONT_SIZES[Math.min(FONT_SIZES.length - 1, Math.max(0, index))]);
  };

  const onSpacingChange = (index: number) => {
    setSpacing(SPACING_LEVELS[Math.min(SPACING_LEVELS.length - 1, Math.max(0, index))]);
  };

  const onCaseRadiusChange = (index: number) => {
    setCaseRadius(SPACING_LEVELS[Math.min(SPACING_LEVELS.length - 1, Math.max(0, index))]);
  };

  const onKeycapRadiusChange = (index: number) => {
    setKeycapRadius(
      KEYCAP_RADIUS_LEVELS[Math.min(KEYCAP_RADIUS_LEVELS.length - 1, Math.max(0, index))],
    );
  };

  const onCaseThicknessChange = (value: number) => {
    setCaseThickness(value);
  };

  // Commit the picked color to the per-field recent list (most recent first,
  // deduped, capped at three). Called when the picker popover closes — i.e. once
  // the user finishes picking — so dragging through the spectrum doesn't spam
  // history.
  const remember =
    (
      key: string,
      setRecent: React.Dispatch<React.SetStateAction<string[]>>,
    ): ((value: string) => void) =>
    (value) => {
      setRecent((prev) => {
        const next = [
          value,
          ...prev.filter((c) => c.toLowerCase() !== value.toLowerCase()),
        ].slice(0, MAX_RECENT_COLORS);
        store(key, JSON.stringify(next));
        return next;
      });
    };

  const rememberCaseColor = remember(keyFor(CASE_RECENT_KEY, keyboard.uid), setCaseRecent);
  const rememberPlateColor = remember(keyFor(PLATE_RECENT_KEY, keyboard.uid), setPlateRecent);
  const rememberFontColor = remember(keyFor(FONT_RECENT_KEY, keyboard.uid), setFontRecent);

  // All appearance settings now live on the fullscreen config page (see
  // `FullscreenPreviewOverlay`'s `settings` prop below) rather than under the
  // compact preview — each `<section>` becomes one cell of its responsive
  // grid. Device layout options only get a section when the board actually
  // exposes any (mirrors `LayoutOptions`' own render-nothing guard, since it's
  // no longer passed the 全屏预览 trigger as a fallback child here).
  const hasLayoutOptions = !!keyboard.layoutLabels?.length && keyboard.layoutOptions >= 0;

  const sizeSection = (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
        {t("colorSizeSectionTitle")}
      </h2>
      <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<Icon icon="mdi:fit-to-screen-outline" className="h-5 w-5" />}
            label={t("previewAutoFitTitle")}
            description={t("previewAutoFitDesc")}
            control={
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={autoFit}
                onChange={(e) => setAutoFit(e.target.checked)}
                aria-label={t("previewAutoFitTitle")}
              />
            }
          />
          {/* The manual scale only means something once auto-fit stops driving
              the board, so it's hidden rather than shown-but-inert. It stays
              mounted and collapses to zero height (`collapsed`) so toggling
              auto-fit animates the row in and out instead of snapping. */}
          <SettingsRow
            icon={<Icon icon="mdi:arrow-expand-all" className="h-5 w-5" />}
            label={t("displaySizeTitle")}
            collapsed={autoFit}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={SIZES.length - 1}
                  step={1}
                  value={sizeIndex}
                  onChange={(e) => onSizeChange(Number(e.target.value))}
                  className="range range-primary range-xs w-40"
                  aria-label={t("displaySizeTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {LEVEL_LABELS[size]}
                </span>
              </div>
            }
          />
          {/* Binary switch over the 4-value `style` enum (wireframe/default/relief/3d,
              see PreviewStyle) — on/off only ever set relief/default, matching the
              two states this toggle has always exposed. wireframe/3d have no UI
              entry point yet. */}
          <SettingsRow
            icon={<Icon icon="mdi:cube-outline" className="h-5 w-5" />}
            label={t("depthTitle")}
            description={t("depthDesc")}
            control={
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={style === "relief"}
                onChange={(e) => setStyle(e.target.checked ? "relief" : "default")}
                aria-label={t("depthTitle")}
              />
            }
          />
      </ul>
    </section>
  );

  // Image export buttons: rendered below the board on the fullscreen page
  // (FullscreenPreviewOverlay's `boardActions`), centered, rather than buried
  // in the settings grid, so they stay reachable without scrolling regardless
  // of which settings section is open.
  const screenshotActions = (
    <div className="flex items-center gap-2">
      {/* 键盘按键配置: leaves 个性化 for the keymap page, using the same hero
          keyboard morph the entry into this page uses (App.tsx's
          nav.handleGoToKeymap). Shown only when the host wires it up. */}
      {onOpenKeymap && (
        <button
          type="button"
          className="btn btn-sm btn-outline"
          onClick={(e) => onOpenKeymap(e.currentTarget)}
        >
          <Icon icon="mdi:keyboard-settings-outline" className="h-4 w-4" />
          {t("colorKeyConfig")}
        </button>
      )}
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
    </div>
  );

  const fontSection = (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
        {t("colorFontSectionTitle")}
      </h2>
      <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<Icon icon="mdi:keyboard-outline" className="h-5 w-5" />}
            label={t("keyDisplayTitle")}
            control={
              <div className="join">
                <button
                  type="button"
                  className={"btn btn-sm join-item" + (keyDisplay === "macos" ? " btn-primary" : " btn-outline")}
                  onClick={() => setKeyDisplay("macos")}
                >
                  <Icon icon="mdi:apple-keyboard-command" className="h-3 w-3" />
                  {t("keyDisplayMacos")}
                </button>
                <button
                  type="button"
                  className={"btn btn-sm join-item" + (keyDisplay === "windows" ? " btn-primary" : " btn-outline")}
                  onClick={() => setKeyDisplay("windows")}
                >
                  <Icon icon="mdi:microsoft-windows" className="h-4 w-4" />
                  {t("keyDisplayWindows")}
                </button>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:format-size" className="h-5 w-5" />}
            label={t("fontSizeTitle")}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={FONT_SIZES.length - 1}
                  step={1}
                  value={fontSizeIndex}
                  onChange={(e) => onFontSizeChange(Number(e.target.value))}
                  className="range range-primary range-xs w-40"
                  aria-label={t("fontSizeTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {LEVEL_LABELS[fontSize]}
                </span>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:format-color-text" className="h-5 w-5" />}
            label={t("fontColorTitle")}
            control={
              <div className="flex items-center gap-2">
                <RecentColorSwatches
                  colors={fontRecent}
                  onPick={setFontColor}
                  label={t("fontColorTitle")}
                />
                <div className="mr-2">
                  <ColorPicker
                    value={fontColor}
                    onChange={setFontColor}
                    onCommit={rememberFontColor}
                    label={t("fontColorTitle")}
                  />
                </div>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:format-textbox" className="h-5 w-5" />}
            label={t("fontPositionTitle")}
            control={
              <div className="join">
                {(
                  [
                    ["top-left", t("fontPositionTopLeft")],
                    ["center", t("fontPositionCenter")],
                    ["center-bottom", t("fontPositionCenterBottom")],
                  ] as [FontPosition, string][]
                ).map(([value, text]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      "btn btn-sm join-item" +
                      (fontPosition === value ? " btn-primary" : " btn-outline")
                    }
                    onClick={() => setFontPosition(value)}
                  >
                    {text}
                  </button>
                ))}
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:music-note-outline" className="h-5 w-5" />}
            label={t("mediaResetTitle")}
            badge={<span className="badge badge-secondary badge-sm">Beta</span>}
            description={t("mediaResetDesc")}
            control={
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={mediaReset}
                onChange={(e) => setMediaReset(e.target.checked)}
                aria-label={t("mediaResetTitle")}
              />
            }
          />
      </ul>
    </section>
  );

  const keycapSection = (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
        {t("colorKeycapSectionTitle")}
      </h2>
      <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<Icon icon="mdi:arrow-expand-horizontal" className="h-5 w-5" />}
            label={t("keySpacingTitle")}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={SPACING_LEVELS.length - 1}
                  step={1}
                  value={spacingIndex}
                  onChange={(e) => onSpacingChange(Number(e.target.value))}
                  className="range range-primary range-xs w-40"
                  aria-label={t("keySpacingTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {LEVEL_LABELS[spacing]}
                </span>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:rounded-corner" className="h-5 w-5" />}
            label={t("keycapRadiusTitle")}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={KEYCAP_RADIUS_LEVELS.length - 1}
                  step={1}
                  value={keycapRadiusIndex}
                  onChange={(e) => onKeycapRadiusChange(Number(e.target.value))}
                  className="range range-primary range-xs w-40"
                  aria-label={t("keycapRadiusTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {LEVEL_LABELS[keycapRadius]}
                </span>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:palette-outline" className="h-5 w-5" />}
            label={t("keycapColorTitle")}
            control={
              <div className="flex items-center gap-2">
                {usedPalette.length > 0 ? (
                  <div className="flex items-center gap-1">
                    {usedPalette.map((c) => (
                      <span
                        key={c.id}
                        className="h-5 w-5 rounded-full border border-brand-outline/40"
                        style={{ backgroundColor: c.hex }}
                        title={c.hex}
                      />
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-brand-on-surface-variant/60">
                    {t("keycapColorNone")}
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-sm btn-outline gap-2"
                  onClick={() => setColoringMode(true)}
                >
                  <Icon icon="mdi:brush" className="h-4 w-4" />
                  {t("keycapColorButton")}
                </button>
              </div>
            }
          />
      </ul>
    </section>
  );

  const caseSection = (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
        {t("colorCaseSectionTitle")}
      </h2>
      <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<Icon icon="mdi:rounded-corner" className="h-5 w-5" />}
            label={t("caseRadiusTitle")}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={SPACING_LEVELS.length - 1}
                  step={1}
                  value={caseRadiusIndex}
                  onChange={(e) => onCaseRadiusChange(Number(e.target.value))}
                  className="range range-primary range-xs w-40"
                  aria-label={t("caseRadiusTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {LEVEL_LABELS[caseRadius]}
                </span>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:card-outline" className="h-5 w-5" />}
            label={t("caseThicknessTitle")}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={40}
                  step={1}
                  value={caseThickness}
                  onChange={(e) =>
                    onCaseThicknessChange(Number(e.target.value))
                  }
                  className="range range-primary range-xs w-40"
                  aria-label={t("caseThicknessTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {caseThickness}px
                </span>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:card-outline" className="h-5 w-5" />}
            label={t("caseColorTitle")}
            disabled={caseHidden}
            control={
              <div
                className={`flex items-center gap-2 ${caseHidden ? "pointer-events-none" : ""}`}
              >
                <RecentColorSwatches
                  colors={caseRecent}
                  onPick={setCaseColor}
                  label={t("caseColorTitle")}
                />
                <div className="mr-2">
                  <ColorPicker
                    value={caseColor}
                    onChange={setCaseColor}
                    onCommit={rememberCaseColor}
                    disabled={caseHidden}
                    label={t("caseColorTitle")}
                  />
                </div>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:layers-outline" className="h-5 w-5" />}
            label={t("plateColorTitle")}
            control={
              <div className="flex items-center gap-2">
                <RecentColorSwatches
                  colors={plateRecent}
                  onPick={setPlateColor}
                  label={t("plateColorTitle")}
                />
                <div className="mr-2">
                  <ColorPicker
                    value={plateColor}
                    onChange={setPlateColor}
                    onCommit={rememberPlateColor}
                    label={t("plateColorTitle")}
                  />
                </div>
              </div>
            }
          />
      </ul>
    </section>
  );

  const layoutSection = hasLayoutOptions ? (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
        {t("colorLayoutTitle")}
      </h2>
      <LayoutOptions keyboard={keyboard} />
    </section>
  ) : null;

  return (
    <>
      <div className="flex flex-col gap-4 pb-[30px]" hidden={fsPreview.fullscreen}>
        <p className="text-xs text-brand-on-surface-variant/70">{t("colorDisplayNote")}</p>
        {/* The layer tabs stay in normal flow (they scroll away); only the board
            below is pinned. Kept as a sibling of the sticky board — not its
            child — so the board's sticky containing block is the whole panel. */}
        <LayerTabBar
          layers={keyboard.layers}
          active={previewLayer}
          onSelect={setPreviewLayer}
          isConfigured={(l) => keyboard.isLayerConfigured(l)}
        />
        {/* Pin only the board to the top so it stays visible while the page
            scrolls under it (see ColorPicker's fixed-popover note). `top-0`
            sticks it flush to the viewport top (no navbar above it anymore);
            the page-matching background occludes content scrolling beneath.
            The `-mx-4 … px-4` self-cancelling margins give the shaded case
            shadow room without clipping it in `overflow-x-auto`. */}
        <div
          ref={previewViewportRef}
          className="sticky top-0 z-20 -mx-4 -mb-4 -mt-2 overflow-x-auto bg-[#E9E6E6] px-4 pb-6 pt-2 dark:bg-brand-background"
        >
          {/* Keyed on the active layer so switching tabs re-fires the appear
              animation, mirroring LayerTabs' own content box. */}
          <div key={previewLayer} className="tab-panel-appear w-fit">
            {/* Reads every appearance value from the shared context, so it stays
                in sync with the fullscreen page's controls and identical to
                previews elsewhere. The ref wrapper is the exact node rasterized
                for the current-layer image (fit-content, so it hugs the board
                with no extra margin). */}
            <div
              ref={currentBoardRef}
              style={{
                width: "fit-content",
                viewTransitionName: fsPreview.heroName ?? (heroArriving ? KEYBOARD_HERO_NAME : undefined),
              }}
            >
              <KeyboardLayoutPreview
                keyboard={keyboard}
                layer={previewLayer}
                zoomOverride={autoFitZoom}
                onContextAssign={handleContextAssign}
              />
            </div>
          </div>
        </div>

        {/* All appearance settings (size, font, keycap, case, layout) now live
            on the fullscreen config page opened by this button, rather than
            scrolling below the board here — see `FullscreenPreviewOverlay`'s
            `settings` prop below. 3D 预览的入口现在也在这里——原先首页菜单的
            那一份已经去掉,见 navItems.ts。 */}
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className="btn btn-outline gap-2"
            onClick={(e) => fsPreview.open(e.currentTarget)}
          >
            <Icon icon="mdi:fullscreen" className="h-4 w-4" />
            {t("fullscreenPreviewButton")}
          </button>
          {onOpenPreview3d && (
            <button type="button" className="btn btn-outline gap-2" onClick={onOpenPreview3d}>
              <Icon icon="mdi:cube-outline" className="h-4 w-4" />
              {t("navPreview3d")}
              <span className="badge badge-secondary badge-sm">Beta</span>
            </button>
          )}
        </div>
      </div>

      {/* Offscreen boards backing the all-layers export — its buttons live in
          the fullscreen page's board actions — so it can rasterize each layer
          without flipping the visible tab. */}
      {offscreenBoards}

      <FullscreenPreviewOverlay
        keyboard={keyboard}
        layer={previewLayer}
        handle={fsPreview}
        boardRef={currentBoardRef}
        heroArriving={heroArriving}
        settingsTransitionName={configSwapName(configSwapFrom ?? null, "color")}
        onBack={onBackToHome}
        boardActions={coloringMode ? undefined : screenshotActions}
        settings={
          coloringMode ? (
            <KeycapColorManager
              palette={keycapPalette}
              activeBrush={activeBrush}
              onSelectBrush={setActiveBrush}
              onAddColor={(hex) => setActiveBrush(addKeycapColor(hex))}
              onEditColor={updateKeycapColor}
              onDeleteColor={(id) => {
                removeKeycapColor(id);
                setActiveBrush((b) => (b === id ? null : b));
              }}
              onCancel={handleCancelColoring}
            />
          ) : (
            <>
              {sizeSection}
              {fontSection}
              {keycapSection}
              {caseSection}
              {layoutSection}
            </>
          )
        }
        paint={coloringMode ? { tool: activeTool, onPaint: handlePaint } : undefined}
      />
    </>
  );
}

/**
 * Circular swatches of the recently picked colors, shown left of a color input.
 * Clicking one re-applies that color to the field.
 */
function RecentColorSwatches({
  colors,
  onPick,
  label,
}: {
  colors: string[];
  onPick: (color: string) => void;
  label: string;
}) {
  if (colors.length === 0) return null;
  return (
    <div className="flex items-center gap-1">
      {colors.map((color, i) => (
        <button
          key={`${color}-${i}`}
          type="button"
          onClick={() => onPick(color)}
          className="h-5 w-5 rounded-full border border-brand-outline/40"
          style={{ backgroundColor: color }}
          title={color}
          aria-label={`${label}: ${color}`}
        />
      ))}
    </div>
  );
}
