import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";

type PageMode = "keymap" | "matrix" | "macro" | "tapdance" | "combo" | "color" | "advanced" | "site" | "io";

const SIDEBAR_WIDTH_KEY = "vialite-sidebar-width";
const SIDEBAR_COLLAPSED_KEY = "vialite-sidebar-collapsed";
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;
// Icon-only width: px-6 padding (24px) on each side of the 52px icon pill, so the glyph's
// horizontal center matches the expanded state (aside px-6 + button px-4) and doesn't jump
// when toggling collapse.
const COLLAPSED_SIDEBAR_WIDTH = 100;

function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, width));
}

function readStoredSidebarWidth(): number {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampSidebarWidth(parsed) : DEFAULT_SIDEBAR_WIDTH;
  } catch {
    return DEFAULT_SIDEBAR_WIDTH;
  }
}

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

interface Props {
  productName?: string;
  onDisconnect: () => void;
  mode: PageMode;
  matrixTesterSupported: boolean;
  macroSupported: boolean;
  tapDanceSupported: boolean;
  comboSupported: boolean;
  /** titleKeys of the QMK Settings sections currently rendered in the page, in DOM order. */
  qmkSections: MessageKey[];
  onNavigate: (mode: PageMode) => void;
}

/**
 * Tracks which of `sectionIds` is currently topmost in the viewport while `active` is true, so
 * the QMK Settings sub-nav can highlight in sync with page scroll. Threshold band mimics a
 * typical scrollspy: a section is "current" once it scrolls past the top ~15% of the viewport.
 */
function useScrollSpy(sectionIds: string[], active: boolean): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!active || sectionIds.length === 0) {
      setActiveId(null);
      return;
    }
    const elements = sectionIds.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) {
      return;
    }
    setActiveId(elements[0].id);
    const observer = new IntersectionObserver(
      (entries) => {
        setActiveId((prev) => {
          const visible = entries.filter((e) => e.isIntersecting);
          if (visible.length === 0) {
            return prev;
          }
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          return visible[0].target.id;
        });
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds, active]);

  return activeId;
}

type NavKind = "home" | "matrixTest" | "macro" | "tapDance" | "combo" | "keyboardColor" | "advanced" | "site" | "importExport";

const NAV_ITEMS: { kind: NavKind; mode: PageMode; labelKey: MessageKey; Icon: (props: SVGProps<SVGSVGElement>) => ReactNode }[] = [
  { kind: "home", mode: "keymap", labelKey: "navHome", Icon: HomeIcon },
  { kind: "macro", mode: "macro", labelKey: "navMacro", Icon: MacroIcon },
  { kind: "tapDance", mode: "tapdance", labelKey: "navTapDance", Icon: TapDanceIcon },
  { kind: "combo", mode: "combo", labelKey: "navCombo", Icon: ComboIcon },
  { kind: "keyboardColor", mode: "color", labelKey: "navKeyboardColor", Icon: KeyboardColorIcon },
  { kind: "importExport", mode: "io", labelKey: "navImportExport", Icon: ImportExportIcon },
  { kind: "matrixTest", mode: "matrix", labelKey: "navMatrixTest", Icon: MatrixIcon },
  { kind: "advanced", mode: "advanced", labelKey: "navAdvanced", Icon: AdvancedIcon },
  { kind: "site", mode: "site", labelKey: "navSiteSettings", Icon: SiteSettingsIcon },
];

