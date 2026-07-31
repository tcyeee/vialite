import { useCallback } from "react";
import { useI18n, type MessageKey } from "../contexts/i18n.tsx";
import { useToast } from "../contexts/toast.tsx";
import { isLinkFatal } from "../protocol/transport.ts";

/**
 * The one way a panel reports a failed write to the device.
 *
 * Panels used to each catch their own writes and toast `err.message` — untranslated, worded
 * differently in every panel, and (worse) shown even when the real problem was that the
 * keyboard had stopped answering altogether, where a toast is both useless and misleading.
 *
 * Splitting that in two: a link failure is swallowed here, because
 * `Transport.onFatal` has already started walking the app back to the connect screen and will
 * explain it there — a toast riding along on top of that transition is noise. Anything else is
 * a genuine per-write error and gets a translated message.
 *
 * @param messageKey the panel's own "…写入失败:{error}" string; defaults to the generic one.
 */
export function useWriteError(messageKey: MessageKey = "writeFailed") {
  const { t } = useI18n();
  const { showToast } = useToast();

  return useCallback(
    (err: unknown) => {
      if (isLinkFatal(err)) {
        return;
      }
      console.error("[vialite] write failed:", err);
      showToast(t(messageKey, { error: err instanceof Error ? err.message : String(err) }));
    },
    [t, showToast, messageKey],
  );
}
