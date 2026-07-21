import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/KeycapFace.tsx";
import { buildModCombo, dualRole, holdInfo, keyBehavior, type KeycodeDef } from "../../protocol/keycodes.ts";
import { BASIC_MOD_IDS } from "../keymap/keycodeMeta.ts";
import { KeySlot } from "./KeySlot.tsx";

export type ModName = "ctrl" | "shift" | "alt" | "gui";
export interface ModState {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  gui: boolean;
  side: "L" | "R";
}
export const NO_MODS: ModState = { ctrl: false, shift: false, alt: false, gui: false, side: "L" };
const MOD_ABBR: { m: ModName; title: string }[] = [
  { m: "ctrl", title: "Ctrl" },
  { m: "shift", title: "Shift" },
  { m: "alt", title: "Alt" },
  { m: "gui", title: "GUI" },
];

/**
 * True unless `qmkId` is a masked/dual-role keycode left with no inner key (e.g. `LCTL(KC_NO)`,
 * fresh off picking a modifier template but never given a regular key) — the one shape
 * {@link ModifierFieldSlot} can produce that doesn't actually do anything on the device. Shared
 * by every card-editor field built on this slot (combo trigger/output keys, tap dance actions).
 */
export const fieldKeyValid = (qmkId: string): boolean => {
  const b = keyBehavior(qmkId);
  return b.kind === "plain" || b.inner !== "KC_NO";
};

/** A {@link ModifierFieldSlot}'s "regular key" field excludes bare modifiers (added instead
 *  through the dedicated modifier picker below) and masked Quantum templates (Mod-Tap /
 *  Layer-Tap / held-mods — none compose sensibly as the inner key of another modifier combo,
 *  and the slot only ever builds a fire-together mask, never a real hold). */
export const regularKeyFilter = (e: KeycodeDef) => !e.masked && !BASIC_MOD_IDS.has(e.qmkId);

/**
 * Multi-select popover for a field's modifier mask: a scoped-down cascade selector — a single
 * flat list of checkable rows instead of the full picker's category drill-down — that stays open
 * across several toggles so more than one modifier can be added in one sitting. Portalled to
 * `<body>` and positioned under its trigger, like {@link ../keymap/KeycodeCascadeSelector}'s own
 * popover, since the card clips overflow. A combination with no canonical fire-together name is
 * disabled rather than silently written as a raw code that no longer parses as a modifier combo.
 */
