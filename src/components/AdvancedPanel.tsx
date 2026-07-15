import { useRef, type ReactNode, type SVGProps } from "react";
import { useI18n } from "../i18n.tsx";
import type { Keyboard } from "../protocol/keyboard.ts";
import { useTheme } from "../theme.tsx";
import { LayoutOptions } from "./LayoutOptions.tsx";

interface Props {
  keyboard: Keyboard;
  importing: boolean;
  ioMessage: string | null;
  onExport: () => void;
  onImportFile: (file: File) => void;
  onLayoutOptionsChange: () => void;
}

/** One row of the settings list: icon + label(/description) on the left, a control on the right. */
function SettingsRow({
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
    <div className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-surface-container-highest/60 text-brand-on-surface">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-brand-on-surface">{label}</div>
        {description && <div className="truncate text-xs text-brand-on-surface-variant">{description}</div>}
      </div>
      {control}
    </div>
  );
}

export function AdvancedPanel({ keyboard, importing, ioMessage, onExport, onImportFile, onLayoutOptionsChange }: Props) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasLayoutOptions = !!keyboard.layoutLabels && keyboard.layoutLabels.length > 0 && keyboard.layoutOptions >= 0;

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t("generalSettingsTitle")}</h2>
        <div className="divide-y divide-brand-outline/20 overflow-hidden rounded-2xl border border-brand-outline/30">
          <SettingsRow
            icon={<GlobeIcon className="h-4.5 w-4.5" />}
            label={t("languageTitle")}
            control={
              <button
                type="button"
                className="rounded-full border border-brand-outline/40 px-3 py-1.5 text-sm text-brand-on-surface transition hover:bg-brand-surface-container-highest/60"
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                title={t("toggleLanguage")}
              >
                {lang === "zh" ? "中文" : "English"}
              </button>
            }
          />
          <SettingsRow
            icon={theme === "dark" ? <MoonIcon className="h-4.5 w-4.5" /> : <SunIcon className="h-4.5 w-4.5" />}
            label={t("themeTitle")}
            control={
              <button
                type="button"
                className="rounded-full border border-brand-outline/40 px-3 py-1.5 text-sm text-brand-on-surface transition hover:bg-brand-surface-container-highest/60"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                title={t("toggleTheme")}
              >
                {theme === "dark" ? t("themeDark") : t("themeLight")}
              </button>
            }
          />
          <SettingsRow
            icon={<DownloadIcon className="h-4.5 w-4.5" />}
            label={t("exportLayout")}
            description={t("exportLayoutDesc")}
            control={
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-outline/40 text-brand-on-surface transition hover:bg-brand-surface-container-highest/60 disabled:opacity-50"
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
            description={ioMessage ?? t("importLayoutDesc")}
            control={
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-brand-outline/40 text-brand-on-surface transition hover:bg-brand-surface-container-highest/60 disabled:opacity-50"
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
        </div>
      </section>
      {hasLayoutOptions && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t("layoutOptionsTitle")}</h2>
          <LayoutOptions keyboard={keyboard} onChange={onLayoutOptionsChange} />
        </section>
      )}
    </div>
  );
}

function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path strokeLinecap="round" d="M3.5 9h17M3.5 15h17" />
    </svg>
  );
}

function SunIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <circle cx="12" cy="12" r="4.5" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2.25M12 19.25v2.25M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.5 12h2.25M19.25 12h2.25M4.4 19.6 6 18M18 6l1.6-1.6"
      />
    </svg>
  );
}

function MoonIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"
      />
    </svg>
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
