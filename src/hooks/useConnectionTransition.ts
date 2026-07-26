import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n, type MessageKey } from "../contexts/i18n.tsx";
import { useToast } from "../contexts/toast.tsx";
import { track } from "../lib/analytics.ts";
import { debugWarn } from "../lib/debug.ts";
import { Keyboard, probeVial } from "../protocol/keyboard.ts";
import { HidTransport, ProtocolError, type ProtocolErrorCode } from "../protocol/transport.ts";
import {
  clearSkipAutoConnect,
  loadLastDeviceName,
  markSkipAutoConnect,
  saveLastDeviceName,
  shouldSkipAutoConnect,
} from "../components/connect/lastDevice.ts";
import { type ConnectionStatus } from "../components/connect/DeviceConnect.tsx";
import { useKeyboardRevision } from "./useKeyboardRevision.ts";

/** i18n key for each failure `src/protocol/` can explain in the user's language. */
const CONNECT_ERROR_KEY: Record<ProtocolErrorCode, MessageKey> = {
  webhidUnsupported: "errWebhidUnsupported",
  noDeviceSelected: "errNoDeviceSelected",
  deviceDisconnected: "errDeviceDisconnected",
  commFailed: "errCommFailed",
  viaOnlyKeyboard: "errViaOnlyKeyboard",
  unsupportedProtocol: "errUnsupportedProtocol",
  malformedDefinition: "errMalformedDefinition",
};

/**
 * A connect failure captured as an i18n key + params rather than an
 * already-translated string, so the message re-renders in the current language
 * when the user flips the language toggle mid-error (a resolved string would
 * stay frozen in whatever language it was built in).
 */
export interface ConnectErrorInfo {
  key: MessageKey;
  params?: Record<string, string | number>;
}

/**
 * Turns a connect failure into a descriptor to show on the waiting page. Errors
 * the protocol layer tagged with a code get a fully translated explanation;
 * anything else (a DOM/WebHID exception, an xz or JSON failure on a corrupt
 * definition) keeps its English technical detail inside a translated frame —
 * still more useful than nothing, and the console has the full context.
 */
export function describeConnectError(err: unknown): ConnectErrorInfo {
  if (err instanceof ProtocolError && err.code) {
    return { key: CONNECT_ERROR_KEY[err.code], params: err.params };
  }
  return { key: "errConnectFailed", params: { error: err instanceof Error ? err.message : String(err) } };
}

// Module-level so StrictMode's double-invoked mount effect can't trigger two
// parallel auto-connect attempts.
let autoConnectStarted = false;

interface UseConnectionTransitionOptions {
  /** Called right after a keyboard is attached (manual connect, saved-device reconnect, or
   *  silent auto-reconnect), before `status` flips to "connected" — the exact point
   *  `attachTransport` used to reset navigation state (mode, QMK pending edits) inline. */
  onAttached?: () => void;
  /** Called once the disconnect "reveal" choreography finishes and teardown has run — the
   *  exact point `finishDisconnect` used to reset navigation state inline. */
  onDetached?: () => void;
}

/**
 * Owns the WebHID connect/disconnect lifecycle and the zoom-rise/darken-reveal page
 * transition choreography layered on top of it. Split out of App.tsx so this state machine
 * (and the `keyboard` instance it exclusively writes) can be reasoned about independently of
 * page-navigation concerns, which it only touches via the `onAttached`/`onDetached` callbacks.
 */
