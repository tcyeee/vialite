import { useEffect, useState } from "react";
import { useLenis } from "lenis/react";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";

/**
 * Distance below the viewport top at which a section counts as "the one being read".
 * Matches the -80px offset the programmatic jumps land with (see `scrollToSection`
 * below and usePageNavigation's "详细设置" deep link), plus a little slack so the
 * section that was just scrolled to is the one that highlights.
 */
const ACTIVE_LINE = 100;

/** Jump to a QMK settings section, preferring Lenis so the easing matches the rest of the page. */
function scrollToSection(lenis: ReturnType<typeof useLenis>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (lenis) {
    lenis.scrollTo(target, { offset: -80, immediate: reduceMotion });
  } else {
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

/**
 * Table of contents for the Advanced (QMK Settings) page. `sections` comes from
 * QmkSettingsPanel's DOM scan, so it lists exactly the sections that actually rendered —
 * sections whose qsids the connected keyboard doesn't support never show up here. The sticky
 * left rail (and the 全部重置 button pinned to its bottom) lives in QmkSettingsPanel.
 */
export function QmkSettingsToc({ sections }: { sections: MessageKey[] }) {
  const { t } = useI18n();
  const lenis = useLenis();
  const [active, setActive] = useState<MessageKey | null>(null);

  // Scroll spy. Lenis drives the real window scroll position, so a plain passive scroll
  // listener sees both smooth and reduced-motion scrolling without depending on Lenis.
  useEffect(() => {
    if (sections.length === 0) {
      setActive(null);
      return;
    }
    const update = () => {
      let current = sections[0];
      for (const id of sections) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= ACTIVE_LINE) {
          current = id;
        }
      }
      // The last section is usually too short to ever cross the line on its own, so at the
      // very bottom of the page it would otherwise never highlight.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
        current = sections[sections.length - 1];
      }
      setActive(current);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sections]);

  return (
    <nav aria-label={t("qmkTocTitle")}>
      <h2 className="mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-brand-on-surface-variant/70">
        {t("qmkTocTitle")}
      </h2>
      <ul className="menu menu-sm w-full gap-0.5 p-0">
        {sections.map((id) => (
          <li key={id}>
            <button
              type="button"
              className={`justify-start ${active === id ? "menu-active" : ""}`}
              aria-current={active === id ? "true" : undefined}
              onClick={() => scrollToSection(lenis, id)}
            >
              {t(id)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
