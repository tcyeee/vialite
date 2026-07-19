import { useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { composeLayers, downloadCanvas, frameBoard, nodeToCanvas } from "./layoutImage.ts";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { ColorPicker } from "../common/ColorPicker.tsx";
import { LayoutOptions } from "../layout/LayoutOptions.tsx";
import { LayerTabBar } from "../keymap/LayerTabs.tsx";
import { useAutoFitZoom } from "../keymap/autoFitSize.ts";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";
import {
  FONT_SIZES,
  KeyboardLayoutPreview,
  SPACING_LEVELS,
  type FontPosition,
  type PreviewSize,
} from "../keymap/KeyboardLayoutPreview.tsx";

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
 * 键盘配色 (Keyboard Color) page. For now a display-only preview of the physical
 * layout read from the connected board — no per-key color action wired up yet.
 * The Layout section (when the board exposes layout options) and the Appearance
 * settings below tune the preview's physical layout, display size, key spacing,
 * case, and plate; their rows reuse {@link SettingsRow} for a consistent look
 * with the QMK Settings page.
 */
export function KeyboardColorPanel({
  keyboard,
  onChange,
}: {
  keyboard: Keyboard;
  /** Called after a layout option was written to the device, so the parent re-renders. */
  onChange: () => void;
}) {
  const { t } = useI18n();
  const { keyDisplay, setKeyDisplay, mediaReset, setMediaReset } = useKeyDisplay();
  const hasLayoutOptions =
    !!keyboard.layoutLabels &&
    keyboard.layoutLabels.length > 0 &&
    keyboard.layoutOptions >= 0;
  // Appearance settings are shared with the main keymap board via context, so
  // tuning them here also restyles the interactive layout on the 键位 page.
  const {
    autoFit,
    size,
    spacing,
    caseRadius,
    caseThickness,
    caseColor,
    plateColor,
    depth,
    fontSize,
    fontColor,
    fontPosition,
    setAutoFit,
    setSize,
    setSpacing,
    setCaseRadius,
    setCaseThickness,
    setCaseColor,
    setPlateColor,
    setDepth,
    setFontSize,
    setFontColor,
    setFontPosition,
  } = usePreviewAppearance();
  // Which layer's keycaps the preview labels; the layer tabs above the board
  // switch it, mirroring the 键盘布局 page. Purely a preview concern — no write.
  const [previewLayer, setPreviewLayer] = useState(0);
  // Refs for image export: the visible board (current-layer save) and an
  // offscreen board per configured layer (all-layers save, stitched together).
  const currentBoardRef = useRef<HTMLDivElement>(null);
  // Overflow-scrolling viewport around the visible preview; its width is
  // independent of the board's, so auto-fit can measure it without feedback.
  const { ref: previewViewportRef, zoom: autoFitZoom } = useAutoFitZoom(keyboard);
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

  const saveCurrentLayer = async () => {
    if (!currentBoardRef.current || saving) {
      return;
    }
    setSaving(true);
    try {
      const canvas = await nodeToCanvas(currentBoardRef.current);
      downloadCanvas(frameBoard(canvas), `keyboard-layer-${previewLayer}.png`);
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
        downloadCanvas(composeLayers(cells), "keyboard-all-layers.png");
      }
    } finally {
      setSaving(false);
    }
  };

  const [caseRecent, setCaseRecent] = useState<string[]>(() =>
    readStoredColors(CASE_RECENT_KEY),
  );
  const [plateRecent, setPlateRecent] = useState<string[]>(() =>
    readStoredColors(PLATE_RECENT_KEY),
  );
  const [fontRecent, setFontRecent] = useState<string[]>(() =>
    readStoredColors(FONT_RECENT_KEY),
  );

  const sizeIndex = SIZES.indexOf(size);
  const fontSizeIndex = FONT_SIZES.indexOf(fontSize);
  const spacingIndex = SPACING_LEVELS.indexOf(spacing);
  const caseRadiusIndex = SPACING_LEVELS.indexOf(caseRadius);
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

  const rememberCaseColor = remember(CASE_RECENT_KEY, setCaseRecent);
  const rememberPlateColor = remember(PLATE_RECENT_KEY, setPlateRecent);
  const rememberFontColor = remember(FONT_RECENT_KEY, setFontRecent);

  return (
    <div className="flex flex-col gap-4 pb-[30px]">
      <p className="text-xs text-brand-on-surface-variant/70">
        {t("colorDisplayNote")}
      </p>
      {/* The layer tabs stay in normal flow (they scroll away); only the board
          below is pinned. Kept as a sibling of the sticky board — not its
          child — so the board's sticky containing block is the whole panel. */}
      <LayerTabBar
        layers={keyboard.layers}
        active={previewLayer}
        onSelect={setPreviewLayer}
        isConfigured={(l) => keyboard.isLayerConfigured(l)}
      />
      {/* Pin only the board to the top so it stays visible while the settings
          rows below scroll under it (see ColorPicker's fixed-popover note).
          `top-16` clears the sticky Navbar (h-16); the page-matching background
          occludes content scrolling beneath, and z-20 keeps it under the z-30
          Navbar. The `-mx-4 … px-4` self-cancelling margins give the shaded case
          shadow room without clipping it in `overflow-x-auto`. */}
      <div
        ref={previewViewportRef}
        className="sticky top-16 z-20 -mx-4 -mb-4 -mt-2 overflow-x-auto bg-white px-4 pb-6 pt-2 dark:bg-brand-background"
      >
        {/* Keyed on the active layer so switching tabs re-fires the appear
            animation, mirroring LayerTabs' own content box. */}
        <div key={previewLayer} className="tab-panel-appear w-fit">
          {/* Reads every appearance value from the shared context, so it stays in
              sync with the controls below and identical to previews elsewhere.
              The ref wrapper is the exact node rasterized for the current-layer
              image (fit-content, so it hugs the board with no extra margin).
              The save actions live in the 整体配置 settings list below rather
              than as a hover overlay here, so the board is never covered. */}
          <div ref={currentBoardRef} style={{ width: "fit-content" }}>
            <KeyboardLayoutPreview
              keyboard={keyboard}
              layer={previewLayer}
              zoomOverride={autoFitZoom}
            />
          </div>
        </div>
      </div>

      {/* Offscreen boards, one per configured layer, kept mounted so the
          all-layers export can rasterize each without flipping the visible tab.
          Rendered with the same shared appearance context as the visible board.
          `aria-hidden` + off-viewport positioning keeps them out of the a11y tree
          and layout flow while still being real, measurable DOM for capture. */}
      <div
        aria-hidden
        style={{ position: "absolute", left: -99999, top: 0, pointerEvents: "none" }}
      >
        {configuredLayers.map((l) => (
          <div
            key={l}
            ref={(el) => {
              hiddenBoardRefs.current[l] = el;
            }}
            style={{ width: "fit-content" }}
          >
            {/* Same zoom as the visible board, so the all-layers export and the
                current-layer export come out at one consistent scale. */}
            <KeyboardLayoutPreview keyboard={keyboard} layer={l} zoomOverride={autoFitZoom} />
          </div>
        ))}
      </div>

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
          <SettingsRow
            icon={<Icon icon="mdi:cube-outline" className="h-5 w-5" />}
            label={t("depthTitle")}
            description={t("depthDesc")}
            control={
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={depth}
                onChange={(e) => setDepth(e.target.checked)}
                aria-label={t("depthTitle")}
              />
            }
          />
          {/* Image export lives here rather than on a hover overlay over the
              board, so the preview is never covered while tuning it. */}
          <SettingsRow
            icon={<Icon icon="mdi:camera-outline" className="h-5 w-5" />}
            label={t("colorScreenshotTitle")}
            description={t("colorScreenshotDesc")}
            control={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
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
            }
          />
        </ul>
      </section>

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
        </ul>
      </section>

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

      {hasLayoutOptions && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
            {t("colorLayoutTitle")}
          </h2>
          <LayoutOptions keyboard={keyboard} onChange={onChange} />
        </section>
      )}
    </div>
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
