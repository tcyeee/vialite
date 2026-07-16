import type { SVGProps } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";

/**
 * The 网站设置 (Website Settings) page: preferences scoped to this configurator
 * itself, not the connected keyboard. A single grouped `list` — General
 * (language + theme). All choices persist to localStorage via their respective
 * contexts.
 */
export function SiteSettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t("siteGeneralTitle")}</h2>
        <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<GlobeIcon className="h-4.5 w-4.5" />}
            label={t("languageTitle")}
            description={t("languageDesc")}
            control={
              <select
                className="select select-sm w-32"
                value={lang}
                onChange={(e) => setLang(e.target.value as "en" | "zh")}
                aria-label={t("languageTitle")}
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            }
          />
          <SettingsRow
            icon={<AppearanceIcon className="h-4.5 w-4.5" />}
            label={t("themeTitle")}
            description={t("themeDesc")}
            control={
              <select
                className="select select-sm w-32"
                value={theme}
                onChange={(e) => setTheme(e.target.value as "light" | "dark")}
                aria-label={t("themeTitle")}
              >
                <option value="light">{t("themeLight")}</option>
                <option value="dark">{t("themeDark")}</option>
              </select>
            }
          />
        </ul>
      </section>
    </div>
  );
}

function GlobeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="4" ry="9" />
      <path strokeLinecap="round" d="M3.5 9h17M3.5 15h17" />
    </svg>
  );
}

function AppearanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
