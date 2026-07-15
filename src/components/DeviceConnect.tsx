import { useI18n } from "../i18n.tsx";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface Props {
  status: ConnectionStatus;
  error: string | null;
  productName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DeviceConnect({ status, error, productName, onConnect, onDisconnect }: Props) {
  const { t } = useI18n();
  return (
    <div className="device-connect">
      {status === "connected" ? (
        <>
          <span>{t("connectedTo", { name: productName ?? "" })}</span>
          <button onClick={onDisconnect}>{t("disconnect")}</button>
        </>
      ) : (
        <button onClick={onConnect} disabled={status === "connecting"}>
          {status === "connecting" ? t("connecting") : t("connectKeyboard")}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
