import { useCallback, useEffect, useRef, useState } from "react";
import { ComboPanel } from "./components/combo/ComboPanel.tsx";
import { type ConnectionStatus } from "./components/connect/DeviceConnect.tsx";
import { KeyboardLayout } from "./components/keymap/KeyboardLayout.tsx";
import { ImportExportPanel } from "./components/io/ImportExportPanel.tsx";
import { KeycodePicker } from "./components/common/KeycodePicker.tsx";
import { LayerTabs } from "./components/keymap/LayerTabs.tsx";
import { LayoutConfigPanel } from "./components/layout/LayoutConfigPanel.tsx";
import { MacroPanel } from "./components/macro/MacroPanel.tsx";
import { MatrixTester } from "./components/matrix/MatrixTester.tsx";
import { Navbar } from "./components/shell/Navbar.tsx";
import { QmkSettingsPanel } from "./components/qmk/QmkSettingsPanel.tsx";
import { Sidebar } from "./components/shell/Sidebar.tsx";
import { SiteSettingsPanel } from "./components/site/SiteSettingsPanel.tsx";
import { TapDancePanel } from "./components/tapdance/TapDancePanel.tsx";
import { SpinnerIcon, WaitingForConnection } from "./components/connect/WaitingForConnection.tsx";
import { useI18n, type MessageKey } from "./contexts/i18n.tsx";
import { Keyboard } from "./protocol/keyboard.ts";
import { HidTransport } from "./protocol/transport.ts";
import { parseVil, serializeVil } from "./protocol/vilFile.ts";
import { useToast } from "./contexts/toast.tsx";

type PageMode = "keymap" | "layout" | "matrix" | "macro" | "tapdance" | "combo" | "advanced" | "site" | "io";

type Selected =
  | { kind: "key"; row: number; col: number }
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
    async (transport: HidTransport) => {
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
      setQmkPendingCount(0);
      setQmkLeaveRequested(false);
      qmkPendingNavigationRef.current = null;
      setError(null);
      setStatus("connected");
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
      await attachTransport(transport);
    } catch (err) {
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
      } catch {
        // Best effort — fall back to the manual Connect button.
        await teardown();
        setStatus("idle");
      } finally {
        connectInFlightRef.current = false;
      }
    })();
  }, [attachTransport, teardown]);

  const handlePick = useCallback(
    async (qmkId: string) => {
      if (!keyboard || !selected) {
        return;
      }
      setSelected(null);
      try {
        if (selected.kind === "key") {
          await keyboard.setKey(layer, selected.row, selected.col, qmkId);
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

  if (status !== "connected") {
    return <WaitingForConnection status={status} error={error} onConnect={handleConnect} />;
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black/30 dark:backdrop-blur-md">
      <Navbar />
      <div className="p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
            <Sidebar
              productName={productName}
              onDisconnect={handleDisconnect}
              mode={mode}
              layoutConfigSupported={
                !!keyboard?.layoutLabels && keyboard.layoutLabels.length > 0 && keyboard.layoutOptions >= 0
              }
              matrixTesterSupported={!!keyboard?.supportsMatrixTester}
              macroSupported={!!keyboard && keyboard.macroCount > 0}
              tapDanceSupported={!!keyboard && keyboard.tapDanceCount > 0}
              comboSupported={!!keyboard && keyboard.comboCount > 0}
              qmkSections={qmkSections}
              onNavigate={navigate}
            />
            <main className="min-w-0 flex-1 p-6 md:p-8">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-brand-on-surface">
                  {mode === "layout"
                    ? t("navLayoutConfig")
                    : mode === "matrix"
                      ? t("navMatrixTest")
                      : mode === "macro"
                        ? t("navMacro")
                        : mode === "tapdance"
                          ? t("navTapDance")
                          : mode === "combo"
                            ? t("navCombo")
                            : mode === "advanced"
                              ? t("navAdvanced")
                              : mode === "site"
                                ? t("navSiteSettings")
                                : mode === "io"
                                  ? t("navImportExport")
                                  : t("keyboardLayoutTitle")}
                </h1>
              </div>
              {keyboard && mode === "keymap" && (
                <LayerTabs layers={keyboard.layers} active={layer} onSelect={setLayer}>
                  <div className="overflow-x-auto">
                    <KeyboardLayout
                      keyboard={keyboard}
                      layer={layer}
                      onKeySelect={(row, col) => setSelected({ kind: "key", row, col })}
                      onEncoderSelect={(index, direction) => setSelected({ kind: "encoder", index, direction })}
                    />
                  </div>
                </LayerTabs>
              )}
              {keyboard && mode === "layout" && (
                <LayoutConfigPanel keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
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
              {mode === "site" && <SiteSettingsPanel />}
              {keyboard && mode === "io" && (
                <ImportExportPanel importing={importing} onExport={handleExport} onImportFile={handleImportFile} />
              )}
            </main>
          </div>
        </div>
      </div>
      {selected && mode === "keymap" && <KeycodePicker onPick={handlePick} onClose={() => setSelected(null)} />}
      {importing && <div className="io-busy-overlay" />}
    </div>
  );
}

export default App;
