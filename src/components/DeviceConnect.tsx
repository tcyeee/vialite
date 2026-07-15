export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface Props {
  status: ConnectionStatus;
  error: string | null;
  productName?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function DeviceConnect({ status, error, productName, onConnect, onDisconnect }: Props) {
  return (
    <div className="device-connect">
      {status === "connected" ? (
        <>
          <span>Connected: {productName}</span>
          <button onClick={onDisconnect}>Disconnect</button>
        </>
      ) : (
        <button onClick={onConnect} disabled={status === "connecting"}>
          {status === "connecting" ? "Connecting..." : "Connect keyboard"}
        </button>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
