import { useCallback, useEffect, useRef, useState } from "react";
import { ComboPanel } from "./components/combo/ComboPanel.tsx";
import { type ConnectionStatus } from "./components/connect/DeviceConnect.tsx";
import { DualRoleEditor } from "./components/keymap/DualRoleEditor.tsx";
import { KeyboardLayout, type KeyPart } from "./components/keymap/KeyboardLayout.tsx";
import { ImportExportPanel } from "./components/io/ImportExportPanel.tsx";
import { HelpIcon } from "./components/common/HelpIcon.tsx";
import { KeycodeTabs } from "./components/keymap/KeycodeTabs.tsx";
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
import { Keyboard } from "./protocol/keyboard.ts";
import { dualRole, withTap } from "./protocol/keycodes.ts";
import { HidTransport } from "./protocol/transport.ts";
import { parseVil, serializeVil } from "./protocol/vilFile.ts";
import { useToast } from "./contexts/toast.tsx";
import { track } from "./analytics.ts";

type PageMode = "keymap" | "matrix" | "macro" | "tapdance" | "combo" | "color" | "advanced" | "site" | "io";

type Selected =
  | { kind: "key"; row: number; col: number; part?: KeyPart }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

// Module-level so StrictMode's double-invoked mount effect can't trigger two
// parallel auto-connect attempts.
let autoConnectStarted = false;

function App() {
  const { t } = useI18n();
  const { showToast } = useToast();
  // Starts "reconnecting" (not "idle") so the very first render — before the
  // auto-connect effect below has had a chance to check for an
  // already-authorized device — doesn't flash the full WaitingForConnection
  // landing page on a refresh that's about to silently reconnect.
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<Keyboard | null>(null);
  const [productName, setProductName] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<PageMode>("keymap");
  const [selected, setSelected] = useState<Selected | null>(null);
  const [qmkSections, setQmkSections] = useState<MessageKey[]>([]);
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
        setError(t("keyboardDisconnected"));
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
      setError(null);
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
    setError(null);
    try {
      const transport = await HidTransport.requestDevice();
      await attachTransport(transport, true);
    } catch (err) {
      console.error("[vialite] manual connect failed:", err);
      await teardown();
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    } finally {
      connectInFlightRef.current = false;
    }
  }, [attachTransport, teardown]);

  const handleDisconnect = useCallback(async () => {
    await teardown();
    setError(null);
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
        const device = devices.find((d) => HidTransport.isVialDevice(d));
        if (!device || connectInFlightRef.current) {
          setStatus("idle");
          return;
        }
        connectInFlightRef.current = true;
        const transport = await HidTransport.fromDevice(device);
        await attachTransport(transport);
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
      } catch (err) {
        showToast(t("writeKeyFailed", { error: err instanceof Error ? err.message : String(err) }));
      }
      forceUpdate((r) => r + 1);
    },
    [keyboard, selected, layer, t, showToast],
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
          className={
            inTransition
              ? "fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-black/30 dark:backdrop-blur-md"
              : "min-h-screen bg-white dark:bg-black/30 dark:backdrop-blur-md"
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
      <div className="p-4 md:p-6">
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
              {mode !== "site" && (
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
                              : mode === "io"
                                ? t("navImportExport")
                                : t("keyboardLayoutTitle")}
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
                    <div className="-mx-4 -mb-6 -mt-2 overflow-x-auto px-4 pb-6 pt-2">
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
                  ) : selected ? (
                    <section className="mt-6">
                      <KeycodeTabs onPick={handleAssign} keyboard={keyboard} onNavigate={navigate} />
                    </section>
                  ) : (
                    <section className="mt-6">
                      <p className="text-sm opacity-70">{t("selectKeyFirst")}</p>
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
                <KeyboardColorPanel keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
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
