import { useCallback, useEffect, useRef, useState } from "react";
import { useLenis } from "lenis/react";
import { ComboPanel } from "./components/combo/ComboPanel.tsx";
import { type ConnectionStatus } from "./components/connect/DeviceConnect.tsx";
import { DualRoleEditor } from "./components/keymap/DualRoleEditor.tsx";
import { KeyboardLayout, type KeyPart } from "./components/keymap/KeyboardLayout.tsx";
import { placeLayout } from "./components/keymap/layoutGeometry.ts";
import { ImportExportPanel } from "./components/io/ImportExportPanel.tsx";
import { HelpIcon } from "./components/common/HelpIcon.tsx";
import { QuickConfigPanel } from "./components/keymap/quickConfig/QuickConfigPanel.tsx";
import { LayerTabs } from "./components/keymap/LayerTabs.tsx";
import { MacroPanel } from "./components/macro/MacroPanel.tsx";
import { MatrixTester } from "./components/matrix/MatrixTester.tsx";
import { Navbar } from "./components/shell/Navbar.tsx";
import { QmkSettingsPanel } from "./components/qmk/QmkSettingsPanel.tsx";
import { Sidebar, SidebarDrawer } from "./components/shell/Sidebar.tsx";
import { KeyboardColorPanel } from "./components/color/KeyboardColorPanel.tsx";
import { SiteSettingsPanel } from "./components/site/SiteSettingsPanel.tsx";
import { TapDancePanel } from "./components/tapdance/TapDancePanel.tsx";
import { SpinnerIcon, WaitingForConnection } from "./components/connect/WaitingForConnection.tsx";
import { useI18n, type MessageKey } from "./contexts/i18n.tsx";
import { Keyboard, probeVial } from "./protocol/keyboard.ts";
import { dualRole, withTap } from "./protocol/keycodes.ts";
import { HidTransport, ProtocolError, type ProtocolErrorCode } from "./protocol/transport.ts";
import { parseVil, serializeVil } from "./protocol/vilFile.ts";
import { useToast } from "./contexts/toast.tsx";
import { track } from "./analytics.ts";
import { debugWarn } from "./debug.ts";

type PageMode = "keymap" | "matrix" | "macro" | "tapdance" | "combo" | "color" | "advanced" | "site" | "io";

type Selected =
  | { kind: "key"; row: number; col: number; part?: KeyPart }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

// Module-level so StrictMode's double-invoked mount effect can't trigger two
// parallel auto-connect attempts.
let autoConnectStarted = false;

/**
 * Next key after (row, col) in visual reading order — top-to-bottom, then
 * left-to-right — among the currently-visible caps, wrapping back to the first
 * after the last. Powers the "自动选取下一个" auto-advance. Keys within ~0.4 KLE
 * units of the same vertical position count as one row (staggered/keycap gaps).
 */
