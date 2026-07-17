import { useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { composeLayers, downloadCanvas, frameBoard, nodeToCanvas } from "./layoutImage.ts";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { LayoutOptions } from "../layout/LayoutOptions.tsx";
import { LayerTabs } from "../keymap/LayerTabs.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";
import {
  KeyboardLayoutPreview,
  SPACING_LEVELS,
  type FontPosition,
  type PreviewSize,
} from "../keymap/KeyboardLayoutPreview.tsx";

const CASE_RECENT_KEY = "vialite-color-case-recent";
const PLATE_RECENT_KEY = "vialite-color-plate-recent";
const FONT_RECENT_KEY = "vialite-color-font-recent";
const MAX_RECENT_COLORS = 3;
const SIZES: PreviewSize[] = ["s", "m", "l", "xl"];
const LEVEL_LABELS = { s: "S", m: "M", l: "L", xl: "XL" } as const;

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
  const { keyDisplay, setKeyDisplay } = useKeyDisplay();
  const hasLayoutOptions =
    !!keyboard.layoutLabels &&
    keyboard.layoutLabels.length > 0 &&
    keyboard.layoutOptions >= 0;
  // Appearance settings are shared with the main keymap board via context, so
  // tuning them here also restyles the interactive layout on the 键位 page.
  const {
    size,
    spacing,
    keycapWidth,
    caseRadius,
    caseThickness,
    caseColor,
    plateColor,
    keycapBorder,
    depth,
    fontSize,
    fontColor,
    fontPosition,
    setSize,
    setSpacing,
    setKeycapWidth,
    setCaseRadius,
    setCaseThickness,
    setCaseColor,
    setPlateColor,
    setKeycapBorder,
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
  const fontSizeIndex = SIZES.indexOf(fontSize);
  const spacingIndex = SPACING_LEVELS.indexOf(spacing);
  const keycapWidthIndex = SPACING_LEVELS.indexOf(keycapWidth);
  const caseRadiusIndex = SPACING_LEVELS.indexOf(caseRadius);
  // Thickness 0 hides the case entirely, so its color has nothing to paint —
  // grey the row out to signal it's inert.
  const caseHidden = caseThickness === 0;

  const onSizeChange = (index: number) => {
    setSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, index))]);
  };

  const onFontSizeChange = (index: number) => {
    setFontSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, index))]);
  };

  const onSpacingChange = (index: number) => {
    setSpacing(SPACING_LEVELS[Math.min(SPACING_LEVELS.length - 1, Math.max(0, index))]);
  };

  const onKeycapWidthChange = (index: number) => {
    setKeycapWidth(SPACING_LEVELS[Math.min(SPACING_LEVELS.length - 1, Math.max(0, index))]);
  };

  const onCaseRadiusChange = (index: number) => {
    setCaseRadius(SPACING_LEVELS[Math.min(SPACING_LEVELS.length - 1, Math.max(0, index))]);
  };

  const onCaseThicknessChange = (value: number) => {
    setCaseThickness(value);
  };

  const onCaseColorChange = (value: string) => {
    setCaseColor(value);
  };

  const onPlateColorChange = (value: string) => {
    setPlateColor(value);
  };

  const onFontColorChange = (value: string) => {
    setFontColor(value);
  };

  // Commit the picked color to the per-field recent list (most recent first,
  // deduped, capped at three). Called on the color input's blur — i.e. once the
  // user finishes picking — so dragging through the swatch doesn't spam history.
  const rememberCaseColor = (value: string) => {
    setCaseRecent((prev) => {
      const next = [
        value,
        ...prev.filter((c) => c.toLowerCase() !== value.toLowerCase()),
      ].slice(0, MAX_RECENT_COLORS);
      store(CASE_RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const rememberPlateColor = (value: string) => {
    setPlateRecent((prev) => {
      const next = [
        value,
        ...prev.filter((c) => c.toLowerCase() !== value.toLowerCase()),
      ].slice(0, MAX_RECENT_COLORS);
      store(PLATE_RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  const rememberFontColor = (value: string) => {
    setFontRecent((prev) => {
      const next = [
        value,
        ...prev.filter((c) => c.toLowerCase() !== value.toLowerCase()),
      ].slice(0, MAX_RECENT_COLORS);
      store(FONT_RECENT_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4 pb-[30px]">
      <p className="text-xs text-brand-on-surface-variant/70">
        {t("colorDisplayNote")}
      </p>
      {/* 预览吸顶:调外观设置时键盘要始终可见。top-16 贴在 Navbar(sticky
          top-0,min-h-16)下沿;z-20 低于 Navbar 的 z-40。半透明 + backdrop-blur
          让下方滚动的设置项透出而不糊成一块,同时不必硬编码页面底色(浅色为
          bg-white,深色是 black/30 叠在 body 的 --color-brand-background 上)。
          负外边距把背景铺满 main 的左右内边距,滚动时内容不会从两侧漏出。 */}
      <div className="sticky top-16 z-20 -mx-6 bg-white/80 px-6 pt-3 backdrop-blur-md dark:bg-black/50 md:-mx-8 md:px-8">
        {/* Layer tabs wrap the preview like the 键盘布局 page, so the labels can
            be viewed per layer. Negative margins offset the tab-content padding so
            the board's shaded case shadow isn't clipped by overflow-x-auto. */}
        <LayerTabs
          layers={keyboard.layers}
          active={previewLayer}
          onSelect={setPreviewLayer}
          isConfigured={(l) => keyboard.isLayerConfigured(l)}
        >
          {/* Group box spans the tab panel's content area; the overlay below then
              bleeds out over the panel's p-6 padding so the dim covers the whole
              tab region rather than just the board. */}
          <div className="group relative">
            <div className="-mx-4 -mb-6 -mt-2 overflow-x-auto px-4 pb-6 pt-2">
              {/* Reads every appearance value from the shared context, so it stays in
                  sync with the controls below and identical to previews elsewhere.
                  The ref wrapper is the exact node rasterized for the current-layer
                  image (fit-content, so it hugs the board with no extra margin). */}
              <div ref={currentBoardRef} style={{ width: "fit-content" }}>
                <KeyboardLayoutPreview keyboard={keyboard} layer={previewLayer} />
              </div>
            </div>
            {/* Save actions live here rather than in a row below the board, and
                deliberately sit outside currentBoardRef — nodeToCanvas rasterizes
                that node, so anything inside it would be baked into the export.
                The scrim spans LayerTabs' content box (p-6), but the board wrapper's
                padding-compensating negative margins collapse onto this group: its top
                sits 0.5rem above the content box's padding edge (-mt-2) and its bottom
                already coincides with that box's border (-mb-6 cancels the pb-6), so the
                vertical insets are -top-4/bottom-0 rather than a symmetric -inset-6. */}
            <div className="pointer-events-none absolute -inset-x-6 -top-4 bottom-0 z-10 flex items-center justify-center gap-4 rounded-box rounded-tl-none bg-black/50 opacity-0 transition-opacity duration-200 group-hover:pointer-events-auto group-hover:opacity-100">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void saveCurrentLayer()}
                disabled={saving}
              >
                <Icon icon="mdi:content-save-outline" className="h-5 w-5" />
                {saving ? t("colorSaving") : t("colorSaveCurrentLayer")}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void saveAllLayers()}
                disabled={saving || configuredLayers.length === 0}
              >
                <Icon icon="mdi:content-save-outline" className="h-5 w-5" />
                {saving ? t("colorSaving") : t("colorSaveAllLayers")}
              </button>
            </div>
          </div>
        </LayerTabs>
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
            <KeyboardLayoutPreview keyboard={keyboard} layer={l} />
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
          {t("colorSizeSectionTitle")}
        </h2>
        <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<Icon icon="mdi:arrow-expand-all" className="h-5 w-5" />}
            label={t("displaySizeTitle")}
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
                  {t("keyDisplayMacos")}
                </button>
                <button
                  type="button"
                  className={"btn btn-sm join-item" + (keyDisplay === "windows" ? " btn-primary" : " btn-outline")}
                  onClick={() => setKeyDisplay("windows")}
                >
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
                  max={SIZES.length - 1}
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
                  onPick={onFontColorChange}
                  label={t("fontColorTitle")}
                />
                <input
                  type="color"
                  value={fontColor}
                  onChange={(e) => onFontColorChange(e.target.value)}
                  onBlur={(e) => rememberFontColor(e.target.value)}
                  className="mr-2 h-8 w-14 cursor-pointer rounded border border-brand-outline/40 bg-transparent"
                  aria-label={t("fontColorTitle")}
                />
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
          <SettingsRow
            icon={<Icon icon="mdi:square-rounded-outline" className="h-5 w-5" />}
            label={t("keycapWidthTitle")}
            control={
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={SPACING_LEVELS.length - 1}
                  step={1}
                  value={keycapWidthIndex}
                  onChange={(e) => onKeycapWidthChange(Number(e.target.value))}
                  className="range range-primary range-xs w-40"
                  aria-label={t("keycapWidthTitle")}
                />
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-brand-on-surface-variant">
                  {LEVEL_LABELS[keycapWidth]}
                </span>
              </div>
            }
          />
          <SettingsRow
            icon={<Icon icon="mdi:square-rounded-outline" className="h-5 w-5" />}
            label={t("keycapBorderTitle")}
            control={
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={keycapBorder}
                onChange={(e) => setKeycapBorder(e.target.checked)}
                aria-label={t("keycapBorderTitle")}
              />
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
                  onPick={onCaseColorChange}
                  label={t("caseColorTitle")}
                />
                <input
                  type="color"
                  value={caseColor}
                  onChange={(e) => onCaseColorChange(e.target.value)}
                  onBlur={(e) => rememberCaseColor(e.target.value)}
                  disabled={caseHidden}
                  className="mr-2 h-8 w-14 cursor-pointer rounded border border-brand-outline/40 bg-transparent"
                  aria-label={t("caseColorTitle")}
                />
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
                  onPick={onPlateColorChange}
                  label={t("plateColorTitle")}
                />
                <input
                  type="color"
                  value={plateColor}
                  onChange={(e) => onPlateColorChange(e.target.value)}
                  onBlur={(e) => rememberPlateColor(e.target.value)}
                  className="mr-2 h-8 w-14 cursor-pointer rounded border border-brand-outline/40 bg-transparent"
                  aria-label={t("plateColorTitle")}
                />
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