export function Sidebar({
  productName,
  onDisconnect,
  mode,
  matrixTesterSupported,
  macroSupported,
  tapDanceSupported,
  comboSupported,
  qmkSections,
  onNavigate,
}: Props) {
  const { t } = useI18n();
  const supportedByKind: Partial<Record<NavKind, boolean>> = {
    matrixTest: matrixTesterSupported,
    macro: macroSupported,
    tapDance: tapDanceSupported,
    combo: comboSupported,
  };
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);
  const showQmkToc = !collapsed && mode === "advanced" && qmkSections.length > 0;
  const activeSection = useScrollSpy(qmkSections, showQmkToc);
  const [sidebarWidth, setSidebarWidth] = useState(readStoredSidebarWidth);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        // Non-persistent is fine.
      }
      return next;
    });
  };

  const startResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    let latestWidth = startWidth;
    const onMouseMove = (ev: MouseEvent) => {
      latestWidth = clampSidebarWidth(startWidth + (ev.clientX - startX));
      setSidebarWidth(latestWidth);
    };
    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      try {
        window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latestWidth));
      } catch {
        // Non-persistent is fine.
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const collapseLabel = collapsed ? t("expandSidebar") : t("collapseSidebar");

  return (
    <div
      className="sidebar-appear relative w-full shrink-0 transition-[width] duration-300 ease-out md:sticky md:top-20 md:-ml-[30px] md:w-[var(--sidebar-w)] md:self-start"
      style={{ "--sidebar-w": `${collapsed ? COLLAPSED_SIDEBAR_WIDTH : sidebarWidth}px` } as CSSProperties}
    >
      <aside className="flex flex-col rounded-[2rem] bg-brand-background px-6 py-6">
        <div className="mb-2 flex justify-start">
          <div className="tooltip tooltip-right" data-tip={collapseLabel}>
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapseLabel}
              aria-pressed={collapsed}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-none bg-transparent text-brand-on-surface-variant transition hover:bg-brand-surface-container-highest/60"
            >
              <CollapseIcon className={"h-5 w-5 transition-transform duration-300 " + (collapsed ? "rotate-180" : "")} />
            </button>
          </div>
        </div>
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ kind, mode: itemMode, labelKey, Icon }, index) => {
            const labelDelay = { "--nav-delay": `${index * 40}ms` } as CSSProperties;
            if (supportedByKind[kind] === false) {
              return (
                <div
                  key={labelKey}
                  className={
                    "flex h-[52px] w-full cursor-default items-center gap-3 whitespace-nowrap px-4 text-brand-on-surface-variant opacity-40 transition-[border-radius] duration-300 ease-out " +
                    (collapsed ? "tooltip tooltip-right rounded-full" : "overflow-hidden rounded-2xl")
                  }
                  data-tip={collapsed ? t("comingSoon") : undefined}
                  title={collapsed ? undefined : t("comingSoon")}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <span className="nav-label-appear" style={labelDelay}>
                      {t(labelKey)}
                    </span>
                  )}
                </div>
              );
            }
            const active = mode === itemMode;
            return (
              <div key={labelKey} className={collapsed ? "tooltip tooltip-right block" : undefined} data-tip={collapsed ? t(labelKey) : undefined}>
                <button
                  type="button"
                  onClick={() => onNavigate(itemMode)}
                  className={
                    "flex h-[52px] w-full items-center gap-3 overflow-hidden whitespace-nowrap border-none px-4 text-left transition-[background-color,color,border-radius] duration-300 ease-out " +
                    (collapsed ? "rounded-full " : "rounded-2xl ") +
                    (active
                      ? "bg-brand-secondary-container font-semibold text-brand-on-secondary-container"
                      : "bg-transparent text-brand-on-surface-variant hover:bg-brand-surface-container-highest/60")
                  }
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <span className="nav-label-appear" style={labelDelay}>
                      {t(labelKey)}
                    </span>
                  )}
                </button>
                {kind === "advanced" && (
                  <div
                    className={
                      "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300 ease-out " +
                      (showQmkToc ? "mt-1 mb-2 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
                    }
                  >
                    <nav className="ml-5 flex min-h-0 min-w-0 flex-col gap-2 pl-4">
                      {qmkSections.map((sectionKey) => {
                        const sectionActive = activeSection === sectionKey;
                        return (
                          <button
                            key={sectionKey}
                            type="button"
                            onClick={() =>
                              document.getElementById(sectionKey)?.scrollIntoView({ behavior: "smooth", block: "start" })
                            }
                            className={
                              sectionActive
                                ? "block w-full truncate rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-sm font-semibold text-brand-primary transition"
                                : "block w-full truncate rounded-lg border-none bg-transparent px-2 py-1.5 text-left text-sm text-brand-on-surface-variant transition hover:text-brand-primary"
                            }
                          >
                            {t(sectionKey)}
                          </button>
                        );
                      })}
                    </nav>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {collapsed ? (
          <div className="tooltip tooltip-right mt-[50px] block" data-tip={`${productName ?? ""} · ${t("disconnect")}`.trim()}>
            <button
              type="button"
              onClick={onDisconnect}
              aria-label={t("disconnect")}
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-none bg-transparent text-brand-on-surface-variant transition hover:bg-red-600 hover:text-white"
            >
              <PowerIcon className="h-5 w-5 shrink-0" />
            </button>
          </div>
        ) : (
          <div className="group mt-[50px] flex h-[52px] items-center gap-2 rounded-2xl px-4">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand-secondary animate-status-breathe" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium uppercase text-green-800">
              {productName ?? t("disconnect")}
            </span>
            <div className="tooltip tooltip-top shrink-0" data-tip={t("disconnect")}>
              <button
                type="button"
                onClick={onDisconnect}
                aria-label={t("disconnect")}
                className="flex h-8 w-8 translate-x-2 items-center justify-center rounded-full border-none bg-red-600 text-white opacity-0 shadow-sm transition-all duration-200 hover:bg-red-700 group-hover:translate-x-0 group-hover:opacity-100 group-focus-within:translate-x-0 group-focus-within:opacity-100"
              >
                <PowerIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("resizeSidebar")}
        onMouseDown={startResize}
        className={
          "absolute inset-y-0 -right-2 z-10 w-4 cursor-col-resize touch-none select-none " +
          (collapsed ? "hidden" : "hidden md:block")
        }
      >
        <div className="mx-auto h-full w-px bg-transparent transition-colors hover:bg-brand-primary/50" />
      </div>
    </div>
  );
}

function CollapseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <path strokeLinecap="round" d="M9.5 4.5v15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 9.5 14 12l2.5 2.5" />
    </svg>
  );
}