function nextKeyPosition(
  keyboard: Keyboard,
  row: number,
  col: number,
): { row: number; col: number } | null {
  const placed = placeLayout(keyboard.keys, keyboard.encoders, keyboard.layoutChoices);
  const ordered = placed.keys
    .filter(({ key }) => !key.decal)
    .map(({ key, shiftX, shiftY }) => ({
      row: key.row,
      col: key.col,
      x: key.x + shiftX,
      y: key.y + shiftY,
    }))
    .sort((a, b) => (Math.abs(a.y - b.y) > 0.4 ? a.y - b.y : a.x - b.x));
  const idx = ordered.findIndex((k) => k.row === row && k.col === col);
  if (idx === -1) {
    return null;
  }
  const next = ordered[(idx + 1) % ordered.length];
  return { row: next.row, col: next.col };
}

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
interface ConnectErrorInfo {
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
function describeConnectError(err: unknown): ConnectErrorInfo {
  if (err instanceof ProtocolError && err.code) {
    return { key: CONNECT_ERROR_KEY[err.code], params: err.params };
  }
  return { key: "errConnectFailed", params: { error: err instanceof Error ? err.message : String(err) } };
}

function App() {
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
  const [productName, setProductName] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<PageMode>("keymap");
  const [selected, setSelected] = useState<Selected | null>(null);
  // When on, assigning a key advances the selection to the next key (reading
  // order) so a run of keys can be configured without re-clicking each cap.
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [qmkSections, setQmkSections] = useState<MessageKey[]>([]);
  // Page-level smooth-scroller, shared with the sidebar TOC so a "详细设置" jump into
  // the Advanced page lands with the same inertia easing.
  const lenis = useLenis();
  const [qmkPendingCount, setQmkPendingCount] = useState(0);
  const [qmkLeaveRequested, setQmkLeaveRequested] = useState(false);
  // Keyboard mutates its internal keymap in place; bumping this forces a
  // re-render so KeyboardLayout picks up the new label after a remap.
  const [, forceUpdate] = useState(0);
  const [importing, setImporting] = useState(false);
  // Narrow-viewport (`< md`) sidebar drawer open state; ignored at md+, where the floating
  // Sidebar card is shown instead.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Connect-success page transition. "zoom": the waiting page's 3D model
  // scales up to fill a blackened screen; "rise": the config page slides up
  // from below over that black. Driven from below and cleared once complete.
  const [transition, setTransition] = useState<"none" | "zoom" | "rise">("none");
  const transportRef = useRef<HidTransport | null>(null);
  // Target mode of a navigation attempt that got intercepted by qmkLeaveRequested; applied once
  // QmkSettingsPanel reports how the user resolved the "unsaved changes" dialog.
  const qmkPendingNavigationRef = useRef<PageMode | null>(null);
  // Guards handleConnect and the auto-connect effect against running
  // concurrently — e.g. a manual click landing in the async gap between the
  // auto-connect effect finding a device and it calling setStatus("connecting").
  const connectInFlightRef = useRef(false);

  const teardown = useCallback(async () => {
    const old = transportRef.current;
    transportRef.current = null;
    setKeyboard(null);
    setProductName(undefined);
    setSelected(null);
    if (old) {
      await old.close().catch(() => {});
    }
  }, []);

  const attachTransport = useCallback(
    async (transport: HidTransport, withTransition = false) => {
      await teardown();
      transportRef.current = transport;
      transport.onDisconnect = () => {
        transportRef.current = null;
        setKeyboard(null);
        setProductName(undefined);
        setSelected(null);
        setStatus("idle");
        setErrorInfo({ key: "keyboardDisconnected" });
        setQmkPendingCount(0);
        setQmkLeaveRequested(false);
        qmkPendingNavigationRef.current = null;
        showToast(t("keyboardDisconnected"), "warning");
      };
      const kb = new Keyboard(transport);
      await kb.reload();
      setKeyboard(kb);
      setProductName(transport.productName);
      setLayer(0);
      setSelected(null);
      setMode("keymap");
      setDrawerOpen(false);
      setQmkPendingCount(0);
      setQmkLeaveRequested(false);
      qmkPendingNavigationRef.current = null;
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
    [teardown, t, showToast],
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

  const handleDisconnect = useCallback(async () => {
    // Revoke the WebHID grant so auto-reconnect on the next page load won't
    // silently re-attach the board the user just chose to disconnect. teardown
    // nulls transportRef, so forget it first.
    const transport = transportRef.current;
    if (transport) {
      await transport.forget().catch(() => {});
    }
    await teardown();
    setErrorInfo(null);
    setStatus("idle");
    setQmkSections([]);
    setQmkPendingCount(0);
    setQmkLeaveRequested(false);
    qmkPendingNavigationRef.current = null;
    showToast(t("deviceDisconnected"), "warning");
  }, [teardown, t, showToast]);

  // Bails out (returns the same array reference) when the section list is unchanged, so this
  // doesn't cause QmkSettingsPanel's per-render effect to re-trigger a parent re-render forever.
  const handleQmkSectionsChange = useCallback((sections: MessageKey[]) => {
    setQmkSections((prev) =>
      prev.length === sections.length && prev.every((id, i) => id === sections[i]) ? prev : sections,
    );
  }, []);

  // Tries to switch page mode, but detours through QmkSettingsPanel's "unsaved changes" dialog
  // first when leaving Advanced Settings with edits still pending.
  const navigate = useCallback(
    (next: PageMode) => {
      if (mode === "advanced" && next !== "advanced" && qmkPendingCount > 0) {
        qmkPendingNavigationRef.current = next;
        setQmkLeaveRequested(true);
        return;
      }
      track(`view/${next}`);
      setMode(next);
      setSelected(null);
    },
    [mode, qmkPendingCount],
  );

  const handleQmkLeaveResolved = useCallback((shouldLeave: boolean) => {
    setQmkLeaveRequested(false);
    const next = qmkPendingNavigationRef.current;
    qmkPendingNavigationRef.current = null;
    if (shouldLeave && next !== null) {
      track(`view/${next}`);
      setMode(next);
      setSelected(null);
    }
  }, []);

  // A QMK Settings section a quick-config card asked to jump to ("详细设置"): remembered
  // across the navigation to the Advanced page, then consumed by the effect below once
  // that section has actually rendered (its `<section id={titleKey}>` exists in the DOM).
  const pendingQmkScrollRef = useRef<MessageKey | null>(null);
  const openQmkSection = useCallback(
    (section: MessageKey) => {
      pendingQmkScrollRef.current = section;
      navigate("advanced");
    },
    [navigate],
  );

  // Scroll to the pending QMK section once the Advanced page has mounted and reported
  // its sections (qmkSections). Mirrors the sidebar TOC's Lenis-or-native jump, but the
  // page has *just* switched to Advanced, so its full height isn't laid out yet: Lenis
  // still holds the previous (shorter) page's scroll range and would clamp the jump
  // short. Wait two animation frames for layout to settle, force Lenis to re-measure
  // (`resize`), then scroll — and keep the target pending (don't clear the ref) until
  // that actually runs, so a re-render mid-wait retries instead of dropping the jump.
  useEffect(() => {
    const section = pendingQmkScrollRef.current;
    if (mode !== "advanced" || section === null) return;
    const target = document.getElementById(section);
    if (!target) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        pendingQmkScrollRef.current = null;
        if (lenis) {
          lenis.resize();
          lenis.scrollTo(target, { offset: -80, force: true, immediate: reduceMotion });
        } else {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [mode, qmkSections, lenis]);

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
      try {
        const devices = await navigator.hid.getDevices();
        const candidates = devices.filter((d) => HidTransport.hasVialInterface(d));
        if (candidates.length === 0 || connectInFlightRef.current) {
          setStatus("idle");
          return;
        }
        connectInFlightRef.current = true;
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
            // A reload failure past this point is a real error worth surfacing,
            // not a reason to fall through to the next candidate.
            await attachTransport(transport);
            return;
          }
          debugWarn(`[vialite] skipping non-Vial device: ${device.productName}`);
          await transport.close();
        }
        setStatus("idle");
      } catch (err) {
        // Best effort — fall back to the manual Connect button.
        console.error("[vialite] auto-reconnect failed:", err);
        await teardown();
        setStatus("idle");
      } finally {
        connectInFlightRef.current = false;
      }
    })();
  }, [attachTransport, teardown]);

  // Drives the connect-success transition timeline: hold on the model zoom,
  // then let the config page rise, then clear the overlay entirely.
  useEffect(() => {
    if (transition === "zoom") {
      const id = setTimeout(() => setTransition("rise"), 380);
      return () => clearTimeout(id);
    }
    if (transition === "rise") {
      const id = setTimeout(() => setTransition("none"), 560);
      return () => clearTimeout(id);
    }
  }, [transition]);

  // Assigns a keycode to the currently-selected key/encoder. Unlike the old
  // popup flow, the selection is kept so the user can keep re-assigning the
  // same key from the quick-config board below.
  const handleAssign = useCallback(
    async (qmkId: string) => {
      if (!keyboard || !selected) {
        return;
      }
      let ok = false;
      try {
        if (selected.kind === "key") {
          const current = keyboard.getKey(layer, selected.row, selected.col);
          // The tap half of a dual-role cap swaps the inner key while keeping the
          // hold (falling back to writing the pick as-is if it can't recombine); a
          // plain cap writes the pick whole. The hold half is edited separately by
          // the dual-role editor, not through this pick flow.
          let toWrite = qmkId;
          try {
            if (selected.part === "tap" && dualRole(current)) {
              toWrite = withTap(current, qmkId);
            }
          } catch {
            toWrite = qmkId;
          }
          await keyboard.setKey(layer, selected.row, selected.col, toWrite);
        } else {
          await keyboard.setEncoder(layer, selected.index, selected.direction, qmkId);
        }
        ok = true;
      } catch (err) {
        showToast(t("writeKeyFailed", { error: err instanceof Error ? err.message : String(err) }));
      }
      forceUpdate((r) => r + 1);
      // "自动选取下一个": once a whole cap is assigned, advance the selection to the
      // next key in reading order so the user can configure a run of keys without
      // clicking each one. Only whole-key picks advance — editing the tap half of a
      // dual-role cap or an encoder keeps its own selection.
      if (ok && autoAdvance && selected.kind === "key" && selected.part === undefined) {
        const next = nextKeyPosition(keyboard, selected.row, selected.col);
        if (next) {
          setSelected({ kind: "key", row: next.row, col: next.col });
        }
      }
    },
    [keyboard, selected, layer, t, showToast, autoAdvance],
  );

  // Dual-role hold editor writes a fully-rebuilt keycode (Mod-Tap / Layer-Tap /
  // plain tap) straight to the selected cap — no recombination. Choosing 无
  // yields a non-dual-role key, so the hold sub-selection is dropped and the cap
  // falls back to the normal whole-key flow (quick-config reappears).
  const handleHoldWrite = useCallback(
    async (qmkId: string) => {
      if (!keyboard || selected?.kind !== "key") {
        return;
      }
      const { row, col } = selected;
      try {
        await keyboard.setKey(layer, row, col, qmkId);
      } catch (err) {
        showToast(t("writeKeyFailed", { error: err instanceof Error ? err.message : String(err) }));
      }
      if (!dualRole(qmkId)) {
        setSelected({ kind: "key", row, col });
      }
      forceUpdate((r) => r + 1);
    },
    [keyboard, selected, layer, t, showToast],
  );

  // Right-click context menu on the layout preview: write KC_NO / KC_TRNS
  // straight to the clicked cap or encoder, independent of the current selection.
  const handleContextAssign = useCallback(
    async (
      target:
        | { kind: "key"; row: number; col: number }
        | { kind: "encoder"; index: number; direction: 0 | 1 },
      qmkId: string,
    ) => {
      if (!keyboard) {
        return;
      }
      try {
        if (target.kind === "key") {
          await keyboard.setKey(layer, target.row, target.col, qmkId);
        } else {
          await keyboard.setEncoder(layer, target.index, target.direction, qmkId);
        }
      } catch (err) {
        showToast(t("writeKeyFailed", { error: err instanceof Error ? err.message : String(err) }));
      }
      forceUpdate((r) => r + 1);
    },
    [keyboard, layer, t, showToast],
  );

  const handleExport = useCallback(() => {
    if (!keyboard) {
      return;
    }
    const text = serializeVil(keyboard.saveLayout());
    const name = (productName ?? "keyboard").replace(/[\\/:*?"<>|]/g, "_");
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.vil`;
    a.click();
    URL.revokeObjectURL(url);
    track("vil/export");
  }, [keyboard, productName]);

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!keyboard) {
        return;
      }
      try {
        const parsed = parseVil(await file.text());
        if (parsed.uid !== keyboard.uid && !window.confirm(t("importUidMismatch"))) {
          return;
        }
        setImporting(true);
        const report = await keyboard.restoreLayout(parsed);
        track("vil/import");
        const notes: string[] = [t("importWritten", { n: report.written })];
        if (report.unknownKeycodes.length > 0) {
          notes.push(t("importSkippedKeycodes", { list: report.unknownKeycodes.join(", ") }));
        }
        if (parsed.skippedFeatures.length > 0) {
          notes.push(t("importSkippedFeatures", { list: parsed.skippedFeatures.join(", ") }));
        }
        showToast(notes.join(" "), "success");
      } catch (err) {
        showToast(t("importFailed", { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setImporting(false);
        forceUpdate((r) => r + 1);
      }
    },
    [keyboard, t, showToast],
  );

  if (status === "reconnecting") {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-background">
        <SpinnerIcon className="h-10 w-10 animate-spin text-brand-primary" />
      </div>
    );
  }

  // Resolve the stored error descriptor here (not when it's set) so switching
  // language re-renders it in the newly chosen language.
  const error = errorInfo ? t(errorInfo.key, errorInfo.params) : null;

  const connected = status === "connected";
  const inTransition = transition !== "none";
  // Keep the waiting page mounted through the transition so its 3D model
  // (three.js scene) isn't torn down and re-created mid-animation.
  const showWaiting = !connected || inTransition;

  return (
    <>
      {connected && (
        <div
          key="config"
          // During the rise transition this becomes a fixed, self-scrolling overlay; tell Lenis to
          // leave it alone. Omitted otherwise — on the normal page this div wraps everything, and a
          // permanent data-lenis-prevent here would stop Lenis from scrolling the page at all.
          {...(inTransition ? { "data-lenis-prevent": "" } : {})}
          className={
            inTransition
              ? "fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-black/30 dark:backdrop-blur-md"
              : "min-h-screen bg-white dark:bg-brand-background"
          }
          style={
            inTransition
              ? {
                  transform: transition === "rise" ? "translateY(0)" : "translateY(100%)",
                  transition:
                    transition === "rise" ? "transform 520ms cubic-bezier(0.22, 1, 0.36, 1)" : "none",
                }
              : undefined
          }
        >
          <Navbar onMenuClick={() => setDrawerOpen(true)} />
          <SidebarDrawer
            productName={productName}
            onDisconnect={handleDisconnect}
            mode={mode}
            matrixTesterSupported={!!keyboard?.supportsMatrixTester}
            macroSupported={!!keyboard && keyboard.macroCount > 0}
            tapDanceSupported={!!keyboard && keyboard.tapDanceCount > 0}
            comboSupported={!!keyboard && keyboard.comboCount > 0}
            qmkSections={qmkSections}
            onNavigate={navigate}
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
          />
      <div className="p-4 pt-0 md:p-6 md:pt-0">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6 lg:gap-8 xl:gap-10 2xl:gap-12">
            <Sidebar
              productName={productName}
              onDisconnect={handleDisconnect}
              mode={mode}
              matrixTesterSupported={!!keyboard?.supportsMatrixTester}
              macroSupported={!!keyboard && keyboard.macroCount > 0}
              tapDanceSupported={!!keyboard && keyboard.tapDanceCount > 0}
              comboSupported={!!keyboard && keyboard.comboCount > 0}
              qmkSections={qmkSections}
              onNavigate={navigate}
              appear={!inTransition}
            />
            <main className="min-w-0 flex-1 p-6 md:p-8">
              <div key={mode} className="page-transition">
              {mode !== "site" && mode !== "keymap" && (
              <div className="mb-6 flex items-center gap-2">
                <h1 className="text-3xl font-bold text-brand-on-surface">
                  {mode === "matrix"
                    ? t("navMatrixTest")
                    : mode === "macro"
                      ? t("navMacro")
                      : mode === "tapdance"
                        ? t("navTapDance")
                        : mode === "combo"
                          ? t("navCombo")
                          : mode === "color"
                            ? t("navKeyboardColor")
                            : mode === "advanced"
                              ? t("navAdvanced")
                              : t("navImportExport")}
                </h1>
                {mode === "macro" && <HelpIcon text={t("macroHint")} />}
                {mode === "tapdance" && <HelpIcon text={t("tapDanceHint")} />}
                {mode === "combo" && <HelpIcon text={t("comboHint")} />}
              </div>
              )}
              {keyboard && mode === "keymap" && (
                <>
                  <LayerTabs
                    layers={keyboard.layers}
                    active={layer}
                    onSelect={setLayer}
                    isConfigured={(l) => keyboard.isLayerConfigured(l)}
                  >
                    {/* px/py 给外壳的立体投影(.keyboard-case-shaded 向下与左右
                        的 box-shadow)留出空间:overflow-x-auto 会让 overflow-y
                        计算为 auto,容器边缘会裁掉溢出的阴影,padding 区域不被裁剪。
                        等量负外边距(-mx/-mb/-mt)抵消这圈 padding,使键盘的视觉
                        位置与周围内容保持原有对齐,不因留白而偏移。 */}
                    <div
                      // Marks the keyboard preview so an expanded quick-config
                      // card below stays open when a key here is clicked — the
                      // click still re-selects the cap, it just doesn't collapse
                      // the card (see ExpandableCardColumn's outside-click close).
                      data-keyboard-preview
                      className="-mx-4 -mb-6 -mt-2 overflow-x-auto px-4 pb-6 pt-2"
                    >
                      <KeyboardLayout
                        keyboard={keyboard}
                        layer={layer}
                        selected={selected}
                        onKeySelect={(row, col, part) => {
                          // Clicking the hold band selects that sub-part, which
                          // swaps the quick-config grid below for the dedicated
                          // dual-role editor; the top / whole cap toggles selection
                          // for the normal quick-config + picker flow.
                          if (part === "hold") {
                            setSelected({ kind: "key", row, col, part: "hold" });
                            return;
                          }
                          setSelected((prev) =>
                            prev?.kind === "key" &&
                            prev.row === row &&
                            prev.col === col &&
                            prev.part === part
                              ? null
                              : { kind: "key", row, col, ...(part ? { part } : {}) },
                          );
                        }}
                        onEncoderSelect={(index, direction) =>
                          setSelected({ kind: "encoder", index, direction })
                        }
                        onContextAssign={handleContextAssign}
                      />
                    </div>
                  </LayerTabs>
                  {selected?.kind === "key" && selected.part === "hold" ? (
                    <DualRoleEditor
                      key={`${selected.row},${selected.col}`}
                      qmkId={keyboard.getKey(layer, selected.row, selected.col)}
                      layerCount={keyboard.layers}
                      onWrite={handleHoldWrite}
                    />
                  ) : (
                    // 快捷配置始终显示;未选中按键时整体置灰且不可交互(提示浮在
                    // 模拟键盘上)。置灰在面板内部按块处理,以便提示徽标保持不透明
                    // ——祖先若用 opacity 会连带把徽标一起变透明。
                    <section className="mt-6">
                      <div
                        aria-disabled={!selected}
                        className={
                          selected ? undefined : "pointer-events-none select-none"
                        }
                      >
                        <QuickConfigPanel
                          onPick={handleAssign}
                          keyboard={keyboard}
                          onNavigate={navigate}
                          onOpenQmkSection={openQmkSection}
                          autoAdvance={autoAdvance}
                          onAutoAdvanceChange={setAutoAdvance}
                          disabled={!selected}
                          // 选中双功能键的上半区(tap)时,只允许基础键码:除「功能」
                          // 列前三张卡片外的所有卡片置灰不可交互。
                          dualRoleTap={selected?.kind === "key" && selected.part === "tap"}
                        />
                      </div>
                    </section>
                  )}
                </>
              )}
              {keyboard && mode === "matrix" && keyboard.supportsMatrixTester && <MatrixTester keyboard={keyboard} />}
              {keyboard && mode === "macro" && (
                <MacroPanel keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
              )}
              {keyboard && mode === "tapdance" && (
                <TapDancePanel keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
              )}
              {keyboard && mode === "combo" && (
                <ComboPanel keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
              )}
              {keyboard && mode === "advanced" && (
                <QmkSettingsPanel
                  keyboard={keyboard}
                  onChange={() => forceUpdate((r) => r + 1)}
                  onSectionsChange={handleQmkSectionsChange}
                  onPendingCountChange={setQmkPendingCount}
                  leaveRequested={qmkLeaveRequested}
                  onLeaveResolved={handleQmkLeaveResolved}
                />
              )}
              {keyboard && mode === "color" && (
                <KeyboardColorPanel
                  keyboard={keyboard}
                  onChange={() => forceUpdate((r) => r + 1)}
                  onEditKeymap={() => navigate("keymap")}
                />
              )}
              {mode === "site" && <SiteSettingsPanel />}
              {keyboard && mode === "io" && (
                <ImportExportPanel importing={importing} onExport={handleExport} onImportFile={handleImportFile} />
              )}
              </div>
            </main>
          </div>
        </div>
      </div>
          {importing && <div className="io-busy-overlay" />}
        </div>
      )}
      {showWaiting && (
        <div
          key="waiting"
          className={inTransition ? "fixed inset-0 z-40 pointer-events-none" : "fixed inset-0 z-40"}
        >
          <WaitingForConnection
            status={status}
            attaching={attaching}
            error={error}
            onConnect={handleConnect}
            zoom={inTransition}
          />
        </div>
      )}
    </>
  );
}

export default App;
