import { useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useToast } from "../../contexts/toast.tsx";
import { ColorPicker } from "../common/ColorPicker.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import {
  RGB_EFFECTS_IGNORING_COLOR,
  VIALRGB_EFFECTS,
  rgbEffectName,
} from "../../protocol/vialRgbEffects.ts";

/** HSV (all 0-255, as the protocol carries them) -> `#rrggbb`. */
function hsvToHex(h: number, s: number, v: number): string {
  const hue = (h / 255) * 6;
  const sat = s / 255;
  const val = v / 255;
  const i = Math.floor(hue) % 6;
  const f = hue - Math.floor(hue);
  const p = val * (1 - sat);
  const q = val * (1 - f * sat);
  const t = val * (1 - (1 - f) * sat);
  const [r, g, b] = [
    [val, t, p],
    [q, val, p],
    [p, val, t],
    [p, q, val],
    [t, p, val],
    [val, p, q],
  ][i];
  const hex = (c: number) =>
    Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** `#rrggbb` -> [hue, saturation], both 0-255. Brightness is dropped — it has its own slider. */
function hexToHueSat(hex: string): [number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) {
    return [0, 0];
  }
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 0xff) / 255;
  const g = ((int >> 8) & 0xff) / 255;
  const b = (int & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) {
      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    } else if (max === g) {
      h = ((b - r) / d + 2) / 6;
    } else {
      h = ((r - g) / d + 4) / 6;
    }
  }
  const s = max === 0 ? 0 : d / max;
  return [Math.round(h * 255), Math.round(s * 255)];
}

interface Props {
  keyboard: Keyboard;
}

/**
 * VialRGB (QMK rgb_matrix) lighting page — effect, color, brightness, speed.
 *
 * Scope matches what the protocol actually exposes: a global effect plus one
 * HSV/speed tuple. Vial has no per-key color command, so there's no per-key UI
 * to build here. The two legacy VIA backends (qmk_backlight / qmk_rgblight) are
 * not handled at all; `Keyboard.supportsVialRgb` gates this page.
 *
 * Every control writes through immediately (VIALRGB_SET_MODE, RAM only) so the
 * board previews the change under the user's hand, and Save commits the result
 * to EEPROM — matching vial-gui, where an unsaved change is lost on replug.
 */
