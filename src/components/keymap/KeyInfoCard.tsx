import { type CSSProperties } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { deserialize, keyBehavior, label as kcLabel } from "../../protocol/keycodes.ts";

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

/** A row that pairs a role chip with an already-resolved label. */
function RoleLine({ role, text }: { role: string; text: string }) {
  return (
    <div className="key-info-line">
      <span className="key-info-role">{role}</span>
      <span className="key-info-name">{text}</span>
    </div>
  );
}

/**
 * Floating card describing the key currently hovered on the interactive board.
 * The raw keycode (qmk_id · 0xHEX) is pinned at the very top, divider-separated
 * from the body below. The body is driven by the keycode's {@link keyBehavior},
 * so each shape reads accurately instead of everything being forced into a
 * tap/hold split:
 *   - Mod-Tap → 点击 key row + 长按 modifier row (a real tap/hold).
 *   - Layer-Tap → 点击 key row + 长按 "switch to layer N" row (a real tap/hold).
 *   - Masked modifier → a single "同时" row (modifier + key fire together — this
 *     is deliberately NOT labelled 长按).
 *   - Plain key → just its name.
 * Positioned by the caller via {@link style} (fixed, anchored above the cap).
 */
export function KeyInfoCard({ qmkId, style }: { qmkId: string; style: CSSProperties }) {
  const { t } = useI18n();
  const behavior = keyBehavior(qmkId);
  const hex = hexCode(qmkId);

  return (
    <div className="key-info-card" style={style} role="tooltip">
      {/* 键码固定显示在最上面,与下方内容以分隔线 + gap 隔开 */}
      <div className="key-info-code key-info-code-top">
        {qmkId}
        {hex && <span className="key-info-hex"> · {hex}</span>}
      </div>
      <div className="key-info-body">
        <div className="key-info-title">{fullName(qmkId)}</div>
        {behavior.kind === "modTap" && (
          <>
            <RoleLine role={t("keyInfoTap")} text={fullName(behavior.inner)} />
            <RoleLine role={t("keyInfoHold")} text={behavior.role} />
            <div className="key-info-hint">{t("keyInfoModTapHint")}</div>
          </>
        )}
        {behavior.kind === "layerTap" && (
          <>
            <RoleLine role={t("keyInfoTap")} text={fullName(behavior.inner)} />
            <RoleLine
              role={t("keyInfoHold")}
              text={t("keyInfoLayerAction", { layer: behavior.layer })}
            />
            <div className="key-info-hint">{t("keyInfoLayerTapHint")}</div>
          </>
        )}
        {behavior.kind === "modCombo" && (
          <>
            <RoleLine role={t("keyInfoCombo")} text={`${behavior.role} + ${fullName(behavior.inner)}`} />
            <div className="key-info-hint">{t("keyInfoComboHint")}</div>
          </>
        )}
      </div>
    </div>
  );
}
