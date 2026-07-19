import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { getSupportStatus } from "../../browserSupport.ts";
import { DebugLogToggle } from "../common/DebugLogToggle.tsx";
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
  // WebHID support is fixed for the page's lifetime, so read it once. When the
  // browser can't do WebHID at all, detecting a device is pointless — we say so
  // and disable the button instead of letting it throw on click.
  const [support] = useState(getSupportStatus);
  const supported = support === "supported";
  // A connect attempt that drags on past a second is itself a sign something's
  // off (a board that won't hand over its vial.json, a stalled handshake), so
  // once we cross that mark reveal the debug toggle mid-attempt — the user can
  // enable logging without having to wait for the attempt to fail first.
  const [slowConnect, setSlowConnect] = useState(false);
  useEffect(() => {
    if (status !== "connecting") {
      setSlowConnect(false);
      return;
    }
    const id = setTimeout(() => setSlowConnect(true), 1000);
    return () => clearTimeout(id);
  }, [status]);
  // Any dead end on this screen — an unsupported browser, a failed connect
  // attempt, or one that's taking suspiciously long — surfaces the debug-log
  // toggle (the same switch as on the 网站设置 page) so users can turn on verbose
  // logging and retry without leaving here.
  const showDebug = !supported || status === "error" || slowConnect;

  // Everything except the 3D model fades out during the zoom exit.
  const fadeStyle = { opacity: zoom ? 0 : 1 };

  return (
    <div
      className={`relative box-border flex h-screen flex-col items-center justify-center overflow-hidden bg-brand-background p-4 ${
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
          <Icon icon="mdi:translate" className="h-7 w-7" />
        </button>
        <button
          type="button"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-brand-outline/40 bg-white/60 text-brand-on-surface backdrop-blur-md transition hover:bg-white/80 dark:bg-black/40 dark:hover:bg-black/60"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={t("toggleTheme")}
          title={t("toggleTheme")}
        >
          {theme === "dark" ? <Icon icon="mdi:white-balance-sunny" className="h-7 w-7" /> : <Icon icon="mdi:weather-night" className="h-7 w-7" />}
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
            <Icon icon="mdi:keyboard-outline" className="h-36 w-36 text-brand-primary md:h-52 md:w-52" />
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

          {!supported && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-left"
            >
              <Icon icon="mdi:alert-outline" className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-semibold text-brand-on-surface">
                  {t(support === "insecure" ? "browserInsecureTitle" : "browserUnsupportedTitle")}
                </p>
                <p className="text-sm text-brand-on-surface-variant">
                  {t(support === "insecure" ? "browserInsecureDesc" : "browserUnsupportedDesc")}
                </p>
              </div>
            </div>
          )}

          <div className="pt-4">
            <button
              type="button"
              className="mx-auto flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-xl font-bold text-primary-content shadow-none transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-primary"
              onClick={onConnect}
              disabled={connecting || !supported}
            >
              {connecting ? (
                <Icon icon="mdi:loading" className="h-6 w-6 animate-spin" />
              ) : (
                <Icon icon="mdi:magnify" className="h-6 w-6" />
              )}
              <span>{connecting ? t("connecting") : t("detectDevice")}</span>
            </button>
          </div>

          {error && <p className="error text-sm font-medium">{error}</p>}

          {showDebug && (
            <div className="mt-2 flex items-center gap-3 rounded-2xl border border-brand-outline/30 bg-brand-surface-variant/30 px-4 py-3 text-left">
              <Icon icon="mdi:bug-outline" className="h-5 w-5 shrink-0 text-brand-on-surface-variant" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-brand-on-surface">{t("debugLogTitle")}</p>
                <p className="text-xs text-brand-on-surface-variant">{t("connectDebugPrompt")}</p>
              </div>
              <DebugLogToggle />
            </div>
          )}
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

/** Loading spinner, reused by App.tsx. `mdi:loading` is an arc; add `animate-spin` to rotate it. */
export function SpinnerIcon({ className }: { className?: string }) {
  return <Icon icon="mdi:loading" className={className} />;
}
