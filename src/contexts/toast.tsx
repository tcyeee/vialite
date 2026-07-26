// Global notification surface: any component can call useToast().showToast(...) to
// pop a daisyUI alert into the top-center toast stack, instead of each panel
// rendering its own inline <p className="error">.

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastKind = "error" | "success" | "info" | "warning";

interface ToastEntry {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastValue | null>(null);

const DISMISS_MS = 5000;

// Written out as full literal strings (not `alert-${kind}`) so Tailwind's JIT
// scanner can actually find and generate these classes.
// `warning` intentionally reuses alert-error's red styling instead of daisyUI's
// default amber — warnings here (e.g. device disconnected) should read as red.
const ALERT_CLASS: Record<ToastKind, string> = {
  error: "alert alert-error",
  success: "alert alert-success",
  info: "alert alert-info",
  warning: "alert alert-error",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "error") => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast toast-top toast-center top-4 z-50">
        {toasts.map((toast) => (
          <div key={toast.id} className={`${ALERT_CLASS[toast.kind]} w-80`}>
            <span className="min-w-0 break-words">{toast.message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle justify-self-end"
              aria-label="dismiss"
              onClick={() => dismiss(toast.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