function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 11.5 12 4l8 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 10v9h12v-9" />
    </svg>
  );
}

function MatrixIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function MacroIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="M9.5 8.5v7l6-3.5-6-3.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TapDanceIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="7.5" cy="12" r="2.5" />
      <circle cx="17" cy="7" r="1.4" opacity="0.5" />
      <circle cx="17" cy="17" r="1.4" opacity="0.5" />
      <path strokeLinecap="round" d="M9.8 10.7 15 8M9.8 13.3 15 16" />
    </svg>
  );
}

function ComboIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="9.5" cy="12" r="6" />
      <circle cx="14.5" cy="12" r="6" />
    </svg>
  );
}

function KeyboardColorIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.6 1.7-1.6H16a5 5 0 0 0 5-5c0-3.9-4-7.2-9-7.2Z" />
      <circle cx="7.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="10" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="17" cy="11.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function AdvancedIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="3" />
      <path
        strokeLinecap="round"
        d="M19.4 13.5a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V19.5a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H4.5a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H10a1.65 1.65 0 0 0 1-1.51V4.5a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V10a1.65 1.65 0 0 0 1.51 1h.09a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  );
}

function SiteSettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M3.5 12h17M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  );
}

function ImportExportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 8 5 11l3 3M16 8l3 3-3 3" />
      <path strokeLinecap="round" d="M5 11h6M13 11h6" />
    </svg>
  );
}

function PowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" d="M12 3v8" />
      <path strokeLinecap="round" d="M6.5 6.5a8 8 0 1 0 11 0" />
    </svg>
  );
}
