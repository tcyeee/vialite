import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { CornerCloseButton } from "../common/CornerCloseButton.tsx";
import { SiteSettingsPanel } from "./site/SiteSettingsPanel.tsx";
import { ThanksMarquee } from "./site/ThanksMarquee.tsx";

interface Props {
  onExit: () => void;
}

/**
 * 网站配置页 — 从 NewHomePage 顶部导航栏的"网站配置"进入,独立页面,没有左侧边栏,
 * 只有右上角一个退出按钮返回 NewHomePage。banner(logo/简介/链接)、感谢名单
 * 和设置项(SiteSettingsPanel)都在这一层直接组合,而不是嵌套引入。
 */
export function SiteConfigPage({ onExit }: Props) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[#E9E6E6] text-black dark:bg-black dark:text-white">
      <div className="mx-auto max-w-2xl px-6 py-16 md:px-10">
        <div className="flex flex-col gap-6">
          {/* Banner: logo card, the thanks caption, and the participant marquee
              read as one block, set apart from the settings lists by the extra
              bottom margin (on top of the container's gap). */}
          <div className="mb-20 flex flex-col gap-5">
            <section className="flex w-full max-w-lg flex-col items-center justify-center gap-6 self-center rounded-box bg-brand-surface-variant/30 p-6 text-center">
              <img src="/logo-full.svg" alt="Vialite" className="h-15 w-auto" />
              <p className="text-sm leading-relaxed text-brand-on-surface-variant">
                {t("siteAboutIntro")}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href="https://github.com/tcyeee/vialite"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-circle"
                  aria-label={t("siteAboutGithub")}
                >
                  <Icon icon="mdi:github" className="h-9 w-9" />
                </a>
                <a
                  href="https://discord.gg/J8GkuQG3aF"
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-ghost btn-circle"
                  aria-label={t("siteAboutDiscord")}
                >
                  <Icon icon="mdi:discord" className="h-8 w-8" />
                </a>
              </div>
            </section>
            <ThanksMarquee />
          </div>

          <SiteSettingsPanel />
        </div>
      </div>
      <CornerCloseButton onClick={onExit} label={t("navExitSiteConfig")} active />
    </div>
  );
}
