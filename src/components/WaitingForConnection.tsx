import { Component, lazy, Suspense, useState, type ReactNode, type SVGProps } from "react";
import { useI18n } from "../i18n.tsx";
import type { ConnectionStatus } from "./DeviceConnect.tsx";

interface Props {
  status: ConnectionStatus;
  error: string | null;
  onConnect: () => void;
}

// three.js is a large dependency (~600 kB); split into its own chunk so it
// doesn't block first paint of this screen while it fetches.
const KeyboardModelPreview = lazy(() =>
  import("./KeyboardModelPreview.tsx").then((m) => ({ default: m.KeyboardModelPreview })),
);

// WebGL is unavailable in some real-world contexts (disabled by the user, no
// GPU, a lost context, or the chunk itself failing to fetch), and only a
// class-component error boundary can catch a failure *inside* the lazy
// subtree — Suspense's fallback only covers the loading gap. Either failure
// mode falls back to the flat SVG icon rather than taking the whole page
// down with it, which is what an uncaught WebGLRenderer error used to do.
class ModelErrorBoundary extends Component<{ onError: () => void; children: ReactNode }> {
  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.props.children;
  }
}

export function WaitingForConnection({ status, error, onConnect }: Props) {
  const { lang, setLang, t } = useI18n();
  const connecting = status === "connecting";
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);

  return (
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-brand-background p-4">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-20 -left-20 h-[400px] w-[400px] rounded-full bg-brand-primary-container/40 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-[300px] w-[300px] rounded-full bg-brand-secondary-container/40 blur-3xl" />
        <div className="absolute top-1/2 left-1/3 h-[250px] w-[250px] rounded-full bg-brand-tertiary-container/20 blur-3xl" />
      </div>

      <img className="fixed top-6 left-6 h-12 w-auto md:h-16" src="/logo-full.svg" alt="Vialite" />

      <button
        type="button"
        className="fixed top-4 right-4 min-w-[3.5rem] rounded-lg border border-brand-outline/40 bg-white/60 px-3 py-1 text-sm font-medium text-brand-on-surface backdrop-blur-md"
        onClick={() => setLang(lang === "zh" ? "en" : "zh")}
      >
        {lang === "zh" ? "EN" : "中文"}
      </button>

      <div className="relative w-full max-w-2xl overflow-hidden rounded-[2rem] border-2 border-brand-surface-container-highest bg-white/60 p-8 text-center shadow-sm backdrop-blur-md md:p-16">
        <div className="relative mx-auto mb-6 h-40 w-full max-w-xs md:h-56">
          <div className="animate-kawaii-pulse absolute inset-x-0 top-1/2 -z-10 h-2/3 -translate-y-1/2 rounded-full bg-brand-secondary-container/30 blur-2xl" />
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: modelReady && !modelFailed ? 0 : 1 }}
          >
            <KeyboardIcon className="h-28 w-28 text-brand-primary md:h-40 md:w-40" />
          </div>
          {!modelFailed && (
            <div className="absolute inset-0">
              <ModelErrorBoundary onError={() => setModelFailed(true)}>
                <Suspense fallback={null}>
                  <KeyboardModelPreview onReady={() => setModelReady(true)} onError={() => setModelFailed(true)} />
                </Suspense>
              </ModelErrorBoundary>
            </div>
          )}
        </div>

        <div className="mx-auto max-w-lg space-y-4">
          <h1 className="text-3xl font-bold text-brand-on-surface md:text-4xl">{t("waitingTitle")}</h1>
          <p className="text-lg font-medium text-brand-on-surface-variant">{t("waitingSubtitle")}</p>

          <div className="pt-4">
            <button
              type="button"
              className="kawaii-btn mx-auto flex items-center gap-3 rounded-2xl border-2 border-brand-secondary bg-brand-secondary-container px-8 py-4 text-xl font-bold text-brand-on-secondary-container disabled:cursor-progress disabled:opacity-70"
              onClick={onConnect}
              disabled={connecting}
            >
              {connecting ? (
                <SpinnerIcon className="h-6 w-6 animate-spin" />
              ) : (
                <SearchIcon className="h-6 w-6" />
              )}
              <span>{connecting ? t("connecting") : t("detectDevice")}</span>
            </button>
          </div>

          {error && <p className="error text-sm font-medium">{error}</p>}
        </div>

        <div className="mt-12 flex justify-center gap-1 opacity-20 select-none">
          {KEYCAPS.map(({ colorClasses, wide }, i) => (
            <div
              key={i}
              className={`h-12 ${wide ? "w-24" : "w-12"} rounded-md border-b-4 ${colorClasses}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// Tailwind's compiler needs each utility class spelled out literally to find
// it — no template-interpolated class names — so each entry is a complete,
// static class string rather than a color name to build one from.
const KEYCAPS: { colorClasses: string; wide?: boolean }[] = [
  { colorClasses: "border-brand-primary/30 bg-brand-primary-container" },
  { colorClasses: "border-brand-secondary/30 bg-brand-secondary-container" },
  { colorClasses: "border-brand-tertiary/30 bg-brand-tertiary-container" },
  { colorClasses: "border-brand-primary/30 bg-brand-primary-container" },
  { colorClasses: "border-brand-outline/30 bg-brand-surface-container-highest", wide: true },
  { colorClasses: "border-brand-secondary/30 bg-brand-secondary-container" },
  { colorClasses: "border-brand-primary/30 bg-brand-primary-container" },
];

function KeyboardIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path
        strokeLinecap="round"
        d="M6 10h.01M9 10h.01M12 10h.01M15 10h.01M18 10h.01M6 14h.01M18 14h.01"
      />
      <path strokeLinecap="round" d="M9 14h6" />
    </svg>
  );
}

function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m21 21-4.3-4.3" />
    </svg>
  );
}

function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