function ModifierMenu({
  mods,
  nameable,
  onToggle,
  onSide,
  onClose,
  anchor,
}: {
  mods: ModState;
  nameable: (next: ModState) => boolean;
  onToggle: (m: ModName) => void;
  onSide: (s: "L" | "R") => void;
  onClose: () => void;
  anchor: { x: number; y: number };
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 w-36 rounded-box bg-base-100 p-1 text-base-content shadow-lg ring-1 ring-base-content/10"
      style={{ left: anchor.x, top: anchor.y }}
    >
      <div className="join mb-1 flex w-full">
        {(["L", "R"] as const).map((s) => (
          <button
            key={s}
            type="button"
            className={`btn join-item btn-xs flex-1 ${
              mods.side === s ? "btn-primary btn-active" : "btn-outline"
            }`}
            onClick={() => onSide(s)}
          >
            {s === "L" ? t("holdEditorSideLeft") : t("holdEditorSideRight")}
          </button>
        ))}
      </div>
      <ul className="menu menu-xs w-full gap-0.5 p-0">
        {MOD_ABBR.map(({ m, title }) => {
          const active = mods[m];
          const disabled = !active && !nameable({ ...mods, [m]: true });
          return (
            <li key={m}>
              <button
                type="button"
                title={disabled ? t("fieldModUnsupported") : undefined}
                disabled={disabled}
                className="flex items-center justify-between"
                onClick={() => onToggle(m)}
              >
                <span>{title}</span>
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs"
                  checked={active}
                  disabled={disabled}
                  readOnly
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}

/** Same-line modifier+base-key summary for a confirmed field: the editor's own modifier
 *  abbreviations (as non-removable chips) followed by the inner key's face, instead of
 *  `KeycapFace`'s stacked dual-role rendering (tap on top, hold band below) — that reads as a
 *  physical keycap, not a flat "Ctrl Shift A" line. Falls back to a bare `KeycapFace` when the
 *  value carries no modifier mask. */
export function InlineModifierFace({ qmkId }: { qmkId: string }) {
  const info = holdInfo(qmkId);
  if (info?.type !== "mod") {
    return <KeycapFace qmkId={qmkId} className="whitespace-nowrap" />;
  }
  const inner = dualRole(qmkId)?.tap ?? qmkId;
  const active = MOD_ABBR.filter(({ m }) => info[m]);
  return (
    <span className="inline-flex flex-nowrap items-center gap-0.5">
      {active.map(({ m, title }, i) => (
        <span key={m} className="inline-flex items-center gap-0.5">
          {i > 0 && <Icon icon="mdi:plus" className="h-2.5 w-2.5 shrink-0 opacity-40" />}
          <span className="badge badge-outline badge-sm shrink-0">{title}</span>
        </span>
      ))}
      <Icon icon="mdi:plus" className="h-2.5 w-2.5 shrink-0 opacity-40" />
      <KeycapFace qmkId={inner} className="whitespace-nowrap" />
    </span>
  );
}

/** Small confirm ("check") button appended after the base-key button while a field is being
 *  configured — what turns "配置中" into "已配置" for that one field. */
export function FieldConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm min-h-9 shrink-0 px-2"
      title={t("fieldConfirm")}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon icon="mdi:check" className="h-4 w-4" />
    </button>
  );
}

/** A confirmed field: the same-line modifier+base-key summary ({@link InlineModifierFace}) plus
 *  trailing modify/delete buttons, replacing the picker once its value is confirmed. */
export function ConfiguredFieldRow({
  qmkId,
  onEdit,
  onDelete,
}: {
  qmkId: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className="group/field relative flex min-h-9 items-center rounded-btn bg-base-100 px-3 py-1">
      <span className="text-sm font-semibold">
        <InlineModifierFace qmkId={qmkId} />
      </span>
      {/* Hover overlay: the whole field darkens and the edit/delete buttons fade in
          centered on top of it, instead of sitting off to the side at all times. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 rounded-btn bg-black/50 opacity-0 transition-opacity group-hover/field:pointer-events-auto group-hover/field:opacity-100 group-focus-within/field:pointer-events-auto group-focus-within/field:opacity-100">
        <button type="button" className="btn btn-ghost btn-xs px-1.5 text-white hover:bg-white/20 hover:text-white" title={t("edit")} onClick={onEdit}>
          <Icon icon="mdi:pencil" className="h-3.5 w-3.5" />
        </button>
        <button type="button" className="btn btn-ghost btn-xs px-1.5 text-white hover:bg-white/20 hover:text-white" title={t("delete")} onClick={onDelete}>
          <Icon icon="mdi:trash-can-outline" className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * Card-editor field, split into the two actions it exposes: "add modifier" opens
 * {@link ModifierMenu} to build a fire-together mask (Ctrl/Shift/Alt/GUI + L/R side, applied via
 * `buildModCombo`) shown as removable chips, and "add regular key" reuses the shared cascade
 * picker — restricted via {@link regularKeyFilter} so a bare modifier or another masked template
 * can't be picked as the regular key, that being the modifier button's job. Together they let a
 * field require e.g. "Ctrl+Shift+A" instead of only a single keycode. Used by both the combo
 * editor (trigger/output keys) and the tap dance editor (per-state action keys).
 */
export function ModifierFieldSlot({
  qmkId,
  onChange,
  className,
  trailing,
}: {
  qmkId: string;
  onChange: (id: string) => void;
  className?: string;
  /** Rendered to the right of the base-key button, in the same row — the field's
   *  confirm button, kept out of this component so the caller owns what "confirm"
   *  means for that field. */
  trailing?: React.ReactNode;
}) {
  const { t } = useI18n();
  const info = holdInfo(qmkId);
  // Side has no encoding in the keycode while no modifier is active yet (a
  // zero mask collapses to the plain tap regardless of side — see
  // buildModCombo), so it can't be read back from `qmkId` at that point. Track
  // it locally so a side pick made before the first modifier checkbox still
  // sticks once one is checked, instead of silently reverting to "L" every
  // render. Re-synced whenever `qmkId` changes to a value that *does* encode a
  // side, so external edits (loading a different entry) still win.
  const [localSide, setLocalSide] = useState<"L" | "R">(info?.type === "mod" ? info.side : "L");
  useEffect(() => {
    if (info?.type === "mod") setLocalSide(info.side);
    // Only `qmkId` should re-trigger this — `info` is derived from it each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qmkId]);
  const mods: ModState =
    info?.type === "mod"
      ? { ctrl: info.ctrl, shift: info.shift, alt: info.alt, gui: info.gui, side: info.side }
      : { ...NO_MODS, side: localSide };
  const inner = dualRole(qmkId)?.tap ?? qmkId;
  const hasMods = mods.ctrl || mods.shift || mods.alt || mods.gui;
  const rowRef = useRef<HTMLDivElement>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  const nameable = (next: ModState) => {
    const built = buildModCombo(next, inner);
    return built === inner || keyBehavior(built).kind === "modCombo";
  };
  const apply = (next: ModState) => {
    if (!nameable(next)) return;
    onChange(buildModCombo(next, inner));
  };
  const setSide = (s: "L" | "R") => {
    setLocalSide(s);
    apply({ ...mods, side: s });
  };
  const openMenu = () => {
    const r = rowRef.current?.getBoundingClientRect();
    setMenuAnchor(r ? { x: r.left, y: r.bottom + 4 } : { x: 0, y: 0 });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <KeySlot
            qmkId={inner}
            onChange={(id) => onChange(hasMods ? buildModCombo(mods, id) : id)}
            entryFilter={regularKeyFilter}
            emptyLabel={t("fieldAddRegularKey")}
            className={className ? `${className} w-full` : className}
          />
        </div>
        {trailing}
      </div>
      <div ref={rowRef} className="flex flex-wrap items-center gap-1">
        {MOD_ABBR.filter(({ m }) => mods[m]).map(({ m, title }) => (
          <span key={m} className="badge badge-primary badge-sm gap-1 pr-1">
            {title}
            <button
              type="button"
              className="opacity-70 hover:opacity-100"
              aria-label={`${t("fieldRemoveModifier")}: ${title}`}
              onClick={() => apply({ ...mods, [m]: false })}
            >
              <Icon icon="mdi:close" className="h-3 w-3" />
            </button>
          </span>
        ))}
        {/* Once at least one modifier is added, the tag collapses to a bare "+"
            (title carries the label) so it reads as "add another" rather than
            repeating the same full prompt next to the chips it already applies to. */}
        <button
          type="button"
          className="badge badge-outline badge-sm cursor-pointer gap-1"
          title={hasMods ? t("fieldAddModifier") : undefined}
          onClick={openMenu}
        >
          <Icon icon="mdi:plus" className="h-3 w-3" />
          {!hasMods && t("fieldAddModifier")}
        </button>
      </div>
      {menuAnchor && (
        <ModifierMenu
          mods={mods}
          nameable={nameable}
          onToggle={(m) => apply({ ...mods, [m]: !mods[m] })}
          onSide={setSide}
          onClose={() => setMenuAnchor(null)}
          anchor={menuAnchor}
        />
      )}
    </div>
  );
}
