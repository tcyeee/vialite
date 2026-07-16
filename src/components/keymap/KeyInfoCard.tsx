import { type CSSProperties } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { deserialize, dualRole, label as kcLabel } from "../../protocol/keycodes.ts";

/** Full (single-line) human label for a qmk_id — the on-cap labels embed `\n`. */
function fullName(qmkId: string): string {
  return kcLabel(qmkId).split("\n").join(" ");
}

/** `0x…` hex form of a qmk_id's integer keycode, or null if it can't be parsed. */
function hexCode(qmkId: string): string | null {
  try {
    return "0x" + deserialize(qmkId).toString(16).toUpperCase().padStart(4, "0");
  } catch {
    return null;
  }
}

/** One "name — CODE (0xHEX)" line describing a single keycode. */
function CodeLine({ label, qmkId }: { label?: string; qmkId: string }) {
  const hex = hexCode(qmkId);
  return (
    <div className="key-info-line">
      {label && <span className="key-info-role">{label}</span>}
      <span className="key-info-name">{fullName(qmkId)}</span>
      <span className="key-info-code">
        {qmkId}
        {hex && <span className="key-info-hex"> · {hex}</span>}
      </span>
    </div>
  );
}

/**
 * Floating card describing the key currently hovered on the interactive board:
 * its full name and keycode. Dual-role tap/hold keys ({@link dualRole}) break the
 * two roles onto separate 点击 / 长按 rows so each action's own name + code shows.
 * Positioned by the caller via {@link style} (fixed, anchored above the cap).
 */
export function KeyInfoCard({ qmkId, style }: { qmkId: string; style: CSSProperties }) {
  const { t } = useI18n();
  const dual = dualRole(qmkId);

  return (
    <div className="key-info-card" style={style} role="tooltip">
      <div className="key-info-title">{fullName(qmkId)}</div>
      <div className="key-info-body">
        {dual ? (
          <>
            <CodeLine label={t("keyInfoTap")} qmkId={dual.tap} />
            <div className="key-info-line">
              <span className="key-info-role">{t("keyInfoHold")}</span>
              <span className="key-info-name">{dual.hold}</span>
            </div>
          </>
        ) : (
          <CodeLine qmkId={qmkId} />
        )}
      </div>
    </div>
  );
}
