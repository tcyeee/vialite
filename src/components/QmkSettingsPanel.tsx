import { useRef, type ReactNode, type SVGProps } from "react";
import { useI18n, type MessageKey } from "../i18n.tsx";
import type { Keyboard } from "../protocol/keyboard.ts";
import { ComboSettings } from "./ComboSettings.tsx";
import { GraveEscapeSettings } from "./GraveEscapeSettings.tsx";
import { LayoutOptions } from "./LayoutOptions.tsx";
import { MagicSettings } from "./MagicSettings.tsx";
import { MouseKeySettings } from "./MouseKeySettings.tsx";
import { OneShotSettings } from "./OneShotSettings.tsx";
import { TapHoldSettings } from "./TapHoldSettings.tsx";

interface Props {
  keyboard: Keyboard;
  importing: boolean;
  onExport: () => void;
  onImportFile: (file: File) => void;
  /** Called after any layout-option or QMK-setting write (including a reset), so the parent re-renders. */
  onChange: () => void;
}

/** One row of a daisyUI `list`: icon + label(/description) on the left, a control on the right. */
export function SettingsRow({
  icon,
  label,
  description,
  control,
}: {
  icon: ReactNode;
  label: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <li className="list-row items-center">
      <div className="btn btn-circle btn-ghost pointer-events-none text-brand-on-surface">{icon}</div>
      <div className="min-w-0">
        <div className="text-sm font-medium text-brand-on-surface">{label}</div>
        {description && <div className="truncate text-xs opacity-60">{description}</div>}
      </div>
      {control}
    </li>
  );
}

/**
 * One field within some QMK Settings qsid (see `Keyboard.getQmkSettingBit`/
 * `getQmkSettingValue`). Each field names its own qsid — unlike Magic/Grave
 * Escape, a single tab like Tap-Hold spans several unrelated qsids, one per
 * field or small group of fields.
 */
export type QmkSettingField =
  | { type: "boolean"; qsid: number; bit: number; labelKey: MessageKey }
  | { type: "integer"; qsid: number; min: number; max: number; labelKey: MessageKey };

/**
 * A titled `list` of QMK Settings fields; renders (and only renders) when at
 * least one field's qsid is supported by the connected device — mirrors
 * vial-gui's "don't bother creating tabs that would be empty" rule. Fields
 * whose qsid isn't supported are skipped individually.
 */
export function QmkSettingsSection({
  keyboard,
  titleKey,
  fields,
  icon,
  onChange,
}: {
  keyboard: Keyboard;
  titleKey: MessageKey;
  fields: QmkSettingField[];
  icon: ReactNode;
  onChange: () => void;
}) {
  const { t } = useI18n();
  const supported = fields.filter((f) => keyboard.supportsQmkSetting(f.qsid));
  if (supported.length === 0) {
    return null;
  }

  const updateBit = async (qsid: number, bit: number, value: boolean) => {
    try {
      await keyboard.setQmkSettingBit(qsid, bit, value);
    } finally {
      onChange();
    }
  };
  const updateValue = async (qsid: number, value: number) => {
    try {
      await keyboard.setQmkSettingValue(qsid, value);
    } finally {
      onChange();
    }
  };

  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t(titleKey)}</h2>
      <ul className="list rounded-box border border-brand-outline/30">
        {supported.map((field, i) => (
          <SettingsRow
            key={i}
            icon={icon}
            label={t(field.labelKey)}
            control={
              field.type === "boolean" ? (
                <input
                  type="checkbox"
                  className="toggle"
                  checked={keyboard.getQmkSettingBit(field.qsid, field.bit)}
                  onChange={(e) => void updateBit(field.qsid, field.bit, e.target.checked)}
                  aria-label={t(field.labelKey)}
                />
              ) : (
                <input
                  type="number"
                  className="input input-sm w-24"
                  min={field.min}
                  max={field.max}
                  value={keyboard.getQmkSettingValue(field.qsid) ?? field.min}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (!Number.isNaN(v)) {
                      void updateValue(field.qsid, Math.min(field.max, Math.max(field.min, v)));
                    }
                  }}
                  aria-label={t(field.labelKey)}
                />
              )
            }
          />
        ))}
      </ul>
    </section>
  );
}

export function QmkSettingsPanel({ keyboard, importing, onExport, onImportFile, onChange }: Props) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLayoutOptions = !!keyboard.layoutLabels && keyboard.layoutLabels.length > 0 && keyboard.layoutOptions >= 0;

  const resetAll = async () => {
    if (!window.confirm(t("resetAllSettingsConfirm"))) {
      return;
    }
    try {
      await keyboard.resetLayoutOptions();
      await keyboard.resetQmkSettings();
    } finally {
      onChange();
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t("generalSettingsTitle")}</h2>
        <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<DownloadIcon className="h-4.5 w-4.5" />}
            label={t("exportLayout")}
            description={t("exportLayoutDesc")}
            control={
              <button
                type="button"
                className="btn btn-circle btn-ghost"
                onClick={onExport}
                disabled={importing}
                aria-label={t("exportLayout")}
              >
                <DownloadIcon className="h-4.5 w-4.5" />
              </button>
            }
          />
          <SettingsRow
            icon={<UploadIcon className="h-4.5 w-4.5" />}
            label={t("importLayout")}
            description={t("importLayoutDesc")}
            control={
              <button
                type="button"
                className="btn btn-circle btn-ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                aria-label={t("importLayout")}
                title={importing ? t("importing") : t("importLayout")}
              >
                <UploadIcon className="h-4.5 w-4.5" />
              </button>
            }
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".vil,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) {
                onImportFile(file);
              }
            }}
          />
        </ul>
      </section>
      {hasLayoutOptions && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t("layoutOptionsTitle")}</h2>
          <LayoutOptions keyboard={keyboard} onChange={onChange} />
        </section>
      )}
      <MagicSettings keyboard={keyboard} onChange={onChange} />
      <GraveEscapeSettings keyboard={keyboard} onChange={onChange} />
      <TapHoldSettings keyboard={keyboard} onChange={onChange} />
      <ComboSettings keyboard={keyboard} onChange={onChange} />
      <OneShotSettings keyboard={keyboard} onChange={onChange} />
      <MouseKeySettings keyboard={keyboard} onChange={onChange} />
      <div className="flex justify-end">
        <button type="button" className="btn btn-outline btn-sm gap-1.5" onClick={() => void resetAll()}>
          <ResetIcon className="h-4 w-4" />
          {t("resetAllSettings")}
        </button>
      </div>
    </div>
  );
}

function DownloadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.5v11.5M7.5 11l4.5 4.5L16.5 11" />
      <path strokeLinecap="round" d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

function UploadIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.5V4M7.5 8.5 12 4l4.5 4.5" />
      <path strokeLinecap="round" d="M4.5 17.5v2a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1v-2" />
    </svg>
  );
}

function ResetIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1 1 2.4 5.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 17.5v-4.5h4.5" />
    </svg>
  );
}
