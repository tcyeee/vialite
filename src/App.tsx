import { useCallback, useEffect, useRef, useState } from "react";
import { AdvancedPanel } from "./components/AdvancedPanel.tsx";
import { type ConnectionStatus } from "./components/DeviceConnect.tsx";
import { KeyboardLayout } from "./components/KeyboardLayout.tsx";
import { KeycodePicker } from "./components/KeycodePicker.tsx";
import { LayerTabs } from "./components/LayerTabs.tsx";
import { MatrixTester } from "./components/MatrixTester.tsx";
import { Sidebar } from "./components/Sidebar.tsx";
import { SpinnerIcon, WaitingForConnection } from "./components/WaitingForConnection.tsx";
import { useI18n } from "./i18n.tsx";
import { Keyboard } from "./protocol/keyboard.ts";
import { HidTransport } from "./protocol/transport.ts";
import { parseVil, serializeVil } from "./protocol/vilFile.ts";

type Selected =
  | { kind: "key"; row: number; col: number }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

// Module-level so StrictMode's double-invoked mount effect can't trigger two
// parallel auto-connect attempts.
let autoConnectStarted = false;

function App() {
  const { t } = useI18n();
  // Starts "reconnecting" (not "idle") so the very first render — before the
  // auto-connect effect below has had a chance to check for an
  // already-authorized device — doesn't flash the full WaitingForConnection
  // landing page on a refresh that's about to silently reconnect.
  const [status, setStatus] = useState<ConnectionStatus>("reconnecting");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<Keyboard | null>(null);
  const [productName, setProductName] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<"keymap" | "matrix" | "advanced">("keymap");
  const [selected, setSelected] = useState<Selected | null>(null);
  // Keyboard mutates its internal keymap in place; bumping this forces a
  // re-render so KeyboardLayout picks up the new label after a remap.
  const [, forceUpdate] = useState(0);
  const [importing, setImporting] = useState(false);
  const [ioMessage, setIoMessage] = useState<string | null>(null);
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
      };
      const kb = new Keyboard(transport);
      await kb.reload();
      setKeyboard(kb);
      setProductName(transport.productName);
      setLayer(0);
      setSelected(null);
      setMode("keymap");
      setError(null);
      setStatus("connected");
    },
    [teardown, t],
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
  }, [teardown]);

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
        setError(null);
      } catch (err) {
        setError(t("writeKeyFailed", { error: err instanceof Error ? err.message : String(err) }));
      }
      forceUpdate((r) => r + 1);
    },
    [keyboard, selected, layer, t],
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
      setIoMessage(null);
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
        setIoMessage(notes.join(" "));
      } catch (err) {
        setIoMessage(t("importFailed", { error: err instanceof Error ? err.message : String(err) }));
      } finally {
        setImporting(false);
        forceUpdate((r) => r + 1);
      }
    },
    [keyboard, t],
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
    <div className="min-h-screen bg-white/60 backdrop-blur-md p-4 dark:bg-black/30 md:p-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <Sidebar
          error={error}
          productName={productName}
          onDisconnect={handleDisconnect}
          mode={mode}
          matrixTesterSupported={!!keyboard?.supportsMatrixTester}
          onNavigate={(next) => {
            setMode(next);
            setSelected(null);
          }}
        />
        <main className="min-w-0 flex-1 p-6 md:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-brand-on-surface">
              {mode === "matrix" ? t("navMatrixTest") : mode === "advanced" ? t("navAdvanced") : t("keyboardLayoutTitle")}
            </h1>
          </div>
          {keyboard && mode === "keymap" && (
            <>
              <LayerTabs layers={keyboard.layers} active={layer} onSelect={setLayer} />
              <div className="overflow-x-auto">
                <KeyboardLayout
                  keyboard={keyboard}
                  layer={layer}
                  onKeySelect={(row, col) => setSelected({ kind: "key", row, col })}
                  onEncoderSelect={(index, direction) => setSelected({ kind: "encoder", index, direction })}
                />
              </div>
            </>
          )}
          {keyboard && mode === "matrix" && keyboard.supportsMatrixTester && <MatrixTester keyboard={keyboard} />}
          {keyboard && mode === "advanced" && (
            <AdvancedPanel
              keyboard={keyboard}
              importing={importing}
              ioMessage={ioMessage}
              onExport={handleExport}
              onImportFile={handleImportFile}
              onLayoutOptionsChange={() => forceUpdate((r) => r + 1)}
            />
          )}
        </main>
      </div>
      {selected && mode === "keymap" && <KeycodePicker onPick={handlePick} onClose={() => setSelected(null)} />}
      {importing && <div className="io-busy-overlay" />}
    </div>
  );
}

export default App;
