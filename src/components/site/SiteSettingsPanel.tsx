import { useState, type SVGProps } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";

/**
 * Wipe every localStorage entry this app owns (all `vialite-` keys: keyboard
 * style/appearance, theme, language, sidebar geometry, ...) then reload so all
 * contexts re-initialise from their defaults. Most visibly this discards the
 * user's saved keyboard style info (colors, keycap look, layout preferences).
 */
function clearSiteCache() {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key?.startsWith("vialite-")) {
      keys.push(key);
    }
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
  window.location.reload();
}

/**
 * The 网站设置 (Website Settings) page: preferences scoped to this configurator
 * itself, not the connected keyboard. A single grouped `list` — General
 * (language + theme). All choices persist to localStorage via their respective
 * contexts.
 */
export function SiteSettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

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

      <section>
        <h2 className="mb-2 text-sm font-semibold text-error">{t("siteDangerTitle")}</h2>
        <ul className="list rounded-box border border-error/40">
          <SettingsRow
            icon={<WarningIcon className="h-4.5 w-4.5 text-error" />}
            label={t("clearCacheTitle")}
            description={t("clearCacheDesc")}
            control={
              <button
                type="button"
                className="btn btn-error btn-outline btn-sm"
                onClick={() => setClearConfirmOpen(true)}
              >
                {t("clearCacheButton")}
              </button>
            }
          />
        </ul>
      </section>

      {clearConfirmOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold text-error">{t("clearCacheConfirmTitle")}</h3>
            <p className="py-2 text-sm text-brand-on-surface-variant">{t("clearCacheConfirmHint")}</p>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setClearConfirmOpen(false)}>
                {t("cancel")}
              </button>
              <button type="button" className="btn btn-error" onClick={clearSiteCache}>
                {t("clearCacheConfirm")}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label={t("cancel")}
            onClick={() => setClearConfirmOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function WarningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4 2.5 20h19L12 4Z" />
      <path strokeLinecap="round" d="M12 10v4" />
      <circle cx="12" cy="17.5" r=".6" fill="currentColor" stroke="none" />
    </svg>
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
