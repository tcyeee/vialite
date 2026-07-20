import { useEffect, useRef, useState } from "react";
import { createPortal, flushSync } from "react-dom";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/KeycapFace.tsx";
import type { ComboEntry, Keyboard } from "../../protocol/keyboard.ts";
import { buildModCombo, dualRole, holdInfo, keyBehavior, type KeycodeDef } from "../../protocol/keycodes.ts";
import { BASIC_MOD_IDS } from "../keymap/keycodeMeta.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { KeySlot } from "../common/KeySlot.tsx";
import { RenumberPicker } from "../common/RenumberPicker.tsx";
import { ConfirmDialog } from "../common/ConfirmDialog.tsx";
import { startViewTransition } from "../common/viewTransition.ts";

type ModName = "ctrl" | "shift" | "alt" | "gui";
interface ModState {
  ctrl: boolean;
  shift: boolean;
  alt: boolean;
  gui: boolean;
  side: "L" | "R";
}
const NO_MODS: ModState = { ctrl: false, shift: false, alt: false, gui: false, side: "L" };
const MOD_ABBR: { m: ModName; title: string }[] = [
  { m: "ctrl", title: "Ctrl" },
  { m: "shift", title: "Shift" },
  { m: "alt", title: "Alt" },
  { m: "gui", title: "GUI" },
];

/** Shared keycap-box treatment for the front (display-state) card face — same border weight,
 *  radius, and minimum footprint for every key shown there (the 4 trigger keys and the output
 *  key), so the border reads as one consistent size regardless of each slot's font size or how
 *  long its label is. Stretches to fill whatever width its container gives it (a grid cell for
 *  the 4 keys, the remaining row width next to the arrow for the output key) rather than
 *  shrink-wrapping to the label. */
const CARD_KEY_BOX =
  "flex min-h-9 w-full items-center justify-center rounded-lg border border-[#434b5b]/25 px-2 dark:border-[#d7dfeb]/25";

/** True unless `qmkId` is a masked/dual-role keycode left with no inner key
 *  (e.g. `LCTL(KC_NO)`, fresh off picking a modifier template but never given
 *  a regular key) — the one shape the combo picker can produce that doesn't
 *  actually do anything on the device. */
const comboFieldValid = (qmkId: string): boolean => {
  const b = keyBehavior(qmkId);
  return b.kind === "plain" || b.inner !== "KC_NO";
};

/** The combo editor's "regular key" field excludes bare modifiers (added
 *  instead through the dedicated modifier picker below) and masked Quantum
 *  templates (Mod-Tap / Layer-Tap / held-mods — none compose sensibly as the
 *  inner key of another modifier combo). */
const regularKeyFilter = (e: KeycodeDef) => !e.masked && !BASIC_MOD_IDS.has(e.qmkId);

/**
 * Multi-select popover for a combo field's modifier mask: a scoped-down cascade
 * selector — a single flat list of checkable rows instead of the full picker's
 * category drill-down — that stays open across several toggles so more than one
 * modifier can be added in one sitting. Portalled to `<body>` and positioned
 * under its trigger, like {@link ../keymap/KeycodeCascadeSelector}'s own
 * popover, since the combo card clips overflow. A combination with no canonical
 * fire-together name is disabled rather than silently written as a raw code
 * that no longer parses as a modifier combo.
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
                title={disabled ? t("comboModUnsupported") : undefined}
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
 * Combo trigger/output field, split into the two actions the combo editor
 * exposes: "add modifier" opens {@link ModifierMenu} to build a fire-together
 * mask (Ctrl/Shift/Alt/GUI + L/R side, applied via {@link buildModCombo}) shown
 * as removable chips, and "add regular key" reuses the shared cascade picker —
 * restricted via {@link regularKeyFilter} so a bare modifier or another masked
 * template can't be picked as the regular key, that being the modifier
 * button's job. Together they let a combo slot require e.g. "Ctrl+Shift+A"
 * instead of only a single keycode.
 */
