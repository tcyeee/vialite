import { useCallback, useEffect, useRef, useState } from "react";
import { DeviceConnect, type ConnectionStatus } from "./components/DeviceConnect.tsx";
import { KeyboardLayout } from "./components/KeyboardLayout.tsx";
import { KeycodePicker } from "./components/KeycodePicker.tsx";
import { LayerTabs } from "./components/LayerTabs.tsx";
import { LayoutOptions } from "./components/LayoutOptions.tsx";
import { Keyboard } from "./protocol/keyboard.ts";
import { HidTransport } from "./protocol/transport.ts";

type Selected =
  | { kind: "key"; row: number; col: number }
  | { kind: "encoder"; index: number; direction: 0 | 1 };

// Module-level so StrictMode's double-invoked mount effect can't trigger two
// parallel auto-connect attempts.
let autoConnectStarted = false;

function App() {
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [keyboard, setKeyboard] = useState<Keyboard | null>(null);
  const [productName, setProductName] = useState<string | undefined>();
  const [layer, setLayer] = useState(0);
  const [selected, setSelected] = useState<Selected | null>(null);
  // Keyboard mutates its internal keymap in place; bumping this forces a
  // re-render so KeyboardLayout picks up the new label after a remap.
  const [, forceUpdate] = useState(0);
  const transportRef = useRef<HidTransport | null>(null);

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
        setError("Keyboard disconnected — plug it back in and reconnect.");
      };
      const kb = new Keyboard(transport);
      await kb.reload();
      setKeyboard(kb);
      setProductName(transport.productName);
      setLayer(0);
      setSelected(null);
      setError(null);
      setStatus("connected");
    },
    [teardown],
  );

  const handleConnect = useCallback(async () => {
    setStatus("connecting");
    setError(null);
    try {
      const transport = await HidTransport.requestDevice();
      await attachTransport(transport);
    } catch (err) {
      await teardown();
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
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
        if (!device) {
          return;
        }
        setStatus("connecting");
        const transport = await HidTransport.fromDevice(device);
        await attachTransport(transport);
      } catch {
        // Best effort — fall back to the manual Connect button.
        await teardown();
        setStatus("idle");
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
        setError(`Failed to write key: ${err instanceof Error ? err.message : String(err)}`);
      }
      forceUpdate((r) => r + 1);
    },
    [keyboard, selected, layer],
  );

  return (
    <div className="app">
      <h1>Vialite</h1>
      <DeviceConnect
        status={status}
        error={error}
        productName={productName}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />
      {keyboard && (
        <>
          <LayerTabs layers={keyboard.layers} active={layer} onSelect={setLayer} />
          <LayoutOptions keyboard={keyboard} onChange={() => forceUpdate((r) => r + 1)} />
          <KeyboardLayout
            keyboard={keyboard}
            layer={layer}
            onKeySelect={(row, col) => setSelected({ kind: "key", row, col })}
            onEncoderSelect={(index, direction) => setSelected({ kind: "encoder", index, direction })}
          />
        </>
      )}
      {selected && <KeycodePicker onPick={handlePick} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
