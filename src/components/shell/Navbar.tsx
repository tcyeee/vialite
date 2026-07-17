import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";

interface NavbarProps {
  /** When provided, shows a hamburger button (narrow screens only) that opens the sidebar drawer. */
  onMenuClick?: () => void;
}

export function Navbar({ onMenuClick }: NavbarProps = {}) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();

  return (
    <div className="navbar sticky top-0 z-40 min-h-16 bg-black text-white px-6 md:px-10 lg:px-12">
      <div className="navbar-start gap-2">
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={t("openMenu")}
            className="btn btn-sm btn-square btn-ghost text-white hover:bg-white/15 md:hidden"
          >
            <Icon icon="mdi:menu" className="h-5 w-5" />
          </button>
        )}
        <img className="h-8 w-auto md:h-9" src="/logo-full.svg" alt="Vialite" />
      </div>
      <div className="navbar-end gap-2">
        <button
          type="button"
          className="btn btn-sm btn-outline rounded-full border-white/40 text-white hover:border-white hover:bg-white hover:text-black"
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          title={t("toggleLanguage")}
        >
          <Icon icon="mdi:translate" className="h-4 w-4" />
          {lang === "zh" ? "中文" : "English"}
        </button>
        <label
          className="btn btn-sm btn-circle btn-outline swap swap-rotate border-white/40 text-white hover:border-white hover:bg-white hover:text-black"
          title={t("toggleTheme")}
        >
          <input
            type="checkbox"
            className="theme-controller"
            checked={theme === "dark"}
            onChange={(e) => setTheme(e.target.checked ? "dark" : "light")}
            aria-label={t("toggleTheme")}
          />
          <Icon icon="mdi:white-balance-sunny" className="swap-off h-4 w-4" />
          <Icon icon="mdi:weather-night" className="swap-on h-4 w-4" />
        </label>
      </div>
    </div>
  );
}