function ComboKeySlot({
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
  // side, so external edits (loading a different combo entry) still win.
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
            emptyLabel={t("comboAddRegularKey")}
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
              aria-label={`${t("comboRemoveModifier")}: ${title}`}
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
          title={hasMods ? t("comboAddModifier") : undefined}
          onClick={openMenu}
        >
          <Icon icon="mdi:plus" className="h-3 w-3" />
          {!hasMods && t("comboAddModifier")}
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

/** Same-line modifier+base-key summary for a confirmed combo field: the editor's own modifier
 *  abbreviations (as non-removable chips) followed by the inner key's face, instead of
 *  `KeycapFace`'s stacked dual-role rendering (tap on top, hold band below) — that reads as a
 *  physical keycap, not a flat "Ctrl Shift A" line. Falls back to a bare `KeycapFace` when the
 *  value carries no modifier mask. */
function InlineComboFace({ qmkId }: { qmkId: string }) {
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

/** Small confirm ("check") button appended after the base-key button while a combo field is
 *  being configured — what turns "配置中" into "已配置" for that one field. */
function ConfirmButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm min-h-9 shrink-0 px-2"
      title={t("comboConfirm")}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon icon="mdi:check" className="h-4 w-4" />
    </button>
  );
}

/** A confirmed combo field: the same-line modifier+base-key summary ({@link InlineComboFace})
 *  plus trailing modify/delete buttons, replacing the picker once its value is confirmed. */
function ConfiguredFieldRow({
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
        <InlineComboFace qmkId={qmkId} />
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

interface PreviewCardProps {
  index: number;
  entry: ComboEntry;
  /** Total number of combo slots on the device, for the renumber picker. */
  comboCount: number;
  /** Slot indices already occupied by another entry — greyed out in the renumber picker. */
  usedIndices: Set<number>;
  /** Present only for already-configured entries — enables the hover toolbar + flip-to-edit. */
  onSave?: (patch: Partial<ComboEntry>) => void;
  onDelete?: () => void;
  /** Moves this entry to a different (free) slot number, from the edit-face CB picker. */
  onMove?: (toIdx: number) => void;
  /** Whether this card is the single one currently flipped to its editor face (parent-owned). */
  editing?: boolean;
  /** Enter edit mode — the parent makes this the one editing card, un-flipping any other. */
  onEdit?: () => void;
  /** Leave edit mode (the "done" button); the parent also drops the slot if it's still unused. */
  onCloseEdit?: () => void;
  /** Discard edits (the "cancel" button) — restores the entry to its value from when editing began. */
  onCancel?: () => void;
}

/**
 * Summary of one combo entry. When `onSave`/`onDelete` are given, hovering reveals an
 * Edit/Delete toolbar; Edit flips the card (CSS 3D transform) to reveal an inline editor on
 * the back face, so editing happens in place instead of in a separate form.
 */
function ComboPreviewCard({
  index,
  entry,
  comboCount,
  usedIndices,
  onSave,
  onDelete,
  onMove,
  editing,
  onEdit,
  onCloseEdit,
  onCancel,
}: PreviewCardProps) {
  const { t } = useI18n();
  const flipped = !!editing;
  const editable = !!onSave;
  const cardBodyRef = useRef<HTMLDivElement>(null);

  /**
   * Each field on the edit face (the output key and every trigger key) is either "being
   * configured" (the {@link ComboKeySlot} picker plus a confirm button) or, once it holds a real
   * value, "configured" (collapsed to a compact modifier+key display with modify/delete buttons).
   * Only one field may be under configuration at a time — `activeField` names it ("output" or a
   * key index), and setting it to a different field implicitly collapses whichever one it was
   * pointing at back to its display row, since that row's own "is this the active field" check
   * simply stops matching. Reset to null whenever the card (re-)enters edit mode.
   */
  const [activeField, setActiveField] = useState<"output" | number | null>(null);
  useEffect(() => {
    if (!editing) return;
    setActiveField(null);
    // Only re-seed when a card newly enters edit mode, not on every entry edit within the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  /**
   * Chromium has a known bug where a scroller that becomes visible purely through a CSS
   * transform — no layout change, which is exactly what flipping this card is: only the
   * ancestor's `transform` changes, the scroller's own box never moves or resizes — doesn't get
   * its wheel-scrollable region registered with the compositor. The element is genuinely
   * overflowing (dragging the scrollbar or a keyboard PageDown still works), but the mouse
   * wheel / trackpad silently does nothing, which read as "the edit face can't be scrolled
   * down". Forcing a synchronous reflow on the scroller right as the flip settles makes Blink
   * re-register its scrollable region. See https://issues.chromium.org/issues/40394725.
   */
  const handleFlipSettled = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform" || !flipped) return;
    const el = cardBodyRef.current;
    if (!el) return;
    el.style.display = "none";
    void el.offsetHeight;
    el.style.display = "";
  };

  const setKeyAt = (i: number, id: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    onSave?.({ keys });
  };

  // Slots to render in the edit face's trigger-key row: every already-set key,
  // plus (only while at least one slot is still free) the next empty one as an
  // "add key" trigger — rather than always showing all 4 regardless of use.
  const nextEmptyKeyIndex = entry.keys.findIndex((k) => k === "KC_NO");
  const visibleKeyIndices = entry.keys.flatMap((k, i) => (k !== "KC_NO" ? [i] : []));
  if (nextEmptyKeyIndex !== -1) visibleKeyIndices.push(nextEmptyKeyIndex);

  return (
    <div
      className="group/card relative my-2 w-80"
      style={{ perspective: "1200px", viewTransitionName: `cbcard-${index}` }}
    >
      {editable && !flipped && (
        <div className="absolute -top-3 left-1/2 z-10 flex origin-top -translate-x-1/2 gap-1 rounded-full bg-neutral-900 px-2 py-1 opacity-0 shadow-lg transition-all duration-200 group-hover/card:-translate-y-2.5 group-hover/card:scale-[1.6] group-hover/card:opacity-100 dark:bg-neutral-700">
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("edit")}
            onClick={() => onEdit?.()}
          >
            <Icon icon="mdi:pencil" className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("delete")}
            onClick={() => onDelete?.()}
          >
            <Icon icon="mdi:trash-can-outline" className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className="grid h-[27rem] transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
        onTransitionEnd={handleFlipSettled}
      >
        <div
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="card relative h-[27rem] overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#57637314_35%,transparent_36%),radial-gradient(circle_at_top_right,#57637314_35%,transparent_36%)] bg-[#eaeff7] bg-size-[4.95em_4.95em] text-[#434b5b] shadow-lg shadow-slate-900/10 transition-shadow duration-200 group-hover/card:shadow-xl group-hover/card:shadow-slate-900/15 dark:bg-[radial-gradient(circle_at_bottom_left,#ffffff12_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff12_35%,transparent_36%)] dark:bg-[#1f242e] dark:text-[#d7dfeb] dark:shadow-black/40 dark:group-hover/card:shadow-black/55"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
              COMBO
            </span>
          </div>
          <div className="badge badge-sm absolute top-3 right-3 z-10 border-none bg-emerald-600 font-medium text-white">
            {t("comboActive")}
          </div>
          <div className="card-body relative flex flex-col pb-3">
            <div className="mb-4 flex items-center gap-2 font-mono text-4xl font-bold tracking-tight">
              <Icon icon="mdi:vector-combine" className="h-9 w-9" />
              {index}
            </div>
            <div className="grid grid-cols-2 gap-x-2 gap-y-3">
              {entry.keys.map((qmkId, i) => (
                <div key={i}>
                  <div className="text-xs opacity-45 uppercase">{t("comboKeyN", { n: i + 1 })}</div>
                  <div className={`${CARD_KEY_BOX} bg-white/60 text-xl font-bold dark:bg-white/10`}>
                    <KeycapFace qmkId={qmkId} className="whitespace-nowrap" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto flex items-center gap-2 border-t border-[#434b5b]/15 pt-3 text-sm tracking-widest opacity-55 dark:border-[#d7dfeb]/15">
              →
              <span className={`${CARD_KEY_BOX} flex-1 bg-[#434b5b]/10 dark:bg-black/20`}>
                <KeycapFace qmkId={entry.output} className="whitespace-nowrap" />
              </span>
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card relative h-[27rem] overflow-hidden border-2 border-dashed border-[#576373]/50 bg-white shadow-lg shadow-slate-900/10 dark:border-[#d7dfeb]/30 dark:bg-[#232326] dark:shadow-black/40"
          >
            {/* Absolutely positioned (rather than sized by normal flex flow) so its
                height is pinned to the card's own fixed 21rem box regardless of how
                tall the fields inside grow — a flex child's default min-height:auto
                would otherwise let it grow past the card and get silently clipped by
                the card's overflow-hidden instead of scrolling. `translateZ(0)` gives
                it its own compositing layer, and `handleFlipSettled` (attached to the
                flip container above) forces a reflow once the flip transition ends —
                see the comment on that handler for why both are needed for mouse-wheel
                scrolling to actually work here. */}
            <div
              ref={cardBodyRef}
              className="card-body scrollbar-hide absolute inset-0 gap-1.5 overflow-y-auto px-4 pt-4 pb-2"
              style={{ transform: "translateZ(0)" }}
            >
              <div className="mb-1 flex items-center justify-between">
                <RenumberPicker
                  index={index}
                  count={comboCount}
                  usedIndices={usedIndices}
                  icon="mdi:vector-combine"
                  title={t("comboRenumber")}
                  onMove={(toIdx) => onMove?.(toIdx)}
                />
                <div className="flex items-center gap-1">
                  <button type="button" className="btn btn-ghost btn-sm text-neutral-400" onClick={() => onCancel?.()}>
                    {t("cancel")}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm text-neutral-700 dark:text-neutral-200" onClick={() => onCloseEdit?.()}>
                    {t("done")}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {/* Only the keys the user has actually set, plus (while a slot is
                    still free) one more trigger for the next one — instead of
                    always showing all 4 slots regardless of how many are in use.
                    One per row: a ComboKeySlot's modifier chips + key button
                    don't fit two across in the card's 20rem width. */}
                {visibleKeyIndices.map((i) => (
                  <div key={i}>
                    <label className="fieldset-label text-xs text-neutral-400">{t("comboKeyN", { n: i + 1 })}</label>
                    {activeField === i ? (
                      <ComboKeySlot
                        qmkId={entry.keys[i]}
                        onChange={(id) => setKeyAt(i, id)}
                        className="btn btn-sm min-h-9 flex-wrap py-0.5 text-xs whitespace-pre-line btn-soft"
                        trailing={
                          <ConfirmButton
                            disabled={!comboFieldValid(entry.keys[i]) || entry.keys[i] === "KC_NO"}
                            onClick={() => setActiveField(null)}
                          />
                        }
                      />
                    ) : entry.keys[i] === "KC_NO" ? (
                      <button
                        type="button"
                        onClick={() => setActiveField(i)}
                        className="btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line btn-dash"
                      >
                        {t("comboAddRegularKey")}
                      </button>
                    ) : (
                      <ConfiguredFieldRow
                        qmkId={entry.keys[i]}
                        onEdit={() => setActiveField(i)}
                        onDelete={() => setKeyAt(i, "KC_NO")}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="my-1 border-t border-base-300 dark:border-neutral-700" />

              <label className="fieldset-label text-xs text-neutral-400">{t("comboOutput")}</label>
              <div className="mb-1.5">
                {activeField === "output" ? (
                  <ComboKeySlot
                    qmkId={entry.output}
                    onChange={(id) => onSave?.({ output: id })}
                    className="btn btn-sm min-h-9 flex-wrap py-0.5 text-xs whitespace-pre-line btn-soft"
                    trailing={
                      <ConfirmButton
                        disabled={!comboFieldValid(entry.output) || entry.output === "KC_NO"}
                        onClick={() => setActiveField(null)}
                      />
                    }
                  />
                ) : entry.output === "KC_NO" ? (
                  // Untouched slot: switches this field to the editor above instead of popping the
                  // picker directly, and (being the new active field) collapses whichever other
                  // field was mid-edit back to its display row.
                  <button
                    type="button"
                    onClick={() => setActiveField("output")}
                    className="btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line btn-dash"
                  >
                    {t("comboAddRegularKey")}
                  </button>
                ) : (
                  <ConfiguredFieldRow
                    qmkId={entry.output}
                    onEdit={() => setActiveField("output")}
                    onDelete={() => onSave?.({ output: "KC_NO" })}
                  />
                )}
              </div>

              {/* Bottom breathing room so the last field doesn't sit flush against the
                  card edge when scrolled all the way down. */}
              <div className="h-5 shrink-0" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


interface Props {
  keyboard: Keyboard;
  /** Called after an entry was written to the device, so the parent re-renders. */
  onChange: () => void;
}

const isUsed = (e: ComboEntry) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO");

export function ComboPanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  /**
   * The single slot currently flipped to its editor face. Parent-owned so only one card edits at a
   * time, and it doubles as the "freshly added, still-unused slot" marker (shown even when empty).
   */
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  /**
   * A freshly added, still-unused slot that's visible but not yet flipped — set for the two
   * animation frames between "新增 Combo" being clicked and {@link editingIndex} taking over, so
   * the new card mounts showing its front face first and then flips into the editor face exactly
   * like clicking the pencil icon on an existing card, instead of popping directly into the
   * editor face with no transition.
   */
  const [addingIndex, setAddingIndex] = useState<number | null>(null);
  /**
   * When set, overrides the natural (ascending) card order so a just-renumbered card stays put for
   * a beat before it animates to its sorted position. Cleared inside a View Transition.
   */
  const [pendingOrder, setPendingOrder] = useState<number[] | null>(null);
  /** Slot awaiting delete confirmation, or null when the confirm dialog is closed. */
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);
  const reorderTimer = useRef<number | null>(null);
  /** The entry's value captured when editing began, restored verbatim if the user clicks Cancel. */
  const editSnapshot = useRef<ComboEntry | null>(null);
  /** Pending `requestAnimationFrame` id(s) for the add-flow's delayed flip, cancelled on unmount
   *  or if another action pre-empts it before the two frames elapse. */
  const addRaf = useRef<number[]>([]);

  const cancelPendingAddFlip = () => {
    addRaf.current.forEach((id) => cancelAnimationFrame(id));
    addRaf.current = [];
  };

  useEffect(() => () => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    cancelPendingAddFlip();
  }, []);

  const cancelPendingReorder = () => {
    if (reorderTimer.current) {
      clearTimeout(reorderTimer.current);
      reorderTimer.current = null;
    }
    setPendingOrder(null);
  };

  /** Play the deferred re-sort (a card was renumbered while editing) as an animated View Transition. */
  const settlePendingReorder = (delayMs: number) => {
    if (reorderTimer.current) clearTimeout(reorderTimer.current);
    reorderTimer.current = window.setTimeout(() => {
      reorderTimer.current = null;
      startViewTransition(() => flushSync(() => setPendingOrder(null)));
    }, delayMs);
  };

  const snapshotOf = (i: number): ComboEntry => {
    const e = keyboard.comboEntries[i];
    return { ...e, keys: [...e.keys] as ComboEntry["keys"] };
  };

  const handleEdit = (i: number) => {
    // Switching to another card settles the previous card's pending re-sort first.
    if (pendingOrder) settlePendingReorder(0);
    cancelPendingAddFlip();
    setAddingIndex(null);
    editSnapshot.current = snapshotOf(i);
    setEditingIndex(i);
  };

  const handleCloseEdit = () => {
    if (editingIndex !== null) {
      const e = keyboard.comboEntries[editingIndex];
      const invalid = !comboFieldValid(e.output) || e.keys.some((k) => !comboFieldValid(k));
      if (invalid) {
        showToast(t("comboInvalidKeycode"));
        return;
      }
    }
    cancelPendingAddFlip();
    setAddingIndex(null);
    editSnapshot.current = null;
    setEditingIndex(null);
    // Only now (on "done") does the card animate into its sorted position — after a beat that lets
    // it flip back to its front face first.
    if (pendingOrder) settlePendingReorder(500);
  };

  /** Discard edits: restore the entry to its pre-edit value, then leave edit mode with no animation. */
  const handleCancel = () => {
    const idx = editingIndex;
    const snap = editSnapshot.current;
    editSnapshot.current = null;
    cancelPendingReorder();
    cancelPendingAddFlip();
    setAddingIndex(null);
    setEditingIndex(null);
    if (idx !== null && snap) void updateAt(idx, snap);
  };

  if (keyboard.comboCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("comboNone")}</p>;
  }

  const usedCount = keyboard.comboEntries.filter(isUsed).length;

  const updateAt = async (idx: number, patch: Partial<ComboEntry>) => {
    try {
      await keyboard.setCombo(idx, { ...keyboard.comboEntries[idx], ...patch });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const clearAt = (idx: number) =>
    void updateAt(idx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });

  const usedIndices = new Set(keyboard.comboEntries.flatMap((e, i) => (isUsed(e) ? [i] : [])));

  /** Cards to show, in the order to show them — `pendingOrder` while a renumber is settling. */
  const sortedVisible = keyboard.comboEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.comboEntries[i]) || i === editingIndex || i === addingIndex);
  const displayOrder = pendingOrder
    ? pendingOrder.filter((i) => sortedVisible.includes(i))
    : sortedVisible;

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.comboEntries[fromIdx];
    // Hold the current visual order, with the moved card renamed in place, until the timer fires.
    const heldOrder = displayOrder.map((i) => (i === fromIdx ? toIdx : i));
    try {
      await keyboard.setCombo(toIdx, { ...src, keys: [...src.keys] as ComboEntry["keys"] });
      if (isUsed(src)) {
        await keyboard.setCombo(fromIdx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });
      }
      // Hold the card in place, still in edit mode; the re-sort waits until "done" is clicked.
      if (reorderTimer.current) {
        clearTimeout(reorderTimer.current);
        reorderTimer.current = null;
      }
      setEditingIndex(toIdx);
      setPendingOrder(heldOrder);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const handleAdd = () => {
    const freeIdx = keyboard.comboEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("comboFull"));
      return;
    }
    cancelPendingReorder();
    cancelPendingAddFlip();
    // Show the freshly added card at the front of the row while it's being edited; the natural
    // (ascending) order animates back into place only when the user clicks Done or Cancel.
    const used = keyboard.comboEntries.flatMap((e, i) => (isUsed(e) ? [i] : []));
    setPendingOrder([freeIdx, ...used]);
    editSnapshot.current = snapshotOf(freeIdx);
    // Mount the new card showing its front face first, then flip it into the editor face on the
    // next paint — the same entrance the pencil-icon edit path gets — instead of popping directly
    // into the editor face with no transition. Two rAFs so the un-flipped frame actually commits
    // before the transform change that the flip's CSS transition needs to animate from.
    setAddingIndex(freeIdx);
    addRaf.current = [
      requestAnimationFrame(() => {
        addRaf.current = [
          requestAnimationFrame(() => {
            addRaf.current = [];
            setEditingIndex(freeIdx);
            setAddingIndex(null);
          }),
        ];
      }),
    ];
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-start gap-3">
        <div className="flex items-center gap-3">
          <progress className="progress h-3 w-80" value={usedCount} max={Math.max(keyboard.comboCount, 1)} />
          <span className="text-xs text-brand-on-surface-variant">
            {t("comboUsed", { used: usedCount, total: keyboard.comboCount })}
          </span>
          <HelpIcon text={t("comboUsedHelp")} />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
          {t("comboAdd")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {displayOrder.length === 0 ? (
          <p className="text-sm text-brand-on-surface-variant">{t("comboEmpty")}</p>
        ) : (
          displayOrder.map((i) => (
            <ComboPreviewCard
              key={i}
              index={i}
              entry={keyboard.comboEntries[i]}
              comboCount={keyboard.comboCount}
              usedIndices={usedIndices}
              onSave={(patch) => void updateAt(i, patch)}
              onDelete={() => setPendingDelete(i)}
              onMove={(toIdx) => void moveTo(i, toIdx)}
              editing={i === editingIndex}
              onEdit={() => handleEdit(i)}
              onCloseEdit={handleCloseEdit}
              onCancel={handleCancel}
            />
          ))
        )}
      </div>
      {pendingDelete !== null && (
        <ConfirmDialog
          message={t("comboDeleteConfirm")}
          onConfirm={() => {
            clearAt(pendingDelete);
            setPendingDelete(null);
          }}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
