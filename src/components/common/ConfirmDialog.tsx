import { useI18n } from "../../contexts/i18n.tsx";

interface Props {
  /** Body text explaining what's about to happen. */
  message: string;
  /** Confirm button label; defaults to the shared "Delete" string. */
  confirmLabel?: string;
  /** Style the confirm button as destructive (red). Defaults to true. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A DaisyUI modal replacement for `window.confirm` — same style as {@link UnlockDialog}
 * (`.modal-open` box + click-through backdrop). Render it conditionally; the caller owns
 * the open/close state.
 */
export function ConfirmDialog({ message, confirmLabel, danger = true, onConfirm, onCancel }: Props) {
  const { t } = useI18n();
  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <p className="py-2">{message}</p>
        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className={`btn btn-sm ${danger ? "btn-error" : "btn-primary"}`}
            onClick={onConfirm}
          >
            {confirmLabel ?? t("delete")}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onCancel} />
    </div>
  );
}
