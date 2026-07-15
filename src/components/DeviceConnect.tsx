import { useI18n } from "../i18n.tsx";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface Props {
  error: string | null;
  productName?: string;
  onDisconnect: () => void;
}

// Only ever rendered once App.tsx has moved to status === "connected"
// (WaitingForConnection covers idle/connecting/error), so there's no
// not-connected branch here to keep in sync with it.
export function DeviceConnect({ error, productName, onDisconnect }: Props) {
  const { t } = useI18n();
  return (
    <div className="device-connect">
      <span>{t("connectedTo", { name: productName ?? "" })}</span>
      <button onClick={onDisconnect}>{t("disconnect")}</button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
