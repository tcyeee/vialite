import type { SVGProps } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { SettingsRow } from "../qmk/QmkSettingsPanel.tsx";

/**
 * The 网站设置 (Website Settings) page: preferences scoped to this configurator
 * itself, not the connected keyboard. Two grouped `list`s — General (language +
 * theme) and Keyboard (key display style, reserved for future use). All choices
 * persist to localStorage via their respective contexts.
 */
export function SiteSettingsPanel() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { keyDisplay, setKeyDisplay } = useKeyDisplay();

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
        <h2 className="mb-2 text-sm font-semibold text-brand-on-surface-variant">{t("siteKeyboardTitle")}</h2>
        <ul className="list rounded-box border border-brand-outline/30">
          <SettingsRow
            icon={<KeyboardIcon className="h-4.5 w-4.5" />}
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

function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path strokeLinecap="round" d="M6 9.5h.01M9.5 9.5h.01M13 9.5h.01M16.5 9.5h.01M8 14h8" />
    </svg>
  );
}
