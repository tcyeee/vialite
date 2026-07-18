import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Icon } from "@iconify/react";
import { useLenis } from "lenis/react";
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
  /**
   * Gates the slide-in entrance animation. Held false while the connect-success page transition is
   * still running (the sidebar would otherwise animate off-screen, behind the rising config page),
   * then flipped true once the page has settled so the entrance actually plays in view.
   */
  appear: boolean;
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

const NAV_ITEMS: { kind: NavKind; mode: PageMode; labelKey: MessageKey; icon: string }[] = [
  { kind: "home", mode: "keymap", labelKey: "navHome", icon: "mdi:home-outline" },
  { kind: "macro", mode: "macro", labelKey: "navMacro", icon: "mdi:script-text-outline" },
  { kind: "tapDance", mode: "tapdance", labelKey: "navTapDance", icon: "mdi:animation" },
  { kind: "combo", mode: "combo", labelKey: "navCombo", icon: "mdi:vector-combine" },
  { kind: "keyboardColor", mode: "color", labelKey: "navKeyboardColor", icon: "mdi:palette-outline" },
  { kind: "importExport", mode: "io", labelKey: "navImportExport", icon: "mdi:swap-horizontal" },
  { kind: "matrixTest", mode: "matrix", labelKey: "navMatrixTest", icon: "mdi:view-grid-outline" },
  { kind: "advanced", mode: "advanced", labelKey: "navAdvanced", icon: "mdi:tune-variant" },
  { kind: "site", mode: "site", labelKey: "navSiteSettings", icon: "mdi:web" },
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
  appear,
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
      className={
        // While the connect-success transition is running, keep the sidebar invisible (space still
        // reserved) rather than at rest — otherwise it shows once during the page rise and then
        // "appears again" when the entrance animation fires. opacity-0 → sidebar-appear (which
        // keyframes from opacity 0) hands off with no flash, so the entrance plays exactly once.
        (appear ? "sidebar-appear " : "opacity-0 ") +
        "relative hidden w-full shrink-0 transition-[width] duration-300 ease-out md:block md:sticky md:top-20 md:-ml-[30px] md:w-[var(--sidebar-w)] md:self-start"
      }
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
              <Icon icon="mdi:menu-open" className={"h-5 w-5 transition-transform duration-300 " + (collapsed ? "rotate-180" : "")} />
            </button>
          </div>
        </div>
        <SidebarNav
          mode={mode}
          supportedByKind={supportedByKind}
          onNavigate={onNavigate}
          collapsed={collapsed}
          appear={appear}
          showQmkToc={showQmkToc}
          activeSection={activeSection}
          qmkSections={qmkSections}
        />
        <SidebarFooter collapsed={collapsed} productName={productName} onDisconnect={onDisconnect} />
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

interface SidebarNavProps {
  mode: PageMode;
  supportedByKind: Partial<Record<NavKind, boolean>>;
  onNavigate: (mode: PageMode) => void;
  collapsed: boolean;
  appear: boolean;
  showQmkToc: boolean;
  activeSection: string | null;
  qmkSections: MessageKey[];
  /** Fired after any nav or QMK-section click; the drawer uses it to close itself on navigation. */
  onAfterClick?: () => void;
}

/** The list of nav buttons (plus the Advanced QMK sub-TOC), shared by the desktop aside and the drawer. */
function SidebarNav({
  mode,
  supportedByKind,
  onNavigate,
  collapsed,
  appear,
  showQmkToc,
  activeSection,
  qmkSections,
  onAfterClick,
}: SidebarNavProps) {
  const { t } = useI18n();
  const lenis = useLenis();
  return (
    <nav className="flex flex-col gap-2">
      {NAV_ITEMS.map(({ kind, mode: itemMode, labelKey, icon }, index) => {
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
              <Icon icon={icon} className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className={appear ? "nav-label-appear" : undefined} style={labelDelay}>
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
              onClick={() => {
                onNavigate(itemMode);
                onAfterClick?.();
              }}
              className={
                "flex h-[52px] w-full items-center gap-3 overflow-hidden whitespace-nowrap border-none px-4 text-left transition-[background-color,color,border-radius] duration-300 ease-out " +
                (collapsed ? "rounded-full " : "rounded-2xl ") +
                (active
                  ? "bg-brand-secondary-container font-semibold text-brand-on-secondary-container"
                  : "bg-transparent text-brand-on-surface-variant hover:bg-brand-surface-container-highest/60")
              }
            >
              <Icon icon={icon} className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <span className={appear ? "nav-label-appear" : undefined} style={labelDelay}>
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
                        onClick={() => {
                          const target = document.getElementById(sectionKey);
                          if (target) {
                            // Route the jump through Lenis so it shares the page's inertia easing.
                            // Falls back to a native scroll if Lenis isn't mounted (e.g. reduced motion).
                            if (lenis) {
                              // offset clears the sticky navbar (h-16); immediate honours reduced motion.
                              const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                              lenis.scrollTo(target, { offset: -80, immediate: reduceMotion });
                            } else {
                              target.scrollIntoView({ behavior: "smooth", block: "start" });
                            }
                          }
                          onAfterClick?.();
                        }}
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
  );
}

interface SidebarFooterProps {
  collapsed: boolean;
  productName?: string;
  onDisconnect: () => void;
}

/** The device-status / disconnect footer, shared by the desktop aside and the drawer. */
function SidebarFooter({ collapsed, productName, onDisconnect }: SidebarFooterProps) {
  const { t } = useI18n();
  if (collapsed) {
    return (
      <div className="tooltip tooltip-right mt-[50px] block" data-tip={`${productName ?? ""} · ${t("disconnect")}`.trim()}>
        <button
          type="button"
          onClick={onDisconnect}
          aria-label={t("disconnect")}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-none bg-transparent text-brand-on-surface-variant transition hover:bg-red-600 hover:text-white"
        >
          <Icon icon="mdi:power" className="h-5 w-5 shrink-0" />
        </button>
      </div>
    );
  }
  return (
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
          <Icon icon="mdi:power" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface SidebarDrawerProps {
  productName?: string;
  onDisconnect: () => void;
  mode: PageMode;
  matrixTesterSupported: boolean;
  macroSupported: boolean;
  tapDanceSupported: boolean;
  comboSupported: boolean;
  qmkSections: MessageKey[];
  onNavigate: (mode: PageMode) => void;
  open: boolean;
  onClose: () => void;
}

/**
 * The narrow-viewport (`< md`) sidebar variant: an off-canvas drawer flush to the window's left and
 * bottom edges, sliding out from under the Navbar (top-16) over a scrim. Hidden at `md` and up,
 * where the floating {@link Sidebar} card takes over instead. Always mounted so the open/close slide
 * animates; visibility is driven by `open`.
 */
export function SidebarDrawer({
  productName,
  onDisconnect,
  mode,
  matrixTesterSupported,
  macroSupported,
  tapDanceSupported,
  comboSupported,
  qmkSections,
  onNavigate,
  open,
  onClose,
}: SidebarDrawerProps) {
  const { t } = useI18n();
  const supportedByKind: Partial<Record<NavKind, boolean>> = {
    matrixTest: matrixTesterSupported,
    macro: macroSupported,
    tapDance: tapDanceSupported,
    combo: comboSupported,
  };
  const showQmkToc = mode === "advanced" && qmkSections.length > 0;
  const activeSection = useScrollSpy(qmkSections, open && showQmkToc);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div className={"md:hidden " + (open ? "" : "pointer-events-none")}>
      <div
        onClick={onClose}
        aria-hidden="true"
        className={
          "fixed inset-x-0 bottom-0 top-16 z-40 bg-black/40 transition-opacity duration-300 ease-out " +
          (open ? "opacity-100" : "opacity-0")
        }
      />
      <aside
        data-lenis-prevent
        className={
          "fixed bottom-0 left-0 top-16 z-40 flex w-[min(82vw,320px)] flex-col overflow-y-auto rounded-r-[2rem] bg-brand-background px-6 py-6 shadow-2xl transition-transform duration-300 ease-out " +
          (open ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="mb-2 flex justify-start">
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeMenu")}
            className="flex h-[52px] w-[52px] items-center justify-center rounded-full border-none bg-transparent text-brand-on-surface-variant transition hover:bg-brand-surface-container-highest/60"
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>
        <SidebarNav
          mode={mode}
          supportedByKind={supportedByKind}
          onNavigate={onNavigate}
          collapsed={false}
          appear={false}
          showQmkToc={showQmkToc}
          activeSection={activeSection}
          qmkSections={qmkSections}
          onAfterClick={onClose}
        />
        <SidebarFooter collapsed={false} productName={productName} onDisconnect={onDisconnect} />
      </aside>
    </div>
  );
}
