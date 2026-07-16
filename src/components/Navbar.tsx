import type { SVGProps } from "react";
import { useI18n } from "../i18n.tsx";
import { useTheme } from "../theme.tsx";

export function Navbar() {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className="navbar sticky top-0 z-40 min-h-16 bg-brand-background px-4 md:px-6">
      <div className="navbar-start">
        <img className="h-8 w-auto md:h-9" src="/logo-full.svg" alt="Vialite" />
      </div>
      <div className="navbar-end gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline rounded-full"
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          title={t("toggleLanguage")}
        >
          <GlobeIcon className="h-4 w-4" />
          {lang === "zh" ? "中文" : "English"}
        </button>
        <label
          className="btn btn-sm btn-circle btn-outline swap swap-rotate text-brand-on-surface"
          title={t("toggleTheme")}
        >
          <input
            type="checkbox"
            className="theme-controller"
            checked={theme === "dark"}
            onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
            aria-label={t("toggleTheme")}
          />
          <SunIcon className="swap-off h-4 w-4" />
          <MoonIcon className="swap-on h-4 w-4" />
        </label>
      </div>
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
