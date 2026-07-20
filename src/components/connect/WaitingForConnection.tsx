import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import { useTheme } from "../../contexts/theme.tsx";
import { getSupportStatus, getBrowserInfo, type SupportStatus } from "../../browserSupport.ts";
import { DebugLogToggle } from "../common/DebugLogToggle.tsx";
import type { ConnectionStatus } from "./DeviceConnect.tsx";

// The banner shown for each way the browser can't do WebHID; `supported` never
// renders one. Keyed so the text re-translates live on a language switch.
const UNSUPPORTED_BANNER: Record<Exclude<SupportStatus, "supported">, { title: MessageKey; desc: MessageKey }> = {
  insecure: { title: "browserInsecureTitle", desc: "browserInsecureDesc" },
  inapp: { title: "browserInappTitle", desc: "browserInappDesc" },
  unsupported: { title: "browserUnsupportedTitle", desc: "browserUnsupportedDesc" },
};

interface Props {
  status: ConnectionStatus;
  // True once a device has been selected in the picker and the handshake is in
  // flight. The "taking a while" hint times from here, not from picker-open, so
  // a user lingering in the device chooser doesn't trip it.
  attaching: boolean;
  error: string | null;
  onConnect: () => void;
  // Name of the last keyboard connected in this browser, if any — shows a
  // "重新连接 <name>" shortcut below the Detect button. At most one is ever
  // remembered (see components/connect/lastDevice.ts).
  lastDeviceName?: string | null;
  // Reconnects to that saved keyboard via navigator.hid.getDevices() (no
  // WebHID chooser popup) instead of onConnect's requestDevice() picker.
  onReconnectSaved?: () => void;
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

export function WaitingForConnection({
  status,
  attaching,
  error,
  onConnect,
  lastDeviceName,
  onReconnectSaved,
  zoom = false,
}: Props) {
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
  // A handshake that drags on past a second is itself a sign something's off (a
  // board that won't hand over its vial.json, a stalled handshake), so once we
  // cross that mark reveal the debug toggle mid-attempt — the user can enable
  // logging without having to wait for the attempt to fail first. Timed from
  // `attaching` (device selected), not picker-open, so a slow choice in the
  // device chooser never counts against it.
  const [slowConnect, setSlowConnect] = useState(false);
  useEffect(() => {
    if (!attaching) {
      setSlowConnect(false);
      return;
    }
    const id = setTimeout(() => setSlowConnect(true), 1000);
    return () => clearTimeout(id);
  }, [attaching]);
  // Any dead end on this screen — an unsupported browser, a failed connect
  // attempt, or one that's taking suspiciously long — surfaces the debug-log
  // toggle (the same switch as on the 网站设置 page) so users can turn on verbose
  // logging and retry without leaving here.
  // Same trigger drives the bottom-right troubleshooting corner (diagnostics +
  // debug-log toggle): an unsupported browser, a failed connect, or one that's
  // dragging on long enough to look stuck.
  const showDebug = !supported || status === "error" || slowConnect;
  const browser = useState(getBrowserInfo)[0];
  // ISO build stamp → the viewer's locale/timezone; guard against a malformed
  // value so the panel can never throw on this last-resort screen.
  const buildTime = (() => {
    const d = new Date(__BUILD_TIME__);
    return Number.isNaN(d.getTime()) ? __BUILD_TIME__ : d.toLocaleString();
  })();
  // One-tap copy of the whole diagnostics block, so a bug report can paste it
  // verbatim instead of hand-transcribing the UA. `copied` briefly flips the
  // label; clipboard may be unavailable in an insecure context, so it's guarded.
  const [copied, setCopied] = useState(false);
  const copyDiagnostics = () => {
    const text = `${t("diagBrowser")}: ${browser.name} ${browser.version}\n${t("diagBuild")}: ${buildTime}\n${t("diagUa")}: ${navigator.userAgent}`;
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => {},
    );
  };

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
          {support !== "supported" && (
            <div
              role="alert"
              className="flex items-start gap-3 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-3 text-left"
            >
              <Icon icon="mdi:alert-outline" className="mt-0.5 h-6 w-6 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-semibold text-brand-on-surface">{t(UNSUPPORTED_BANNER[support].title)}</p>
                <p className="text-sm text-brand-on-surface-variant">{t(UNSUPPORTED_BANNER[support].desc)}</p>
              </div>
            </div>
          )}

