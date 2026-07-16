import { Component, lazy, Suspense, useState, type ReactNode, type SVGProps } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import type { ConnectionStatus } from "./DeviceConnect.tsx";

interface Props {
  status: ConnectionStatus;
  error: string | null;
  onConnect: () => void;
  // When true, plays the connect-success exit choreography: the 3D model
  // rapidly scales up to fill the viewport, the page fades to black, and the
  // rest of the UI (logo, toggles, title, button) fades out — leaving a black
  // canvas for App's config page to rise into from below.
  zoom?: boolean;
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

export function WaitingForConnection({ status, error, onConnect, zoom = false }: Props) {
  const { lang, setLang, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const connecting = status === "connecting";
  const [modelReady, setModelReady] = useState(false);
  const [modelFailed, setModelFailed] = useState(false);

  // Everything except the 3D model fades out during the zoom exit.
  const fadeStyle = { opacity: zoom ? 0 : 1 };

  return (
    <div
      className={`relative box-border flex h-screen flex-col items-center justify-center overflow-hidden bg-white p-4 ${
        zoom ? "pointer-events-none" : ""
      }`}
    >
      {/* Black curtain that fades in behind the (positioned) content so the
          zooming model stays visible on top of it. */}
      <div
        className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-[240ms] ease-in"
        style={{ opacity: zoom ? 1 : 0 }}
      />
      <img
        className="fixed top-6 left-6 h-12 w-auto transition-opacity duration-300 md:h-16"
        style={fadeStyle}
        src="/logo-full.svg"
        alt="Vialite"
      />

      <div className="fixed top-4 right-4 flex items-center gap-2 transition-opacity duration-300" style={fadeStyle}>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-outline/40 bg-white/60 text-brand-on-surface backdrop-blur-md transition hover:bg-white/80 dark:bg-black/40 dark:hover:bg-black/60"
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          aria-label={t("toggleLanguage")}
          title={t("toggleLanguage")}
        >
          <GlobeIcon className="h-7 w-7" />
        </button>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-outline/40 bg-white/60 text-brand-on-surface backdrop-blur-md transition hover:bg-white/80 dark:bg-black/40 dark:hover:bg-black/60"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={t("toggleTheme")}
          title={t("toggleTheme")}
        >
          {theme === "dark" ? <SunIcon className="h-7 w-7" /> : <MoonIcon className="h-7 w-7" />}
        </button>
      </div>

      <div className="relative w-full max-w-3xl p-6 text-center md:px-16 md:py-8">
        <div
          className="relative mx-auto mb-2 h-[20.3rem] w-full max-w-[40.5rem] md:h-[28.1rem]"
          // easeInExpo: the model barely grows at first (staying crisp at small
          // scale), then explodes to full size in the final moments — exactly
          // when the black curtain slams in, so the rough CSS-upscaled pixels
          // are never on screen long enough to register.
          style={{
            transform: zoom ? "scale(18)" : "scale(1)",
            transition: "transform 400ms cubic-bezier(0.7, 0, 0.84, 0)",
          }}
        >
          <div className="animate-kawaii-pulse absolute inset-x-0 top-1/2 -z-10 h-2/3 -translate-y-1/2 rounded-full bg-brand-secondary-container/30 blur-2xl" />
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
            style={{ opacity: modelReady && !modelFailed ? 0 : 1 }}
          >
            <KeyboardIcon className="h-36 w-36 text-brand-primary md:h-52 md:w-52" />
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

        <div className="mx-auto max-w-lg space-y-4 transition-opacity duration-300" style={fadeStyle}>
          <h1 className="text-3xl font-bold text-brand-on-surface md:text-4xl">{t("waitingTitle")}</h1>

          <div className="pt-4">
            <button
              type="button"
              className="mx-auto flex items-center gap-3 rounded-2xl bg-black px-8 py-4 text-xl font-bold text-white shadow-none transition hover:bg-neutral-800 disabled:cursor-progress disabled:opacity-70"
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
      </div>

      {/* Top-most darkening layer. ease-in keeps it near-transparent while the
          model is still growing, then rushes to full black at the end of the
          zoom so the whole frame — model included — snaps to black before the
          config page rises. */}
      <div
        className="pointer-events-none absolute inset-0 z-10 bg-black transition-opacity duration-[340ms] ease-in"
        style={{ opacity: zoom ? 1 : 0 }}
      />
    </div>
  );
}

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

export function SpinnerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" d="M21 12a9 9 0 0 0-9-9" />
    </svg>
  );
}
