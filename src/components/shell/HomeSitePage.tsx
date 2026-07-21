import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";

interface Props {
  onBack: () => void;
}

/**
 * 新版首页「网站信息」的占位页面——刻意独立于 `components/site/SiteSettingsPanel.tsx`
 * (旧版布局下 `mode === "site"` 渲染的那个页面)。新版首页的菜单项正在逐个变成这样的
 * 真实页面,渲染在 NewHomePage 自己的无 Navbar/Sidebar 画布里,而不是跳转回旧布局。
 */
export function HomeSitePage({ onBack }: Props) {
  const { t } = useI18n();

  return (
    <div className="page-transition flex h-screen flex-col items-center justify-center gap-6 bg-black px-6 text-center text-brand-on-surface">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-6 top-6 flex items-center gap-2 rounded-full border-none bg-transparent px-4 py-2 text-brand-on-surface-variant transition hover:bg-white/10"
      >
        <Icon icon="mdi:arrow-left" className="h-5 w-5" />
        {t("homeBack")}
      </button>
      <h1 className="text-3xl font-bold">{t("navSiteSettings")}</h1>
      <p className="max-w-md text-sm text-brand-on-surface-variant">{t("homeSitePagePlaceholder")}</p>
    </div>
  );
}