export function useConnectionTransition({ onAttached, onDetached }: UseConnectionTransitionOptions = {}) {
  const { t } = useI18n();
  const { showToast } = useToast();
  // Starts "reconnecting" (not "idle") so the very first render — before the
  // auto-connect effect below has had a chance to check for an
  // already-authorized device — doesn't flash the full WaitingForConnection
  // landing page on a refresh that's about to silently reconnect.
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  // True only once the user has picked a device in the WebHID chooser and the
  // handshake is actually underway — distinct from "connecting", which also
  // covers the (open-ended) time the picker sits open. The connect screen's
  // "taking a while" hint keys off this so a slow picker choice doesn't count.
  const [attaching, setAttaching] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ConnectErrorInfo | null>(null);
  const [keyboard, setKeyboard] = useState<Keyboard | null>(null);
  // Subscribes to every keyboard.set*/save*/restore* write so callers reading fields
  // directly off `keyboard` (getKey, layoutChoices, ...) re-render fresh — see
  // src/hooks/useKeyboardRevision.ts.
  useKeyboardRevision(keyboard);
  const [productName, setProductName] = useState<string | undefined>();
  // Name of the last keyboard successfully connected in this browser, shown as
  // a "重新连接 <name>" shortcut on the waiting screen once disconnected.
  // Seeded from localStorage so it survives a page reload.
  const [lastDeviceName, setLastDeviceName] = useState<string | null>(loadLastDeviceName);
  // Connect/disconnect page transition. Connect plays "zoom" (the waiting
  // page's 3D model scales up to fill a blackened screen) then "rise" (the
  // config page slides up from below over that black). Disconnect is
  // simpler: "darken" fades a black curtain in over the config page (which
  // mounts the waiting page off-screen above it, primed and ready but not yet
  // visible), then "reveal" slides that waiting page straight down from the
  // top edge into place over the blackened screen. Driven below and cleared
  // once complete.
  const [transition, setTransition] = useState<"none" | "zoom" | "rise" | "darken" | "reveal">("none");
  // Set at the start of a disconnect animation, consumed once "reveal"
  // finishes to decide which cleanup/toast path to run. A ref (not state) so
  // the possibly-stale closure captured by transport.onDisconnect (set once
  // per attachTransport call) always reads the current value.
  const pendingDisconnectRef = useRef<"manual" | "lost" | null>(null);
  const transportRef = useRef<HidTransport | null>(null);
  // Guards handleConnect and the auto-connect effect against running
  // concurrently — e.g. a manual click landing in the async gap between the
  // auto-connect effect finding a device and it calling setStatus("connecting").
  const connectInFlightRef = useRef(false);

  const teardown = useCallback(async () => {
    const old = transportRef.current;
    transportRef.current = null;
    setKeyboard(null);
    setProductName(undefined);
    if (old) {
      await old.close().catch(() => {});
    }
  }, []);

  const attachTransport = useCallback(
    async (transport: HidTransport, withTransition = false) => {
      await teardown();
      transportRef.current = transport;
      transport.onDisconnect = () => {
        if (pendingDisconnectRef.current) {
          return;
        }
        pendingDisconnectRef.current = "lost";
        setTransition("darken");
      };
      const kb = new Keyboard(transport);
      await kb.reload();
      setKeyboard(kb);
      setProductName(transport.productName);
      setLastDeviceName(transport.productName);
      saveLastDeviceName(transport.productName);
      // A real connection just happened, manually or silently — trust
      // auto-reconnect on the next reload again.
      clearSkipAutoConnect();
      onAttached?.();
      setErrorInfo(null);
      setStatus("connected");
      track("connect/success", transport.productName ?? "Unknown keyboard");
      // Only the manual connect flow (from the visible waiting page) plays the
      // zoom-and-rise transition; silent auto-reconnect skips straight in.
      if (withTransition) {
        setTransition("zoom");
      }
      showToast(t("deviceConnected", { name: transport.productName }), "success");
    },
    [teardown, onAttached, t, showToast],
  );

  const handleConnect = useCallback(async () => {
    if (connectInFlightRef.current) {
      return;
    }
    connectInFlightRef.current = true;
    setStatus("connecting");
    setAttaching(false);
    setErrorInfo(null);
    try {
      // Blocks in the browser's device picker; the user may take a while here.
      const transport = await HidTransport.requestDevice();
      // Device chosen — now the actual handshake begins, so start the clock.
      setAttaching(true);
      await attachTransport(transport, true);
    } catch (err) {
      console.error("[vialite] manual connect failed:", err);
      await teardown();
      setErrorInfo(describeConnectError(err));
      setStatus("error");
    } finally {
      connectInFlightRef.current = false;
      setAttaching(false);
    }
  }, [attachTransport, teardown]);

  // Tries every already-authorized Vial-capable device — navigator.hid.getDevices()
  // lists prior WebHID grants without opening the chooser UI — and attaches the
  // first one that actually answers a Vial handshake. Shared by the silent
  // page-load auto-reconnect effect and the "重新连接" shortcut button, so both
  // stay in sync. Returns whether a device was found and attached.
  const tryAttachAuthorizedDevice = useCallback(
    async (withTransition: boolean) => {
      const devices = await navigator.hid.getDevices();
      const candidates = devices.filter((d) => HidTransport.hasVialInterface(d));
      // hasVialInterface only proves the board exposes the raw-HID interface
      // VIA and Vial share, so handshake each candidate and take the first
      // that actually speaks Vial — otherwise an authorized VIA-only board
      // would shadow a real Vial keyboard plugged in alongside it.
      for (const device of candidates) {
        let transport: HidTransport;
        try {
          transport = await HidTransport.fromDevice(device);
        } catch (err) {
          // Claimed by another app, permission revoked, ... — a candidate we
          // can't even open shouldn't stop us reaching a good one behind it.
          debugWarn(`[vialite] cannot open ${device.productName}, skipping:`, err);
          continue;
        }
        if (await probeVial(transport)) {
          await attachTransport(transport, withTransition);
          return true;
        }
        debugWarn(`[vialite] skipping non-Vial device: ${device.productName}`);
        await transport.close();
      }
      return false;
    },
    [attachTransport],
  );

  // Manual counterpart to the silent auto-reconnect: the "重新连接 <name>"
  // shortcut on the waiting screen. Same underlying lookup, just triggered by
  // a click (e.g. after a physical unplug/replug mid-session, which the
  // mount-only auto-reconnect effect never re-runs for) instead of page load.
  const handleReconnectSaved = useCallback(async () => {
    if (connectInFlightRef.current) {
      return;
    }
    connectInFlightRef.current = true;
    setStatus("connecting");
    setAttaching(true);
    setErrorInfo(null);
    try {
      const connected = await tryAttachAuthorizedDevice(true);
      if (!connected) {
        await teardown();
        setErrorInfo({ key: "errReconnectNotFound" });
        setStatus("error");
      }
    } catch (err) {
      console.error("[vialite] reconnect-saved failed:", err);
      await teardown();
      setErrorInfo(describeConnectError(err));
      setStatus("error");
    } finally {
      connectInFlightRef.current = false;
      setAttaching(false);
    }
  }, [tryAttachAuthorizedDevice, teardown]);

  // Runs once the disconnect darken+reveal choreography finishes: the actual
  // teardown was deliberately deferred until now so the config page still had
  // real keyboard data to render while it slid away. "manual" closes the
  // transport properly (button-triggered); "lost" skips that — the device is
  // already gone, so there's nothing left to close.
  const finishDisconnect = useCallback(
    async (reason: "manual" | "lost") => {
      if (reason === "manual") {
        await teardown();
        setErrorInfo(null);
      } else {
        transportRef.current = null;
        setKeyboard(null);
        setProductName(undefined);
        setErrorInfo({ key: "keyboardDisconnected" });
      }
      setStatus("idle");
      onDetached?.();
      setTransition("none");
      showToast(t(reason === "lost" ? "keyboardDisconnected" : "deviceDisconnected"), "warning");
    },
    [teardown, onDetached, t, showToast],
  );

  const handleDisconnect = useCallback(() => {
    if (pendingDisconnectRef.current) {
      return;
    }
    // Mark this as an explicit disconnect so the next page load won't
    // silently auto-reconnect to the same board. Deliberately *not*
    // transport.forget(): that revokes the WebHID grant outright, which also
    // erases the device from navigator.hid.getDevices() — breaking the
    // "重新连接 <name>" shortcut and forcing the picker dialog back next time.
    // The flag gets the same "stay disconnected across reload" outcome
    // without touching the grant; attachTransport clears it on the next real
    // connect (manual or via the shortcut).
    markSkipAutoConnect();
    pendingDisconnectRef.current = "manual";
    setTransition("darken");
  }, []);

  // Reconnect to an already-authorized keyboard on page load, so returning
  // users don't have to go through the device chooser every time. Status
  // stays "reconnecting" (rendered as a bare loading screen, not the full
  // WaitingForConnection page) for the whole attempt, only dropping to
  // "idle" once it's clear there's nothing to silently reconnect to.
  useEffect(() => {
    if (autoConnectStarted) {
      return;
    }
    autoConnectStarted = true;
    void (async () => {
      // The user explicitly disconnected last time — respect that across the
      // reload instead of silently reattaching the same board. See
      // handleDisconnect / components/connect/lastDevice.ts.
      if (shouldSkipAutoConnect()) {
        setStatus("idle");
        return;
      }
      if (connectInFlightRef.current) {
        setStatus("idle");
        return;
      }
      connectInFlightRef.current = true;
      try {
        const connected = await tryAttachAuthorizedDevice(false);
        if (!connected) {
          setStatus("idle");
        }
      } catch (err) {
        // Best effort — fall back to the manual Connect button.
        console.error("[vialite] auto-reconnect failed:", err);
        await teardown();
        setStatus("idle");
      } finally {
        connectInFlightRef.current = false;
      }
    })();
  }, [tryAttachAuthorizedDevice, teardown]);

  // Drives both transition timelines. Connect: hold on the model zoom, then
  // let the config page rise, then clear the overlay entirely. Disconnect:
  // hold on the black curtain fading in (the waiting page mounts off-screen
  // above during this same hold, so it's primed and ready), then slide it
  // down into view, then finally run the deferred teardown.
  useEffect(() => {
    if (transition === "zoom") {
      const id = setTimeout(() => setTransition("rise"), 380);
      return () => clearTimeout(id);
    }
    if (transition === "rise") {
      const id = setTimeout(() => setTransition("none"), 560);
      return () => clearTimeout(id);
    }
    if (transition === "darken") {
      const id = setTimeout(() => setTransition("reveal"), 350);
      return () => clearTimeout(id);
    }
    if (transition === "reveal") {
      const id = setTimeout(() => {
        const reason = pendingDisconnectRef.current ?? "manual";
        pendingDisconnectRef.current = null;
        void finishDisconnect(reason);
      }, 600);
      return () => clearTimeout(id);
    }
  }, [transition, finishDisconnect]);

  // Resolve the stored error descriptor here (not when it's set) so switching
  // language re-renders it in the newly chosen language.
  const error = errorInfo ? t(errorInfo.key, errorInfo.params) : null;

  return {
    status,
    attaching,
    error,
    keyboard,
    productName,
    lastDeviceName,
    transition,
    handleConnect,
    handleReconnectSaved,
    handleDisconnect,
  };
}
