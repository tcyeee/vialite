import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DeviceConnect, type ConnectionStatus } from "./components/DeviceConnect.tsx";
import { KeyboardLayout } from "./components/KeyboardLayout.tsx";
import { KeycodePicker } from "./components/KeycodePicker.tsx";
import { LayerTabs } from "./components/LayerTabs.tsx";
import { LayoutOptions } from "./components/LayoutOptions.tsx";
import { MatrixTester } from "./components/MatrixTester.tsx";
import { WaitingForConnection } from "./components/WaitingForConnection.tsx";
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

// three.js is a large dependency (~600 kB) only needed once a user opts into
// the 3D preview, so it's split into its own chunk and fetched on demand.
const KeyboardLayout3D = lazy(() =>
  import("./components/KeyboardLayout3D.tsx").then((m) => ({ default: m.KeyboardLayout3D })),
);

function App() {
  const { lang, setLang, t } = useI18n();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<Keyboard | null>(null);
  const [productName, setProductName] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [mode, setMode] = useState<"keymap" | "matrix">("keymap");
  const [viewMode, setViewMode] = useState<"2d" | "3d">("2d");
  const [selected, setSelected] = useState<Selected | null>(null);
  // Keyboard mutates its internal keymap in place; bumping this forces a
  // re-render so KeyboardLayout picks up the new label after a remap.
  const [, forceUpdate] = useState(0);
  const [importing, setImporting] = useState(false);
  const [ioMessage, setIoMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  // users don't have to go through the device chooser every time.
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
          return;
        }
        connectInFlightRef.current = true;
        setStatus("connecting");
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

  if (status !== "connected") {
    return <WaitingForConnection status={status} error={error} onConnect={handleConnect} />;
  }

  return (
    <div className="app">
      <div className="app-main">
        <div className="app-header">
          <img className="app-logo" src="/logo-full.svg" alt="Vialite" />
        </div>
        <DeviceConnect error={error} productName={productName} onDisconnect={handleDisconnect} />
        {keyboard && keyboard.supportsMatrixTester && (
          <div className="mode-tabs">
            <button className={mode === "keymap" ? "active" : ""} onClick={() => setMode("keymap")}>
              {t("keymapTab")}
            </button>
            <button className={mode === "matrix" ? "active" : ""} onClick={() => setMode("matrix")}>
              {t("matrixTestTab")}
            </button>
          </div>
        )}
        {keyboard && mode === "keymap" && (
          <>
            <div className="layout-io">
              <button onClick={handleExport} disabled={importing}>
                {t("exportLayout")}
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={importing}>
                {importing ? t("importing") : t("importLayout")}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".vil,application/json"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) {
                    void handleImportFile(file);
                  }
                }}
              />
              {ioMessage && <span className="io-message">{ioMessage}</span>}
            </div>
            <LayerTabs layers={keyboard.layers} active={layer} onSelect={setLayer} />
            <LayoutOptions keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
            <div className="mode-tabs view-mode-tabs">
              <button className={viewMode === "2d" ? "active" : ""} onClick={() => setViewMode("2d")}>
                {t("view2d")}
              </button>
              <button className={viewMode === "3d" ? "active" : ""} onClick={() => setViewMode("3d")}>
                {t("view3d")}
              </button>
            </div>
            {viewMode === "2d" ? (
              <KeyboardLayout
                keyboard={keyboard}
                layer={layer}
                onKeySelect={(row, col) => setSelected({ kind: "key", row, col })}
                onEncoderSelect={(index, direction) => setSelected({ kind: "encoder", index, direction })}
              />
            ) : (
              <Suspense fallback={<div className="keyboard-layout-3d" />}>
                <KeyboardLayout3D
                  keyboard={keyboard}
                  layer={layer}
                  onKeySelect={(row, col) => setSelected({ kind: "key", row, col })}
                  onEncoderSelect={(index, direction) => setSelected({ kind: "encoder", index, direction })}
                />
              </Suspense>
            )}
          </>
        )}
        {keyboard && mode === "matrix" && keyboard.supportsMatrixTester && <MatrixTester keyboard={keyboard} />}
        {selected && mode === "keymap" && <KeycodePicker onPick={handlePick} onClose={() => setSelected(null)} />}
        {importing && <div className="io-busy-overlay" />}
      </div>
      <footer className="app-footer">
        <button className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
          {lang === "zh" ? "EN" : "中文"}
        </button>
      </footer>
    </div>
  );
}

export default App;
