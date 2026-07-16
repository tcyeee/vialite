import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type SVGProps,
} from "react";
import { useI18n, type MessageKey } from "../i18n.tsx";

type PageMode = "keymap" | "matrix" | "macro" | "tapdance" | "combo" | "advanced";

const SIDEBAR_WIDTH_KEY = "vialite-sidebar-width";
const DEFAULT_SIDEBAR_WIDTH = 256;
const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 420;

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

type NavKind = "home" | "matrixTest" | "macro" | "tapDance" | "combo" | "advanced";

const NAV_ITEMS: { kind: NavKind; mode: PageMode; labelKey: MessageKey; Icon: (props: SVGProps<SVGSVGElement>) => ReactNode }[] = [
  { kind: "home", mode: "keymap", labelKey: "navHome", Icon: HomeIcon },
  { kind: "matrixTest", mode: "matrix", labelKey: "navMatrixTest", Icon: MatrixIcon },
  { kind: "macro", mode: "macro", labelKey: "navMacro", Icon: MacroIcon },
  { kind: "tapDance", mode: "tapdance", labelKey: "navTapDance", Icon: TapDanceIcon },
  { kind: "combo", mode: "combo", labelKey: "navCombo", Icon: ComboIcon },
  { kind: "advanced", mode: "advanced", labelKey: "navAdvanced", Icon: AdvancedIcon },
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
  const showQmkToc = mode === "advanced" && qmkSections.length > 0;
  const activeSection = useScrollSpy(qmkSections, showQmkToc);
  const [sidebarWidth, setSidebarWidth] = useState(readStoredSidebarWidth);

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

  return (
    <div
      className="sidebar-appear relative w-full shrink-0 md:sticky md:top-20 md:-ml-[30px] md:w-[var(--sidebar-w)] md:self-start"
      style={{ "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}
    >
      <aside className="flex flex-col rounded-[2rem] bg-brand-background p-6">
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ kind, mode: itemMode, labelKey, Icon }) => {
            if (supportedByKind[kind] === false) {
              return (
                <div
                  key={labelKey}
                  className="flex cursor-default items-center gap-3 rounded-2xl px-4 py-4 text-brand-on-surface-variant opacity-40"
                  title={t("comingSoon")}
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
                </div>
              );
            }
            const active = mode === itemMode;
            return (
              <div key={labelKey}>
                <button
                  type="button"
                  onClick={() => onNavigate(itemMode)}
                  className={
                    active
                      ? "flex w-full items-center gap-3 rounded-2xl border-none bg-brand-secondary-container px-4 py-4 text-left font-semibold text-brand-on-secondary-container transition"
                      : "flex w-full items-center gap-3 rounded-2xl border-none bg-transparent px-4 py-4 text-left text-brand-on-surface-variant transition hover:bg-brand-surface-container-highest/60"
                  }
                >
                  <Icon className="h-5 w-5" />
                  {t(labelKey)}
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

        <div className="group mt-[50px] flex items-center gap-2 rounded-2xl px-4 py-3">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand-secondary animate-status-breathe" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium uppercase text-brand-on-surface-variant">
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
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t("resizeSidebar")}
        onMouseDown={startResize}
        className="absolute inset-y-0 -right-2 z-10 hidden w-4 cursor-col-resize touch-none select-none md:block"
      >
        <div className="mx-auto h-full w-px bg-transparent transition-colors hover:bg-brand-primary/50" />
      </div>
    </div>
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

function PowerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" d="M12 3v8" />
      <path strokeLinecap="round" d="M6.5 6.5a8 8 0 1 0 11 0" />
    </svg>
  );
}