export function RgbPanel({ keyboard }: Props) {
  const { t, lang } = useI18n();
  const { showToast } = useToast();
  // Mirrors of the device state, so a dragging slider tracks the pointer at
  // React speed instead of at HID round-trip speed. `keyboard` stays the source
  // of truth; these are re-seeded from it on mount and updated in lockstep.
  const [mode, setMode] = useState(keyboard.rgbMode);
  const [speed, setSpeed] = useState(keyboard.rgbSpeed);
  const [hsv, setHsv] = useState(keyboard.rgbHsv);
  const [saving, setSaving] = useState(false);

  // A slider drag fires far faster than the board can answer, and every write is
  // a full mode/speed/HSV packet. Rather than queue them all (which lags the
  // board seconds behind the pointer), keep at most one write in flight and one
  // pending — the pending slot always holds the newest value, so intermediate
  // frames are simply dropped.
  const writing = useRef(false);
  const queued = useRef<(() => Promise<void>) | null>(null);

  const write = (fn: () => Promise<void>) => {
    if (writing.current) {
      queued.current = fn;
      return;
    }
    writing.current = true;
    void (async () => {
      try {
        await fn();
      } catch (err) {
        showToast(t("rgbWriteFailed", { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        writing.current = false;
        const next = queued.current;
        queued.current = null;
        if (next) {
          write(next);
        }
      }
    })();
  };

  // A board with no VialRGB lighting still gets the whole page, greyed out and
  // inert behind an explanatory banner — showing what the feature *would* look
  // like reads better than an empty page, and makes it obvious the limitation is
  // the keyboard's, not a missing implementation. Nothing here can reach the
  // device in that state: `inert` blocks interaction, so no write is ever issued.
  const supported = keyboard.supportsVialRgb;

  // With no device effect list to filter against, fall back to the full table so
  // the greyed-out dropdown isn't empty.
  const effects = supported
    ? VIALRGB_EFFECTS.filter((e) => keyboard.rgbSupportedEffects.has(e.id))
    : [...VIALRGB_EFFECTS];
  // The device can report an effect id newer than our table; keep it selectable
  // rather than silently snapping the dropdown to something else.
  if (!effects.some((e) => e.id === mode)) {
    effects.push({ id: mode, en: rgbEffectName(mode, "en"), zh: rgbEffectName(mode, "zh") });
    effects.sort((a, b) => a.id - b.id);
  }

  const colorIgnored = RGB_EFFECTS_IGNORING_COLOR.has(mode);
  const off = mode === 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      await keyboard.saveRgb();
      showToast(t("rgbSaved"), "success");
    } catch (err) {
      showToast(t("rgbWriteFailed", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {!supported && (
        <div role="alert" className="alert alert-warning">
          <Icon icon="mdi:alert-outline" className="h-5 w-5 shrink-0" />
          <span>{t("rgbUnsupported")}</span>
        </div>
      )}
      <div
        className={supported ? undefined : "select-none opacity-40"}
        inert={!supported}
        aria-disabled={!supported}
      >
      <ul className="list rounded-box border border-brand-outline/30">
        <SettingsRow
          icon={<Icon icon="mdi:auto-awesome" className="h-5 w-5" />}
          label={t("rgbEffect")}
          description={t("rgbEffectDesc", { n: effects.length })}
          control={
            <select
              className="select select-sm w-56"
              value={mode}
              onChange={(e) => {
                const next = Number(e.target.value);
                setMode(next);
                write(() => keyboard.setRgbMode(next));
              }}
              aria-label={t("rgbEffect")}
            >
              {effects.map((effect) => (
                <option key={effect.id} value={effect.id}>
                  {rgbEffectName(effect.id, lang)}
                </option>
              ))}
            </select>
          }
        />
        <SettingsRow
          icon={<Icon icon="mdi:palette-outline" className="h-5 w-5" />}
          label={t("rgbColor")}
          disabled={colorIgnored}
          help={colorIgnored ? t("rgbColorIgnoredHelp") : undefined}
          control={
            <ColorPicker
              // Shown at full brightness so the swatch stays readable when the
              // board is dimmed — it communicates hue/saturation, not output level.
              value={hsvToHex(hsv[0], hsv[1], 255)}
              onChange={(hex) => {
                const [h, s] = hexToHueSat(hex);
                setHsv([h, s, hsv[2]]);
                write(() => keyboard.setRgbColor(h, s));
              }}
              label={t("rgbColor")}
              disabled={off}
            />
          }
        />
        <SettingsRow
          icon={<Icon icon="mdi:brightness-6" className="h-5 w-5" />}
          label={t("rgbBrightness")}
          disabled={off}
          control={
            <SliderControl
              value={hsv[2]}
              max={keyboard.rgbMaxBrightness}
              disabled={off}
              label={t("rgbBrightness")}
              onChange={(v) => {
                setHsv([hsv[0], hsv[1], v]);
                write(() => keyboard.setRgbBrightness(v));
              }}
            />
          }
        />
        <SettingsRow
          icon={<Icon icon="mdi:speedometer" className="h-5 w-5" />}
          label={t("rgbSpeed")}
          disabled={off}
          control={
            <SliderControl
              value={speed}
              max={255}
              disabled={off}
              label={t("rgbSpeed")}
              onChange={(v) => {
                setSpeed(v);
                write(() => keyboard.setRgbSpeed(v));
              }}
            />
          }
        />
      </ul>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? t("rgbSaving") : t("rgbSave")}
        </button>
        <span className="text-xs text-brand-on-surface-variant">{t("rgbSaveHint")}</span>
      </div>
      </div>
    </div>
  );
}

/** A 0-`max` range slider with its current value pinned beside it. */
function SliderControl({
  value,
  max,
  disabled,
  label,
  onChange,
}: {
  value: number;
  max: number;
  disabled?: boolean;
  label: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="range range-sm w-40"
        min={0}
        max={max}
        value={Math.min(value, max)}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-8 text-right font-mono text-xs tabular-nums opacity-70">{value}</span>
    </div>
  );
}
