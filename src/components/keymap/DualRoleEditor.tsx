import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { useKeyDisplay } from "../../contexts/keyDisplay.tsx";
import {
  buildLayerTap,
  buildModCombo,
  buildModTap,
  dualRole,
  holdInfo,
  keyBehavior,
} from "../../protocol/keycodes.ts";
import { CapGlyph } from "./KeycapFace.tsx";
import { capIcon, sideBadgeIcon } from "./keycapIcons.ts";

const MOD_KEYS = ["ctrl", "shift", "alt", "gui"] as const;
type ModName = (typeof MOD_KEYS)[number];

type ModState = { ctrl: boolean; shift: boolean; alt: boolean; gui: boolean; side: "L" | "R" };
const NO_MODS: ModState = { ctrl: false, shift: false, alt: false, gui: false, side: "L" };
const noMods = (m: ModState) => !m.ctrl && !m.shift && !m.alt && !m.gui;

/** Label shown on a modifier's checkbox / used as the glyph fallback + aria-label. */
const MOD_LABEL: Record<ModName, string> = { ctrl: "Ctrl", shift: "Shift", alt: "Alt", gui: "GUI" };

/** Basic modifier qmk_id for each mod + side, used to draw the OS-styled glyph. */
const MOD_CAP: Record<ModName, { L: string; R: string }> = {
  ctrl: { L: "KC_LCTRL", R: "KC_RCTRL" },
  shift: { L: "KC_LSHIFT", R: "KC_RSHIFT" },
  alt: { L: "KC_LALT", R: "KC_RALT" },
  gui: { L: "KC_LGUI", R: "KC_RGUI" },
};

/** DaisyUI soft warning alert used for every editor hint. */
function Warning({ children }: { children: ReactNode }) {
  return (
    <div role="alert" className="alert alert-warning alert-soft mt-3 py-2 text-sm">
      <span>{children}</span>
    </div>
  );
}

/**
 * Shared modifier selection UI, identical in look/interaction between the
 * fire-together (dashed) and real-hold (solid) editors: a single L/R side row
 * over four modifier tiles. Each tile shows a small L/R indicator glyph left of
 * the (OS-styled) modifier glyph, with an enable checkbox below. The parent owns
 * the write/validation logic and passes disabled predicates; this component is
 * purely presentational.
 */
