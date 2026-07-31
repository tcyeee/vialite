import { type CSSProperties } from "react";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey, type Translate } from "../../../contexts/i18n.tsx";
import {
  deserialize,
  keyBehavior,
  label as kcLabel,
  layerSwitchInfo,
} from "../../../protocol/keycodes.ts";
import { CLEAR_LABELS, KEYCODE_HELP, LAYER_GROUPS } from "./keycodeMeta.ts";

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

/**
 * Per-function blurb for a pure layer switch, naming the actual target layer instead of "the
 * target layer" the way the cascade selector's group help has to. `PDF` has no cascade group
 * (it isn't offered in the picker) but can still arrive from an imported keymap, so it gets an
 * entry here too.
 */
const LAYER_FN_HINTS: Record<string, MessageKey> = {
  MO: "keyInfoLayerMOHint",
  TG: "keyInfoLayerTGHint",
  TT: "keyInfoLayerTTHint",
  OSL: "keyInfoLayerOSLHint",
  TO: "keyInfoLayerTOHint",
  DF: "keyInfoLayerDFHint",
  PDF: "keyInfoLayerPDFHint",
};

/**
 * "What this key actually does" copy for a single-action keycode, drawn from the same sources
 * the cascade selector's info panel uses so both describe a key identically: the clear keys'
 * own blurb, the shared per-keycode description registry, or — for a pure layer switch
 * (`MO(1)`, `TG(2)`, …) — {@link LAYER_FN_HINTS}, falling back to the help text of the group it
 * belongs to. Null when the keycode's name already says everything (`KC_A`).
 */
function plainDesc(t: Translate, qmkId: string): string | null {
  const clear = CLEAR_LABELS[qmkId];
  if (clear) return t(clear.title);
  const help = KEYCODE_HELP[qmkId];
  if (help) return t(help);
  const layer = layerSwitchInfo(qmkId);
  if (!layer) return null;
  const fnHint = LAYER_FN_HINTS[layer.fn];
  if (fnHint) return t(fnHint, { layer: layer.layer });
  const group = LAYER_GROUPS.find((g) => g.key === layer.fn);
  return group?.helpKey ? t(group.helpKey) : null;
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
 * The key's name is the card's headline in the top-left, with the raw keycode
 * (qmk_id · 0xHEX) riding its baseline at the top-right as a faint decorative
 * stamp. The body is driven by the keycode's {@link keyBehavior},
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
  const desc = plainDesc(t, qmkId);

  return (
    <div className="key-info-card" style={style} role="tooltip">
      {/* 标题行:按键图标 + 名称做左上角大标题,键码作为装饰性元素贴在同一行右上角
          (靠字号/弱化配色 + gap 与下方内容分层,不画分隔线) */}
      <div className="key-info-head">
        <div className="key-info-title">
          <Icon icon="mdi:keyboard-outline" className="key-info-title-icon" aria-hidden />
          <span>{fullName(qmkId)}</span>
        </div>
        <div className="key-info-code">
          {qmkId}
          {hex && <span className="key-info-hex"> · {hex}</span>}
        </div>
      </div>
      <div className="key-info-body">
        {behavior.kind === "modTap" && (
          <>
            <RoleLine role={t("keyInfoTap")} text={fullName(behavior.inner)} />
            <RoleLine role={t("keyInfoHold")} text={behavior.role} />
            <div className="key-info-hint">
              {t("keyInfoModTapHint", { key: fullName(behavior.inner), mod: behavior.role })}
            </div>
          </>
        )}
        {behavior.kind === "layerTap" && (
          <>
            <RoleLine role={t("keyInfoTap")} text={fullName(behavior.inner)} />
            <RoleLine
              role={t("keyInfoHold")}
              text={t("keyInfoLayerAction", { layer: behavior.layer })}
            />
            <div className="key-info-hint">
              {t("keyInfoLayerTapHint", { key: fullName(behavior.inner), layer: behavior.layer })}
            </div>
          </>
        )}
        {behavior.kind === "modCombo" && (
          <>
            <RoleLine role={t("keyInfoCombo")} text={`${behavior.role} + ${fullName(behavior.inner)}`} />
            <div className="key-info-hint">
              {t("keyInfoComboHint", { key: fullName(behavior.inner), mod: behavior.role })}
            </div>
          </>
        )}
        {behavior.kind === "plain" && desc && <div className="key-info-hint">{desc}</div>}
      </div>
    </div>
  );
}
