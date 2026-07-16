import { useState } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import {
  buildLayerTap,
  buildModTap,
  dualRole,
  holdInfo,
  label as kcLabel,
} from "../../protocol/keycodes.ts";

const MOD_KEYS = ["ctrl", "shift", "alt", "gui"] as const;

type ModState = { ctrl: boolean; shift: boolean; alt: boolean; gui: boolean; side: "L" | "R" };
/** Seed when switching *into* modifier mode from a layer hold: a lone left Ctrl. */
const DEFAULT_MODS: ModState = { ctrl: true, shift: false, alt: false, gui: false, side: "L" };

interface Props {
  /** The dual-role key whose hold band is being edited. */
  qmkId: string;
  /** Layer count on the device (bounds the Layer-Tap target selector). */
  layerCount: number;
  /** Writes a fully-rebuilt qmk_id for the selected cap (write-through). */
  onWrite: (qmkId: string) => void;
}

/**
 * Inline editor for the *hold* action of a dual-role tap/hold cap, shown below
 * the board (in place of the quick-config grid) whenever a cap's hold band is
 * selected. A hold is never a free keycode — it's only ever a modifier set
 * (Mod-Tap) or a layer (Layer-Tap) — so this offers exactly three modes instead
 * of the general picker: 无 (removes the hold, cap reverts to its plain tap),
 * 层 (Layer-Tap target), and 修饰键 (Ctrl/Shift/Alt/GUI checkboxes + a left/right
 * toggle; one box ticked is a single-mod hold, several is a combined-mod hold).
 * Every change writes through immediately, matching the rest of the keymap page.
 * The tap half is always preserved (see {@link buildModTap}/{@link buildLayerTap}).
 */
export function DualRoleEditor({ qmkId, layerCount, onWrite }: Props) {
  const { t } = useI18n();
  const info = holdInfo(qmkId);
  const tap = dualRole(qmkId)?.tap ?? "KC_NO";
  const tapLabel = kcLabel(tap).split("\n").join(" ");

  // Local edit state seeded from the current hold. The parent keys this
  // component by the selected key, so it re-seeds when a different cap is picked;
  // within one cap the state is kept so toggling 层 ⇄ 修饰键 doesn't lose the
  // other mode's last value.
  const [mods, setMods] = useState<ModState>(
    info?.type === "mod"
      ? { ctrl: info.ctrl, shift: info.shift, alt: info.alt, gui: info.gui, side: info.side }
      : DEFAULT_MODS,
  );
  const [layerN, setLayerN] = useState(info?.type === "layer" ? info.layer : 0);

  const mode: "layer" | "mod" = info?.type === "layer" ? "layer" : "mod";
  const noMods = !mods.ctrl && !mods.shift && !mods.alt && !mods.gui;

  const writeMods = (next: ModState) => {
    setMods(next);
    onWrite(buildModTap(next, tap));
  };
  const writeLayer = (n: number) => {
    setLayerN(n);
    onWrite(buildLayerTap(n, tap));
  };

  const tabClass = (active: boolean) =>
    "btn join-item btn-sm" + (active ? " btn-primary btn-active" : "");

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-lg font-semibold text-brand-on-surface">{t("holdEditorTitle")}</h2>
      </div>
      <p className="mb-4 text-sm opacity-70">{t("holdEditorTapKeeps", { key: tapLabel })}</p>

      {/* 类型: 无 / 层 / 修饰键 */}
      <div className="join mb-4">
        {/* 无 removes the hold; the parent then drops the hold selection so this
            editor unmounts, which is why it never shows as the active tab. */}
        <button className={tabClass(false)} onClick={() => onWrite(tap)}>
          {t("holdEditorModeNone")}
        </button>
        <button className={tabClass(mode === "layer")} onClick={() => writeLayer(layerN)}>
          {t("holdEditorLayer")}
        </button>
        <button
          className={tabClass(mode === "mod")}
          onClick={() => writeMods(noMods ? DEFAULT_MODS : mods)}
        >
          {t("holdEditorModifiers")}
        </button>
      </div>

      {mode === "layer" ? (
        <label className="block max-w-xs">
          <span className="mb-1 block text-sm">{t("holdEditorLayer")}</span>
          <select
            className="select select-bordered select-sm w-full"
            value={layerN}
            onChange={(e) => writeLayer(Number(e.target.value))}
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
          <div className="mb-3">
            <div className="mb-1 text-sm">{t("holdEditorModifiers")}</div>
            <div className="flex flex-wrap gap-3">
              {MOD_KEYS.map((m) => (
                <label key={m} className="flex cursor-pointer items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={mods[m]}
                    onChange={(e) => writeMods({ ...mods, [m]: e.target.checked })}
                  />
                  <span className="text-sm">
                    {m === "gui" ? "GUI" : m.charAt(0).toUpperCase() + m.slice(1)}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-sm">{t("holdEditorSide")}</div>
            <div className="join">
              <button
                className={"btn join-item btn-sm" + (mods.side === "L" ? " btn-primary btn-active" : "")}
                onClick={() => writeMods({ ...mods, side: "L" })}
              >
                {t("holdEditorSideLeft")}
              </button>
              <button
                className={"btn join-item btn-sm" + (mods.side === "R" ? " btn-primary btn-active" : "")}
                onClick={() => writeMods({ ...mods, side: "R" })}
              >
                {t("holdEditorSideRight")}
              </button>
            </div>
          </div>
          {noMods && <p className="text-warning mt-3 text-xs">{t("holdEditorNoModsHint")}</p>}
        </>
      )}
    </section>
  );
}
