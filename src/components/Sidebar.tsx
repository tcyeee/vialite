import type { ReactNode, SVGProps } from "react";
import { useI18n, type MessageKey } from "../i18n.tsx";

type PageMode = "keymap" | "matrix" | "advanced";

interface Props {
  error: string | null;
  productName?: string;
  onDisconnect: () => void;
  mode: PageMode;
  matrixTesterSupported: boolean;
  onNavigate: (mode: PageMode) => void;
}

type NavKind = "home" | "matrixTest" | "advanced";

const NAV_ITEMS: { kind: NavKind; mode: PageMode; labelKey: MessageKey; Icon: (props: SVGProps<SVGSVGElement>) => ReactNode }[] = [
  { kind: "home", mode: "keymap", labelKey: "navHome", Icon: HomeIcon },
  { kind: "matrixTest", mode: "matrix", labelKey: "navMatrixTest", Icon: MatrixIcon },
  { kind: "advanced", mode: "advanced", labelKey: "navAdvanced", Icon: AdvancedIcon },
];

export function Sidebar({ error, productName, onDisconnect, mode, matrixTesterSupported, onNavigate }: Props) {
  const { t } = useI18n();

  return (
    <div className="sidebar-appear flex w-full shrink-0 flex-col gap-[100px] md:-ml-[30px] md:w-64">
      <img className="h-9 w-auto" src="/logo-full.svg" alt="Vialite" />

      <aside className="flex flex-col rounded-[2rem] bg-brand-background p-6">
        <nav className="flex flex-col gap-2">
          {NAV_ITEMS.map(({ kind, mode: itemMode, labelKey, Icon }) => {
            if (kind === "matrixTest" && !matrixTesterSupported) {
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
              <button
                key={labelKey}
                type="button"
                onClick={() => onNavigate(itemMode)}
                className={
                  active
                    ? "flex items-center gap-3 rounded-2xl border-none bg-brand-secondary-container px-4 py-4 text-left font-semibold text-brand-on-secondary-container transition"
                    : "flex items-center gap-3 rounded-2xl border-none bg-transparent px-4 py-4 text-left text-brand-on-surface-variant transition hover:bg-brand-surface-container-highest/60"
                }
              >
                <Icon className="h-5 w-5" />
                {t(labelKey)}
              </button>
            );
          })}
        </nav>

        <div className="mt-[50px] flex flex-col gap-2">
          <button
            type="button"
            onClick={onDisconnect}
            className="group flex items-center gap-2 rounded-2xl border-none bg-transparent px-4 py-3 text-left text-sm font-medium text-brand-on-surface-variant transition hover:text-red-600 dark:hover:text-red-400"
          >
            <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
              <span className="h-2 w-2 rounded-full bg-brand-secondary transition-opacity group-hover:opacity-0" />
              <PowerIcon className="absolute h-4 w-4 text-red-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-red-400" />
            </span>
            <span className="truncate">{productName ?? t("disconnect")}</span>
          </button>
          {error && <p className="error px-4 text-xs">{error}</p>}
        </div>
      </aside>
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
