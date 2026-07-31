import { useEffect, useRef, useState, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import {
  buildModCombo,
  holdInfo,
  isBasicQmkId,
  keyBehavior,
  withTap,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { BASIC_MOD_IDS } from "../keymap/picker/keycodeMeta.ts";
import { QualifiedKeyLabel } from "../keymap/picker/QualifiedKeyLabel.tsx";
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

/** A {@link ModifierFieldSlot}'s key field excludes only bare modifiers, which are added
 *  through the dedicated modifier picker below instead.
 *
 *  Masked Quantum templates (Mod-Tap, Layer-Tap, held-mods) are deliberately *not* filtered
 *  out: dropping them hid roughly two thirds of the Quantum category from these fields. The
 *  slot handles each shape on its own terms — a held-mod template lands as an ordinary
 *  fire-together mask (the same thing the modifier chips build), and a real hold keeps its
 *  wrapper while the field edits the key inside it. See {@link ModifierFieldSlot}. */
export const regularKeyFilter = (e: KeycodeDef) => !BASIC_MOD_IDS.has(e.qmkId);

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

/**
 * The key box every state of a field wears: the editable slot's picker trigger, the confirmed
 * row, and the read-only display. Keeping one class string means a field never changes shape as
 * it moves between those states — only the affordances around it do.
 */
export const FIELD_KEY_BOX =
  "btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line btn-soft";

/**
 * The role-tag line under a field's key box (hold badge / modifier chips). Exactly one badge tall
 * and never wrapping — extra chips scroll sideways rather than adding a second line — so a field
 * is the same height with four modifiers as with one. Callers that reserve the line even when
 * there are no tags (`reserveRoleRow`, or an empty spacer of their own) get a field whose height
 * doesn't change as it moves between display, editing and empty.
 */
export const FIELD_ROLE_ROW =
  "flex h-5 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * How a field's value splits into "a base key" plus "a second role", the view both
 * {@link ModifierFieldSlot} and its read-only twin {@link FieldValueDisplay} are built on, so an
 * editable field and a displayed one always read the same keycode the same way.
 *
 * - `hold` — a real hold (Mod-Tap / Layer-Tap): the wrapper around `inner`, shown as its own tag.
 * - `mods` — a fire-together modifier mask, or null when the value carries none.
 * - `inner` — the base key the two roles above apply to (the value itself, when it has neither).
 */
function decompose(qmkId: string) {
  const behavior = keyBehavior(qmkId);
  const info = holdInfo(qmkId);
  const hold = behavior.kind === "modTap" || behavior.kind === "layerTap" ? behavior : null;
  const masked = behavior.kind === "modCombo" && info?.type === "mod";
  return {
    hold,
    mods: masked && info?.type === "mod"
      ? { ctrl: info.ctrl, shift: info.shift, alt: info.alt, gui: info.gui, side: info.side }
      : null,
    inner: behavior.kind === "plain" ? qmkId : behavior.inner,
  };
}

/**
 * One tag on a field's role row, under its key button: either the whole second role of a real
 * hold (`hold`, in its own accent so a genuine long-press never reads as a fire-together
 * modifier) or a single modifier of a fire-together mask (`mod`). `onRemove` adds the ✕ that
 * strips it — omitted for read-only renderings, which are otherwise identical.
 */
function RoleTag({
  kind,
  label,
  onRemove,
  removeLabel,
}: {
  kind: "hold" | "mod";
  label: string;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span
      className={`badge badge-sm shrink-0 gap-1 ${onRemove ? "pr-1" : ""} ${
        kind === "hold" ? "badge-secondary" : "badge-primary"
      }`}
    >
      {kind === "hold" && <Icon icon="mdi:gesture-tap-hold" className="h-3 w-3" />}
      {label}
      {onRemove && (
        <button type="button" className="opacity-70 hover:opacity-100" aria-label={removeLabel} onClick={onRemove}>
          <Icon icon="mdi:close" className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/**
 * Read-only twin of {@link ModifierFieldSlot}: the same "category / key" button over the same
 * role tags, with every editing affordance dropped. Used wherever a field's value is shown
 * rather than edited (the combo table's display rows), so a row keeps its shape when it flips
 * between the two states instead of swapping in a differently-styled summary.
 *
 * `className` styles the key box and should match the one given to the editable slot; any other
 * props land on it too, which is how a caller attaches its hover-card handlers.
 */
export function FieldValueDisplay({
  qmkId,
  className = FIELD_KEY_BOX,
  reserveRoleRow = false,
  ...boxProps
}: {
  qmkId: string;
  className?: string;
  /** Keep the {@link FIELD_ROLE_ROW} line's height even when this value carries no hold and no
   *  modifiers — for callers (the combo table) that need every field the same height whether or
   *  not it happens to have tags. */
  reserveRoleRow?: boolean;
} & HTMLAttributes<HTMLDivElement>) {
  const { hold, mods, inner } = decompose(qmkId);
  const modTags = mods ? MOD_ABBR.filter(({ m }) => mods[m]) : [];
  const hasTags = !!hold || modTags.length > 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className={className} {...boxProps}>
        <QualifiedKeyLabel qmkId={inner} />
      </div>
      {(hasTags || reserveRoleRow) && (
        <div className={FIELD_ROLE_ROW} aria-hidden={hasTags ? undefined : true}>
          {hold ? (
            <RoleTag kind="hold" label={hold.role} />
          ) : (
            modTags.map(({ m, title }) => <RoleTag key={m} kind="mod" label={title} />)
          )}
        </div>
      )}
    </div>
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

/**
 * A confirmed field: the read-only {@link FieldValueDisplay} — the very same key box and role
 * tags the picker leaves behind — with modify/delete revealed on hover, replacing the picker
 * once the value is confirmed. Sharing the display component is what keeps confirming a field
 * from visibly changing it.
 */
export function ConfiguredFieldRow({
  qmkId,
  onEdit,
  onDelete,
  reserveRoleRow = false,
  hoverProps,
}: {
  qmkId: string;
  onEdit: () => void;
  onDelete: () => void;
  /** See {@link FieldValueDisplay}'s prop of the same name. */
  reserveRoleRow?: boolean;
  /**
   * Hover-card wiring for the field, for a caller whose fields are permanently editable (the
   * combo table) rather than having a read-only twin to hang it on.
   *
   * It lands on the wrapper, *not* on the key box: the overlay below takes pointer events the
   * moment the field is hovered, so handlers on the box would see a `mouseleave` as soon as the
   * buttons appeared and the card would never survive its own open delay. The wrapper contains
   * both, and enter/leave don't fire when moving between an element's own descendants.
   */
  hoverProps?: HTMLAttributes<HTMLDivElement>;
}) {
  const { t } = useI18n();
  return (
    <div className="group/field relative" {...hoverProps}>
      <FieldValueDisplay qmkId={qmkId} reserveRoleRow={reserveRoleRow} />
      {/* Hover overlay: the whole field darkens and the edit/delete buttons fade in
          centered on top of it, instead of sitting off to the side at all times. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 rounded-field bg-black/50 opacity-0 transition-opacity group-hover/field:pointer-events-auto group-hover/field:opacity-100 group-focus-within/field:pointer-events-auto group-focus-within/field:opacity-100">
        <button type="button" className={FIELD_OVERLAY_BTN} title={t("edit")} onClick={onEdit}>
          <Icon icon="mdi:pencil" className="h-7 w-7" />
        </button>
        <button type="button" className={FIELD_OVERLAY_BTN} title={t("delete")} onClick={onDelete}>
          <Icon icon="mdi:trash-can-outline" className="h-7 w-7" />
        </button>
      </div>
    </div>
  );
}

/** The overlay's edit/delete buttons, at 2× their original 14px-icon size — big enough to be the
 *  obvious target once a field is darkened, while still fitting inside the key box's own height
 *  so a field with no role-tag line doesn't have them spilling past it. `min-h-0` because
 *  daisyUI's `.btn` otherwise floors the height at its own size scale and `h-9` never takes. */
const FIELD_OVERLAY_BTN =
  "btn btn-ghost h-9 min-h-0 w-9 p-0 text-white hover:bg-white/20 hover:text-white";

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
  className = FIELD_KEY_BOX,
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
  /**
   * `hold` is a real hold (Mod-Tap `LCTL_T(KC_A)` / Layer-Tap `LT2(KC_A)`) picked straight from
   * the Quantum category. Its wrapper can't be expressed by this field's fire-together mask, so
   * while one is present the modifier chips give way to a read-only role tag and the key button
   * edits the key *inside* the wrapper (via {@link withTap}) rather than replacing it — without
   * that, picking an inner key would silently drop the hold.
   */
  const { hold, mods: maskedMods, inner } = decompose(qmkId);
  // Side has no encoding in the keycode while no modifier is active yet (a
  // zero mask collapses to the plain tap regardless of side — see
  // buildModCombo), so it can't be read back from `qmkId` at that point. Track
  // it locally so a side pick made before the first modifier checkbox still
  // sticks once one is checked, instead of silently reverting to "L" every
  // render. Re-synced whenever `qmkId` changes to a value that *does* encode a
  // side, so external edits (loading a different entry) still win.
  const [localSide, setLocalSide] = useState<"L" | "R">(maskedMods?.side ?? "L");
  useEffect(() => {
    const next = decompose(qmkId).mods;
    if (next) setLocalSide(next.side);
  }, [qmkId]);
  const mods: ModState = maskedMods ?? { ...NO_MODS, side: localSide };
  const hasMods = mods.ctrl || mods.shift || mods.alt || mods.gui;

  /** Apply a key picked from the catalogue, preserving whatever wrapper the field is holding.
   *  Keycodes wider than 8 bits (macros, tap dance, layer switches) can't nest inside a mask or
   *  a hold, so those replace the whole value instead of being folded into one. */
  const pickKey = (id: string) => {
    if (id === "KC_NO" || !isBasicQmkId(id)) return onChange(id);
    if (hold) return onChange(withTap(qmkId, id));
    return onChange(hasMods ? buildModCombo(mods, id) : id);
  };
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
            onChange={pickKey}
            entryFilter={regularKeyFilter}
            emptyLabel={t("fieldAddRegularKey")}
            className={className}
          />
        </div>
        {trailing}
      </div>
      <div ref={rowRef} className={FIELD_ROLE_ROW}>
        {/* A real hold owns the whole second role, so it replaces the chip row rather than
            sitting alongside it — removing the badge unwraps the key back to its inner half. */}
        {hold ? (
          <RoleTag
            kind="hold"
            label={hold.role}
            onRemove={() => onChange(hold.inner)}
            removeLabel={`${t("fieldRemoveHold")}: ${hold.role}`}
          />
        ) : (
          <>
            {MOD_ABBR.filter(({ m }) => mods[m]).map(({ m, title }) => (
              <RoleTag
                key={m}
                kind="mod"
                label={title}
                onRemove={() => apply({ ...mods, [m]: false })}
                removeLabel={`${t("fieldRemoveModifier")}: ${title}`}
              />
            ))}
            {/* Once at least one modifier is added, the tag collapses to a bare "+"
                (title carries the label) so it reads as "add another" rather than
                repeating the same full prompt next to the chips it already applies to. */}
            <button
              type="button"
              className="badge badge-outline badge-sm shrink-0 cursor-pointer gap-1"
              title={hasMods ? t("fieldAddModifier") : undefined}
              onClick={openMenu}
            >
              <Icon icon="mdi:plus" className="h-3 w-3" />
              {!hasMods && t("fieldAddModifier")}
            </button>
          </>
        )}
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
