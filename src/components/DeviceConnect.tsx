export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

interface Props {
  status: ConnectionStatus;
  error: string | null;
  productName?: string;
  onConnect: () => void;
}

export function DeviceConnect({ status, error, productName, onConnect }: Props) {
  return (
    <div className="device-connect">
      <button onClick={onConnect} disabled={status === "connecting"}>
        {status === "connected"
          ? `Connected: ${productName}`
          : status === "connecting"
            ? "Connecting..."
            : "Connect keyboard"}
      </button>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
