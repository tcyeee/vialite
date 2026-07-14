import { useCallback, useState } from "react";
import { DeviceConnect, type ConnectionStatus } from "./components/DeviceConnect.tsx";
import { KeyboardLayout } from "./components/KeyboardLayout.tsx";
import { KeycodePicker } from "./components/KeycodePicker.tsx";
import { LayerTabs } from "./components/LayerTabs.tsx";
import { Keyboard } from "./protocol/keyboard.ts";
import { HidTransport } from "./protocol/transport.ts";

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

  return (
    <div className="app">
      <h1>Vialite</h1>
      <DeviceConnect status={status} error={error} productName={productName} onConnect={handleConnect} />
      {keyboard && (
        <>
          <LayerTabs layers={keyboard.layers} active={layer} onSelect={setLayer} />
          <KeyboardLayout keyboard={keyboard} layer={layer} onKeySelect={(row, col) => setSelected({ row, col })} />
        </>
      )}
      {selected && <KeycodePicker onPick={handlePick} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default App;
