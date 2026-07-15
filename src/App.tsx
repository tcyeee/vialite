import { useCallback, useRef, useState } from "react";
import { DeviceConnect, type ConnectionStatus } from "./components/DeviceConnect.tsx";
import { KeyboardLayout } from "./components/KeyboardLayout.tsx";
import { KeycodePicker } from "./components/KeycodePicker.tsx";
import { LayerTabs } from "./components/LayerTabs.tsx";
import { Keyboard } from "./protocol/keyboard.ts";
import { HidTransport } from "./protocol/transport.ts";
import { parseVil, serializeVil } from "./protocol/vilFile.ts";

interface SelectedKey {
  row: number;
  col: number;
}

function App() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<Keyboard | null>(null);
  const [productName, setProductName] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<SelectedKey | null>(null);
  // Keyboard mutates its internal keymap in place; bumping this forces a
  // re-render so KeyboardLayout picks up the new label after a remap.
  const [, forceUpdate] = useState(0);
  const [importing, setImporting] = useState(false);
  const [ioMessage, setIoMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const transport = await HidTransport.requestDevice();
      const kb = new Keyboard(transport);
      await kb.reload();
      setKeyboard(kb);
      setProductName(transport.productName);
      setStatus("connected");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, []);

  const handlePick = useCallback(
    async (qmkId: string) => {
      if (!keyboard || !selected) {
        return;
      }
      await keyboard.setKey(layer, selected.row, selected.col, qmkId);
      setSelected(null);
      forceUpdate((r) => r + 1);
    },
    [keyboard, selected, layer],
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
        if (
          parsed.uid !== keyboard.uid &&
          !window.confirm("Saved keymap belongs to a different keyboard, are you sure you want to continue?")
        ) {
          return;
        }
        setImporting(true);
        const report = await keyboard.restoreLayout(parsed);
        const notes: string[] = [`Imported: ${report.written} assignment(s) written.`];
        if (report.unknownKeycodes.length > 0) {
          notes.push(`Skipped unsupported keycodes: ${report.unknownKeycodes.join(", ")}.`);
        }
        if (parsed.skippedFeatures.length > 0) {
          notes.push(`File contains ${parsed.skippedFeatures.join(", ")} — not supported yet, not applied.`);
        }
        setIoMessage(notes.join(" "));
      } catch (err) {
        setIoMessage(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setImporting(false);
        forceUpdate((r) => r + 1);
      }
    },
    [keyboard],
  );

  return (
    <div className="app">
      <h1>Vialite</h1>
      <DeviceConnect status={status} error={error} productName={productName} onConnect={handleConnect} />
      {keyboard && (
        <>
          <div className="layout-io">
            <button onClick={handleExport} disabled={importing}>
              Export layout
            </button>
            <button onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? "Importing..." : "Import layout"}
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
          <KeyboardLayout keyboard={keyboard} layer={layer} onKeySelect={(row, col) => setSelected({ row, col })} />
        </>
      )}
      {selected && <KeycodePicker onPick={handlePick} onClose={() => setSelected(null)} />}
      {importing && <div className="io-busy-overlay" />}
    </div>
  );
}

export default App;