function ModifierPicker({
  mods,
  onToggle,
  onSide,
  toggleDisabled,
  sideDisabled,
}: {
  mods: ModState;
  onToggle: (m: ModName) => void;
  onSide: (s: "L" | "R") => void;
  toggleDisabled?: (m: ModName) => boolean;
  sideDisabled?: (s: "L" | "R") => boolean;
}) {
  const { t } = useI18n();
  const { keyDisplay } = useKeyDisplay();
  return (
    <div>
      {/* Shared L/R side — one row for all four tiles (the device carries a
          single side bit for all mods). Picking a side updates every tile's
          indicator at once. Defaults left. */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm opacity-70">{t("holdEditorSide")}</span>
        <div className="join">
          {(["L", "R"] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={sideDisabled?.(s)}
              onClick={() => onSide(s)}
              className={`btn join-item btn-sm ${mods.side === s ? "btn-primary btn-active" : ""}`}
            >
              {t(s === "L" ? "holdEditorSideLeft" : "holdEditorSideRight")}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {MOD_KEYS.map((m) => {
          const enabled = mods[m];
          const disabled = toggleDisabled?.(m) ?? false;
          const spec = capIcon(MOD_CAP[m][mods.side], keyDisplay);
          return (
            <label
              key={m}
              className={`flex w-24 flex-col items-center gap-3 rounded-xl border p-3 transition-colors ${
                enabled ? "border-primary/50 bg-primary/10" : "border-base-content/10 bg-base-200/60"
              } ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}
            >
              <span className="flex h-12 items-center justify-center gap-1 leading-none">
                {/* Smaller L/R indicator, left of the modifier glyph. */}
                <span className="text-lg opacity-60">
                  <CapGlyph spec={sideBadgeIcon(mods.side)} label={mods.side === "L" ? "Left" : "Right"} />
                </span>
                <span className="text-3xl">
                  {spec ? (
                    <CapGlyph spec={spec} label={MOD_LABEL[m]} />
                  ) : (
                    <span className="text-base font-semibold">{MOD_LABEL[m]}</span>
                  )}
                </span>
              </span>
              <input
                type="checkbox"
                className="checkbox checkbox-sm"
                aria-label={MOD_LABEL[m]}
                checked={enabled}
                disabled={disabled}
                onChange={() => onToggle(m)}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  /** The dual-role key whose hold band is being edited. */
  qmkId: string;
  /** Layer count on the device (bounds the Layer-Tap target selector). */
  layerCount: number;
  /** Writes a fully-rebuilt qmk_id for the selected cap (write-through). */
  onWrite: (qmkId: string) => void;
}

/**
 * Inline editor for the second role of a dual-role cap, shown below the board
 * (in place of the quick-config grid) whenever a cap's lower band is selected.
 * It renders one of two layouts keyed off the band's shape (see
 * {@link keyBehavior}):
 *
 * - **Fire-together (dashed band, `modCombo`)** — a shared {@link ModifierPicker}
 *   plus a "clear" card. Edits stay fire-together via {@link buildModCombo}
 *   (e.g. `C_S(kc)`), never converting to a real hold; combos with no canonical
 *   fire-together name are disabled per side.
 * - **Real hold (solid band, `modTap` / `layerTap`)** — a Layer card and a
 *   Modifiers card (the same {@link ModifierPicker}). A hold is either a layer
 *   or mods, so whichever mode is active dims the other card. Mod combinations
 *   with no matching keycode are rejected with a hint.
 *
 * Unchecking the last modifier does not immediately blow the cap away — it shows
 * a hint and defers clearing (writing the collapsed tap) until this editor is
 * left, so an accidental last-uncheck can be undone by re-checking. The tap half
 * is always preserved; the "clear" card writes `KC_NO` immediately.
 */
export function DualRoleEditor({ qmkId, layerCount, onWrite }: Props) {
  const { t } = useI18n();
  const info = holdInfo(qmkId);
  const dual = dualRole(qmkId);
  const tap = dual?.tap ?? "KC_NO";
  const isCombo = keyBehavior(qmkId).kind === "modCombo";

  // Seed the modifier checkboxes/side from the current hold; a Layer-Tap has no
  // mods so it starts empty (side defaults left). Keyed by the selected cap in
  // the parent, so this re-seeds whenever a different cap is picked.
  const [mods, setMods] = useState<ModState>(
    info?.type === "mod"
      ? { ctrl: info.ctrl, shift: info.shift, alt: info.alt, gui: info.gui, side: info.side }
      : NO_MODS,
  );
  // True once the user has unchecked every modifier: the clear (→ plain tap) is
  // deferred to unmount so it isn't jarring / can be undone by re-checking.
  const [deferClear, setDeferClear] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  // Commit the deferred clear on unmount, targeting the cap this editor was
  // bound to: onWrite is keyed to the selected cap in the parent, and an
  // unmounting instance keeps its last-rendered onWrite, so this writes to the
  // right key even after the selection has moved on.
  const commit = useRef({ onWrite, tap, defer: deferClear });
  commit.current = { onWrite, tap, defer: deferClear };
  useEffect(
    () => () => {
      if (commit.current.defer) commit.current.onWrite(commit.current.tap);
    },
    [],
  );

  if (!dual) return null;

  const clearCard = (
    <button
      type="button"
      onClick={() => {
        setDeferClear(false);
        onWrite("KC_NO");
      }}
      aria-label={t("holdClearKey")}
      className="flex w-24 flex-col items-center justify-center rounded-xl border border-base-content/10 bg-base-200/60 text-base-content/40 transition-colors hover:border-error/40 hover:bg-error/10 hover:text-error"
    >
      <Icon icon="mdi:close" className="text-5xl" aria-hidden="true" />
    </button>
  );

  if (isCombo) {
    // A prospective mod set is only offered when its combo has a canonical
    // fire-together name; clearing all (→ deferred plain tap) is always allowed.
    const nameable = (next: ModState) => {
      const built = buildModCombo(next, tap);
      return built === tap || keyBehavior(built).kind === "modCombo";
    };
    const leftOk = nameable({ ...mods, side: "L" });
    const rightOk = nameable({ ...mods, side: "R" });
    const apply = (next: ModState) => {
      if (noMods(next)) {
        // Defer, don't collapse the cap yet — show the "pick at least one" hint.
        setHint(null);
        setMods(next);
        setDeferClear(true);
        return;
      }
      if (!nameable(next)) {
        // toggleDisabled only blocks *enabling* a mod into a non-nameable mask;
        // *unchecking* one can also land on a nameless combo (e.g. dropping Ctrl
        // from Hyper leaves Shift+Alt+GUI = 0xe00). Reject it rather than write a
        // raw code that no longer parses as dual-role and kicks us out of the editor.
        setHint(t("holdComboUnsupported"));
        return;
      }
      setHint(null);
      setDeferClear(false);
      setMods(next);
      onWrite(buildModCombo(next, tap));
    };

    return (
      <section className="mt-6">
        <h2 className="mb-4 text-lg font-semibold text-brand-on-surface">{t("holdComboTitle")}</h2>
        <div className="flex flex-wrap items-start gap-3">
          <ModifierPicker
            mods={mods}
            onToggle={(m) => apply({ ...mods, [m]: !mods[m] })}
            onSide={(s) => apply({ ...mods, side: s })}
            toggleDisabled={(m) => !mods[m] && !nameable({ ...mods, [m]: true })}
            sideDisabled={(s) => (s === "L" ? !leftOk : !rightOk)}
          />
          {clearCard}
        </div>
        {deferClear && <Warning>{t("holdSelectAtLeastOne")}</Warning>}
        {!deferClear && hint && <Warning>{hint}</Warning>}
        {!deferClear && !hint && (!leftOk || !rightOk) && <Warning>{t("holdComboUnsupported")}</Warning>}
      </section>
    );
  }

  // Real hold (solid band): Layer card + Modifiers card + clear card. A hold is
  // either a layer or a modifier set, so the inactive mode's card is dimmed.
  const layerActive = info?.type === "layer";
  const modActive = info?.type === "mod";
  const activeLayer = layerActive ? info.layer : null;

  const writeLayer = (n: number) => {
    setDeferClear(false);
    setHint(null);
    onWrite(buildLayerTap(n, tap));
  };
  // Reject masks with no canonical Mod-Tap name (e.g. Ctrl+Shift+GUI) — they
  // would serialize to a raw code no longer parseable as dual-role.
  const modTapOk = (next: ModState) => {
    const built = buildModTap(next, tap);
    return built === tap || keyBehavior(built).kind === "modTap";
  };
  const applyMods = (next: ModState) => {
    if (noMods(next)) {
      // No mods and no side to write — defer the collapse like the combo view,
      // unless there were no mods to begin with (a fresh Layer-Tap): then a side
      // click is just a preference with nothing to commit.
      setMods(next);
      setDeferClear(modActive);
      return;
    }
    if (!modTapOk(next)) {
      setHint(t("holdModUnsupported"));
      return;
    }
    setHint(null);
    setDeferClear(false);
    setMods(next);
    onWrite(buildModTap(next, tap));
  };

  return (
    <section className="mt-6">
      <h2 className="mb-4 text-lg font-semibold text-brand-on-surface">{t("holdEditorTitle")}</h2>
      <div className="flex flex-wrap items-start gap-3">
        {/* Layer card — dimmed while the cap holds modifiers. */}
        <div
          className={`flex w-72 flex-col gap-2 rounded-xl border border-base-content/10 bg-base-200/60 p-3 transition-opacity ${
            modActive ? "opacity-50" : ""
          }`}
        >
          <div className="flex items-center gap-1.5 text-sm font-semibold opacity-70">
            <Icon icon="mdi:layers-outline" aria-hidden="true" />
            {t("holdEditorLayer")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: Math.max(layerCount, 1) }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => writeLayer(i)}
                className={`btn btn-sm w-10 ${activeLayer === i ? "btn-primary btn-active" : "btn-outline"}`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        {/* Modifiers card — dimmed while the cap holds a layer. */}
        <div
          className={`rounded-xl border border-base-content/10 bg-base-200/60 p-3 transition-opacity ${
            layerActive ? "opacity-50" : ""
          }`}
        >
          <div className="mb-2 text-sm font-semibold opacity-70">{t("holdEditorModifiers")}</div>
          <ModifierPicker
            mods={mods}
            onToggle={(m) => applyMods({ ...mods, [m]: !mods[m] })}
            onSide={(s) => applyMods({ ...mods, side: s })}
          />
        </div>

        {clearCard}
      </div>
      {deferClear && <Warning>{t("holdSelectAtLeastOne")}</Warning>}
      {hint && <Warning>{hint}</Warning>}
    </section>
  );
}
