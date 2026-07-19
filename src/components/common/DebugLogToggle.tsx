import { useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { isDebugEnabled, setDebugEnabled } from "../../debug.ts";

/**
 * The debug-logging checkbox — the single source of truth for it lives in
 * `debug.ts` (a plain module backing a localStorage flag), so this control and
 * the copy on the 网站设置 (Website Settings) page flip the *same* switch:
 * turning it on here is exactly as if the user had opened settings and toggled
 * it there. Rendered both in `SiteSettingsPanel` and, when a connection problem
 * surfaces, on the WaitingForConnection screen so users can enable verbose logs
 * and retry without hunting for the settings page.
 *
 * The two mount points never coexist (settings is connected-only, the connect
 * screen is disconnected-only), so each can safely seed local state from
 * `isDebugEnabled()` on mount without needing a shared subscription.
 */
export function DebugLogToggle({ className = "toggle toggle-primary" }: { className?: string }) {
  const { t } = useI18n();
  const [debug, setDebug] = useState(isDebugEnabled);
  return (
    <input
      type="checkbox"
      className={className}
      checked={debug}
      onChange={(e) => {
        setDebug(e.target.checked);
        setDebugEnabled(e.target.checked);
      }}
      aria-label={t("debugLogTitle")}
    />
  );
}
