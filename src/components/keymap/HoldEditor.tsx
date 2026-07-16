import { useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../contexts/i18n.tsx";
import {
  buildLayerTap,
  buildModTap,
  dualRole,
  holdInfo,
  label as kcLabel,
} from "../../protocol/keycodes.ts";

interface Props {
  /** The dual-role key currently being edited. */
  qmkId: string;
  /** Number of layers on the device (bounds the Layer-Tap target selector). */
  layerCount: number;
  /** Called with the rebuilt qmk_id when the user applies their changes. */
  onApply: (qmkId: string) => void;
  onClose: () => void;
}

const MOD_KEYS = ["ctrl", "shift", "alt", "gui"] as const;

/**
 * Dedicated editor for the *hold* action of a dual-role tap/hold cap. Because a
 * hold is never a free keycode — it's a modifier set (Mod-Tap) or a layer
 * (Layer-Tap) — this replaces the general keycode picker for that sub-part:
 * Mod-Tap keys get modifier checkboxes + a left/right side toggle, Layer-Tap
 * keys get a layer selector. The tap half is preserved; clearing every modifier
 * removes the hold role entirely (see {@link buildModTap}).
 */
export function HoldEditor({ qmkId, layerCount, onApply, onClose }: Props) {
  const { t } = useI18n();
  const info = holdInfo(qmkId);
  const tap = dualRole(qmkId)?.tap ?? "KC_NO";
  const tapLabel = kcLabel(tap).split("\n").join(" ");

  const isLayer = info?.type === "layer";
  const [mods, setMods] = useState(
    info?.type === "mod"
      ? { ctrl: info.ctrl, shift: info.shift, alt: info.alt, gui: info.gui, side: info.side }
      : { ctrl: false, shift: false, alt: false, gui: false, side: "L" as "L" | "R" },
  );
  const [layerN, setLayerN] = useState(info?.type === "layer" ? info.layer : 0);

  if (!info) {
    return null;
  }

  const noMods = !isLayer && !mods.ctrl && !mods.shift && !mods.alt && !mods.gui;

  const apply = () => onApply(isLayer ? buildLayerTap(layerN, tap) : buildModTap(mods, tap));

  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="text-lg font-semibold">{t("holdEditorTitle")}</h3>
        <p className="mt-1 text-sm opacity-70">{t("holdEditorTapKeeps", { key: tapLabel })}</p>

        {isLayer ? (
          <label className="mt-4 block">
            <span className="mb-1 block text-sm">{t("holdEditorLayer")}</span>
            <select
              className="select select-bordered select-sm w-full"
              value={layerN}
              onChange={(e) => setLayerN(Number(e.target.value))}
            >
              {Array.from({ length: Math.max(layerCount, 1) }, (_, i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <div className="mt-4">
              <div className="mb-1 text-sm">{t("holdEditorModifiers")}</div>
              <div className="flex flex-wrap gap-3">
                {MOD_KEYS.map((m) => (
                  <label key={m} className="flex cursor-pointer items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="checkbox checkbox-sm"
                      checked={mods[m]}
                      onChange={(e) => setMods((s) => ({ ...s, [m]: e.target.checked }))}
                    />
                    <span className="text-sm">{m === "gui" ? "GUI" : m.charAt(0).toUpperCase() + m.slice(1)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-3">
              <div className="mb-1 text-sm">{t("holdEditorSide")}</div>
              <div className="join">
                <button
                  className={"btn join-item btn-sm" + (mods.side === "L" ? " btn-primary btn-active" : "")}
                  onClick={() => setMods((s) => ({ ...s, side: "L" }))}
                >
                  {t("holdEditorSideLeft")}
                </button>
                <button
                  className={"btn join-item btn-sm" + (mods.side === "R" ? " btn-primary btn-active" : "")}
                  onClick={() => setMods((s) => ({ ...s, side: "R" }))}
                >
                  {t("holdEditorSideRight")}
                </button>
              </div>
            </div>
            {noMods && <p className="text-warning mt-3 text-xs">{t("holdEditorNoModsHint")}</p>}
          </>
        )}

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("cancel")}
          </button>
          <button className="btn btn-primary btn-sm" onClick={apply}>
            {t("holdEditorApply")}
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body,
  );
}
