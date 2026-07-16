import type { SVGProps } from "react";
import { useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { usePreviewAppearance } from "../../contexts/previewAppearance.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { LayoutOptions } from "../layout/LayoutOptions.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";
import {
  KeyboardLayoutPreview,
  SPACING_LEVELS,
  type PreviewSize,
} from "../keymap/KeyboardLayoutPreview.tsx";

const CASE_RECENT_KEY = "vialite-color-case-recent";
const PLATE_RECENT_KEY = "vialite-color-plate-recent";
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
    setSize,
    setSpacing,
    setKeycapWidth,
    setCaseRadius,
    setCaseThickness,
    setCaseColor,
    setPlateColor,
  } = usePreviewAppearance();
  const [caseRecent, setCaseRecent] = useState<string[]>(() =>
    readStoredColors(CASE_RECENT_KEY),
  );
  const [plateRecent, setPlateRecent] = useState<string[]>(() =>
    readStoredColors(PLATE_RECENT_KEY),
  );

  const sizeIndex = SIZES.indexOf(size);
  const spacingIndex = SPACING_LEVELS.indexOf(spacing);
  const keycapWidthIndex = SPACING_LEVELS.indexOf(keycapWidth);
  const caseRadiusIndex = SPACING_LEVELS.indexOf(caseRadius);
  // Thickness 0 hides the case entirely, so its color has nothing to paint —
  // grey the row out to signal it's inert.
  const caseHidden = caseThickness === 0;

  const onSizeChange = (index: number) => {
    setSize(SIZES[Math.min(SIZES.length - 1, Math.max(0, index))]);
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

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-brand-on-surface-variant/70">
        {t("colorDisplayNote")}
      </p>
      <div className="overflow-x-auto p-4">
        <KeyboardLayoutPreview
          keyboard={keyboard}
          size={size}
          spacing={spacing}
          keycapWidth={keycapWidth}
          caseRadius={caseRadius}
          caseThickness={caseThickness}
          caseColor={caseColor}
          plateColor={plateColor}
        />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">
          {t("colorAppearanceTitle")}
        </h2>
        <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<KeyboardIcon className="h-5 w-5" />}
            label={t("keyDisplayTitle")}
            description={t("keyDisplayDesc")}
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
            icon={<SizeIcon className="h-5 w-5" />}
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
            icon={<SpacingIcon className="h-5 w-5" />}
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
            icon={<KeycapIcon className="h-5 w-5" />}
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
            icon={<RadiusIcon className="h-5 w-5" />}
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
            icon={<CaseIcon className="h-5 w-5" />}
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
            icon={<CaseIcon className="h-5 w-5" />}
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
            icon={<PlateIcon className="h-5 w-5" />}
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

function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path strokeLinecap="round" d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M8 14h8" />
    </svg>
  );
}

function SizeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"
      />
    </svg>
  );
}

function SpacingIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 6L4 12l4 6M16 6l4 6-4 6M12 4v16"
      />
    </svg>
  );
}

function KeycapIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" opacity="0.5" />
    </svg>
  );
}

function RadiusIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 20v-6a10 10 0 0 1 10-10h6"
      />
    </svg>
  );
}

function CaseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <rect x="6.5" y="9.5" width="11" height="5" rx="1" opacity="0.5" />
    </svg>
  );
}

function PlateIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      {...props}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5"
      />
    </svg>
  );
}