          {/* When the browser itself is the blocker (in-app WebView, insecure
              context, no WebHID) there's nothing to detect, so the title and
              Detect button are hidden entirely — the warning banner above is the
              whole message. They return once the browser is capable. */}
          {supported && (
            <>
              <h1 className="text-3xl font-bold text-brand-on-surface md:text-4xl">{t("waitingTitle")}</h1>

              <div className="pt-4">
                <button
                  type="button"
                  className="mx-auto flex items-center gap-3 rounded-2xl bg-primary px-8 py-4 text-xl font-bold text-primary-content shadow-none transition hover:bg-primary/85 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-primary"
                  onClick={onConnect}
                  disabled={connecting}
                >
                  {connecting ? (
                    <Icon icon="mdi:loading" className="h-6 w-6 animate-spin" />
                  ) : (
                    <Icon icon="mdi:magnify" className="h-6 w-6" />
                  )}
                  <span>{connecting ? t("connecting") : t("detectDevice")}</span>
                </button>
                {lastDeviceName && (
                  <button
                    type="button"
                    className="mx-auto mt-3 flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-brand-on-surface-variant transition hover:bg-brand-on-surface/5 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={onReconnectSaved}
                    disabled={connecting}
                  >
                    <Icon icon="mdi:history" className="h-4 w-4" />
                    <span>{t("reconnectSaved", { name: lastDeviceName })}</span>
                  </button>
                )}
              </div>

              {error && <p className="error text-sm font-medium">{error}</p>}
            </>
          )}
        </div>
      </div>

      {/* Bottom-right troubleshooting corner: the diagnostics readout and the
          debug-log toggle merged into one low-key panel. Shown on the same
          condition as the debug toggle used to be (`showDebug`) — an unsupported
          browser, a failed connect, or a suspiciously slow one. Kept subdued and
          with no z-index so it sits under the interactive UI. */}
      {showDebug && (
        <div
          className="fixed right-4 bottom-4 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-brand-outline/20 bg-brand-surface-variant/20 px-3 py-2 text-left text-[11px] leading-tight text-brand-on-surface-variant/70 transition-opacity duration-300"
          style={fadeStyle}
        >
          <div className="mb-1 flex items-center gap-1.5">
            <Icon icon="mdi:information-outline" className="h-3.5 w-3.5 opacity-60" />
            <span className="font-medium opacity-80">{t("diagTitle")}</span>
            <button
              type="button"
              onClick={copyDiagnostics}
              className="ml-auto flex items-center gap-1 rounded px-1.5 py-0.5 opacity-70 transition hover:bg-brand-on-surface/10 hover:opacity-100"
            >
              <Icon icon={copied ? "mdi:check" : "mdi:content-copy"} className="h-3.5 w-3.5" />
              {t(copied ? "diagCopied" : "diagCopy")}
            </button>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 tabular-nums">
            <dt className="opacity-60">{t("diagBrowser")}</dt>
            <dd className="font-mono">{`${browser.name} ${browser.version}`}</dd>
            <dt className="opacity-60">{t("diagBuild")}</dt>
            <dd className="font-mono">{buildTime}</dd>
            <dt className="opacity-60">{t("diagUa")}</dt>
            {/* Display is truncated to one line — the UA is for the Copy button /
                bug reports, not for the user to read; the full string still gets
                copied. */}
            <dd className="truncate font-mono">{navigator.userAgent}</dd>
          </dl>
          <div className="mt-2 flex items-center gap-2 border-t border-brand-outline/15 pt-2">
            <Icon icon="mdi:bug-outline" className="h-3.5 w-3.5 shrink-0 opacity-60" />
            <div className="min-w-0 flex-1">
              <p className="font-medium opacity-80">{t("debugLogTitle")}</p>
              <p className="opacity-60">{t("connectDebugPrompt")}</p>
            </div>
            <DebugLogToggle className="toggle toggle-primary toggle-sm" />
          </div>
        </div>
      )}

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
