import { useI18n } from "../../contexts/i18n.tsx";

export type ConnectionStatus = "reconnecting" | "idle" | "connecting" | "connected" | "error";

interface Props {
  error: string | null;
  productName?: string;
}

// Only ever rendered once App.tsx has moved to status === "connected"
// (WaitingForConnection covers idle/connecting/error, and App.tsx renders a
// bare loading screen for "reconnecting" without involving this component),
// so there's no not-connected branch here to keep in sync with it.
export function DeviceConnect({ error, productName }: Props) {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-2xl bg-brand-secondary-container/60 px-3 py-2 text-sm font-medium text-brand-on-secondary-container">
        <span className="h-2 w-2 shrink-0 rounded-full bg-brand-secondary" />
        <span className="truncate">{t("connectedTo", { name: productName ?? "" })}</span>
      </div>
      {error && <p className="error px-1 text-xs">{error}</p>}
    </div>
  );
}
