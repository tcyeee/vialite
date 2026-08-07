import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { Icon } from "@iconify/react";
import { useI18n } from "../../contexts/i18n.tsx";
import { VIAL_PROTOCOL_ADVANCED_MACROS } from "../../protocol/constants.ts";
import type { Keyboard, MacroAction } from "../../protocol/keyboard.ts";
import { serializeMacro, serializeMacros } from "../../protocol/macro.ts";
import { usePersistedBoolean } from "../../hooks/usePersistedBoolean.ts";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { KeySlot } from "../common/KeySlot.tsx";
import { KeycodeCascadeSelector } from "../keymap/picker/KeycodeCascadeSelector.tsx";
import { UnlockDialog } from "../matrix/UnlockDialog.tsx";
import { MacroKeycap3D } from "./MacroKeycap3D.tsx";
import { useWriteError } from "../../hooks/useWriteError.ts";

interface Props {
  keyboard: Keyboard;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function RowControls({ onRemove }: { onRemove: () => void }) {
  return (
    <div className="ml-auto flex shrink-0 gap-1">
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle text-error"
        onClick={onRemove}
        aria-label="remove"
      >
        ✕
      </button>
    </div>
  );
}

function AddKeycodeButton({ onPick }: { onPick: (qmkId: string) => void }) {
  return (
    <KeycodeCascadeSelector
      placeholder="+"
      compact
      keepPicked={false}
      triggerClassName="btn btn-dash btn-xs gap-1"
      onPick={(entry) => onPick(entry.qmkId)}
    />
  );
}

function AddActionButton({
  kind,
  label,
  onAdd,
}: {
  kind: "tap" | "down" | "up";
  label: string;
  onAdd: (action: MacroAction) => void;
}) {
  return (
    <KeycodeCascadeSelector
      placeholder={label}
      compact
      keepPicked={false}
      triggerClassName="btn btn-sm btn-outline gap-1"
      onPick={(entry) => onAdd({ kind, keycodes: [entry.qmkId] })}
    />
  );
}

function MacroActionRow({
  action,
  onChange,
  onRemove,
  isDragging,
  registerRow,
  onDragStartRow,
  onDragEndRow,
  onDragOverRow,
  onDropRow,
}: {
  action: MacroAction;
  onChange: (next: MacroAction) => void;
  onRemove: () => void;
  isDragging: boolean;
  registerRow: (el: HTMLDivElement | null) => void;
  onDragStartRow: () => void;
  onDragEndRow: () => void;
  onDragOverRow: (e: DragEvent<HTMLDivElement>) => void;
  onDropRow: () => void;
}) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement>(null);

  // `draggable` sits on the handle (not the row) so the text/number inputs keep
  // their native text selection, but the drag image is taken from the whole row
  // — otherwise the browser snapshots just the ⠿ glyph and nothing appears to
  // move. `effectAllowed`/`setData` are both required: without them Chrome shows
  // the no-drop cursor for the entire drag and Firefox refuses to start one.
  const handle = (
    <span
      className="cursor-grab select-none px-1 text-brand-on-surface-variant active:cursor-grabbing"
      draggable
      onDragStart={(e) => {
        const row = rowRef.current;
        if (row) {
          const rect = row.getBoundingClientRect();
          e.dataTransfer.setDragImage(row, e.clientX - rect.left, e.clientY - rect.top);
        }
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "");
        onDragStartRow();
      }}
      onDragEnd={onDragEndRow}
      aria-label="drag"
    >
      ⠿
    </span>
  );

  let body;
  if (action.kind === "text") {
    body = (
      <>
        <span className="badge badge-neutral">{t("macroActionText")}</span>
        <input
          type="text"
          className="input input-sm flex-1"
          value={action.text}
          onChange={(e) => onChange({ ...action, text: e.target.value })}
        />
      </>
    );
  } else if (action.kind === "delay") {
    body = (
      <>
        <span className="badge badge-neutral">{t("macroActionDelay")}</span>
        <input
          type="number"
          className="input input-sm w-28"
          min={0}
          value={action.ms}
          onChange={(e) => onChange({ ...action, ms: Number(e.target.value) })}
        />
        <span className="text-xs text-brand-on-surface-variant">ms</span>
      </>
    );
  } else {
    const kindLabel = { tap: t("macroActionTap"), down: t("macroActionDown"), up: t("macroActionUp") }[action.kind];
    body = (
      <>
        <span className="badge badge-neutral">{kindLabel}</span>
        {action.keycodes.map((qmkId, i) => (
          <span key={i} className="inline-flex items-center gap-0.5">
            <KeySlot
              qmkId={qmkId}
              className="btn btn-outline btn-xs min-h-8 whitespace-pre-line"
              onChange={(id) => {
                const next = [...action.keycodes];
                next[i] = id;
                onChange({ ...action, keycodes: next });
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle"
              aria-label="remove keycode"
              onClick={() => onChange({ ...action, keycodes: action.keycodes.filter((_, idx) => idx !== i) })}
            >
              ✕
            </button>
          </span>
        ))}
        <AddKeycodeButton onPick={(id) => onChange({ ...action, keycodes: [...action.keycodes, id] })} />
      </>
    );
  }

  return (
    <div
      ref={(el) => {
        rowRef.current = el;
        registerRow(el);
      }}
      className={`flex flex-wrap items-center gap-2 rounded-box border border-brand-outline/20 p-2 transition-opacity ${
        isDragging ? "opacity-40" : ""
      }`}
      onDragOver={onDragOverRow}
      onDrop={(e) => {
        // Cancels the default text drop, which would otherwise paste the
        // dataTransfer payload into whichever input sits under the pointer.
        e.preventDefault();
        onDropRow();
      }}
    >
      {handle}
      {body}
      <RowControls onRemove={onRemove} />
    </div>
  );
}

export function MacroPanel({ keyboard }: Props) {
  const { t } = useI18n();
  const onWriteError = useWriteError();
  const [active, setActive] = useState(0);
  const [edited, setEdited] = useState<MacroAction[][]>(() => keyboard.macros);
  const [savedMacros, setSavedMacros] = useState<MacroAction[][]>(() => keyboard.macros);
  const [saving, setSaving] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // `dragover` can fire several times per frame; React batches the state
  // updates, so the handler reads the index from a ref to avoid reordering
  // twice off the same stale value.
  const dragIndexRef = useRef<number | null>(null);
  const [collapsed, setCollapsed] = usePersistedBoolean("vialite-macro-slots-collapsed");
  const stripRef = useRef<HTMLDivElement>(null);
  // Row identity for the FLIP pass below. Rows are rendered from a plain array
  // with no natural key: the action objects can't be used, since editing one
  // replaces the object and would remount the row mid-keystroke. So ids are
  // handed out positionally and permuted alongside a reorder — stable exactly
  // where identity matters (a move) and regenerated when the list length
  // changes (add / remove / revert / slot switch), where nothing is animated.
  const rowIdsRef = useRef<{ slot: number; ids: number[] }>({ slot: -1, ids: [] });
  const nextRowIdRef = useRef(0);
  const rowElsRef = useRef(new Map<number, HTMLDivElement>());
  const rowTopsRef = useRef(new Map<number, number>());
  const rowAnimsRef = useRef(new Map<number, Animation>());
  // Only a reorder should animate. Without this gate any layout shift that
  // moves the rows as a group — the panel above them settling on first paint,
  // a font landing, the slot grid reflowing — reads as "every row moved" and
  // the whole list twitches.
  const flipPendingRef = useRef(false);

  useEffect(() => {
    setEdited(keyboard.macros);
    setSavedMacros(keyboard.macros);
    setActive(0);
  }, [keyboard]);

  // FLIP: a reorder drops every affected row into its new slot instantly, so
  // replay the trip — each row is animated from where it just was back to zero.
  // Runs on every render (rows are few, so the layout read is cheap) to keep
  // the recorded positions current, but only animates when a reorder set the
  // flag — see flipPendingRef.
  useLayoutEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animating = flipPendingRef.current && !reduceMotion;
    flipPendingRef.current = false;
    const tops = new Map<number, number>();
    for (const [id, el] of rowElsRef.current) {
      // offsetTop rather than getBoundingClientRect(), so scrolling the page
      // between renders doesn't read as every row having moved. The list
      // container is `relative`, making it the offsetParent, so these stay
      // container-relative and ignore anything shifting above the panel.
      const top = el.offsetTop;
      tops.set(id, top);
      const prev = rowTopsRef.current.get(id);
      if (!animating || prev === undefined || Math.abs(prev - top) < 0.5) continue;
      // WAAPI rather than a CSS transition: it needs no forced reflow to latch
      // the start value, and it leaves the row's inline styles (and the
      // Tailwind opacity transition) alone.
      rowAnimsRef.current.get(id)?.cancel();
      rowAnimsRef.current.set(
        id,
        el.animate(
          [{ transform: `translateY(${prev - top}px)` }, { transform: "translateY(0)" }],
          { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        ),
      );
    }
    // Rebuilt from the live rows, so ids belonging to removed rows drop out.
    rowTopsRef.current = tops;
    for (const id of rowAnimsRef.current.keys()) {
      if (!tops.has(id)) rowAnimsRef.current.delete(id);
    }
  });

  // Keep the selected slot visible when the strip scrolls horizontally on
  // narrow screens (e.g. switching slots from the 3D keycap).
  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);

  if (keyboard.macroCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("macroNone")}</p>;
  }

  const supportsDelay = keyboard.vialProtocol >= VIAL_PROTOCOL_ADVANCED_MACROS;
  const actions = edited[active] ?? [];

  if (rowIdsRef.current.slot !== active || rowIdsRef.current.ids.length !== actions.length) {
    rowIdsRef.current = { slot: active, ids: actions.map(() => nextRowIdRef.current++) };
  }
  const rowIds = rowIdsRef.current.ids;

  let currentBuffer: Uint8Array | null = null;
  try {
    currentBuffer = serializeMacros(edited, keyboard.vialProtocol);
  } catch {
    // e.g. a delay action left over on a protocol that doesn't support it.
  }
  const memoryUsed = currentBuffer?.length ?? 0;
  const overBudget = currentBuffer !== null && memoryUsed > keyboard.macroMemory;
  const hasChanges = currentBuffer !== null && !bytesEqual(currentBuffer, serializeMacros(savedMacros, keyboard.vialProtocol));
  // Per-slot unsaved-change flags, so the multi-row grid can flag *every*
  // dirty slot at a glance rather than only the active one.
  const slotChangedFlags = edited.map((m, i) => {
    try {
      return !bytesEqual(
        serializeMacro(m, keyboard.vialProtocol),
        serializeMacro(savedMacros[i] ?? [], keyboard.vialProtocol),
      );
    } catch {
      return false;
    }
  });

  const updateActive = (next: MacroAction[]) => {
    setEdited((prev) => prev.map((m, i) => (i === active ? next : m)));
  };
  const addAction = (action: MacroAction) => updateActive([...actions, action]);
  const removeAction = (i: number) => updateActive(actions.filter((_, idx) => idx !== i));
  const updateAction = (i: number, next: MacroAction) => updateActive(actions.map((a, idx) => (idx === i ? next : a)));
  const moveActionTo = (from: number, to: number) => {
    if (from !== to && from >= 0 && to >= 0 && from < rowIds.length && to < rowIds.length) {
      // Keep row identity travelling with the action it labels, or the FLIP
      // pass sees the rows as unmoved and nothing animates.
      const [id] = rowIds.splice(from, 1);
      rowIds.splice(to, 0, id);
      flipPendingRef.current = true;
    }
    setEdited((prev) =>
      prev.map((m, i) => {
        if (i !== active) return m;
        if (from === to || from < 0 || to < 0 || from >= m.length || to >= m.length) return m;
        const next = [...m];
        const [item] = next.splice(from, 1);
        next.splice(to, 0, item);
        return next;
      }),
    );
  };

  const setDrag = (index: number | null) => {
    dragIndexRef.current = index;
    setDragIndex(index);
  };

  // Reorder live as the pointer travels, rather than only on drop — that
  // continuous shuffle *is* the drag animation. The midpoint check (only commit
  // once the pointer passes the target row's centre, in the direction of
  // travel) stops rows of differing heights from flickering back and forth.
  const handleRowDragOver = (e: DragEvent<HTMLDivElement>, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const from = dragIndexRef.current;
    if (from === null || from === idx) return;
    // Measure in layout space: the row may still be mid-FLIP, and a hit-box
    // that slides along with the animation makes the reorder oscillate. The
    // matrix' vertical translation backs the animation offset out of the rect.
    const rect = e.currentTarget.getBoundingClientRect();
    const transform = getComputedStyle(e.currentTarget).transform;
    const offsetY = transform && transform !== "none" ? new DOMMatrixReadOnly(transform).m42 : 0;
    const midpoint = rect.top - offsetY + rect.height / 2;
    if (idx > from ? e.clientY < midpoint : e.clientY > midpoint) return;
    moveActionTo(from, idx);
    setDrag(idx);
  };

  const commitSave = async () => {
    setSaving(true);
    try {
      await keyboard.saveMacros(edited);
      setSavedMacros(edited);
      await keyboard.lock().catch(() => {});
    } catch (err) {
      onWriteError(err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = async () => {
    try {
      const status = await keyboard.getUnlockStatus();
      if (status.unlocked) {
        await commitSave();
      } else {
        setUnlocking(true);
      }
    } catch (err) {
      onWriteError(err);
    }
  };

  const revert = () => {
    setEdited(savedMacros);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 mb-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-medium">{t("macroMemoryTitle")}</span>
          <progress
            className={overBudget ? "progress progress-error h-3 w-full max-w-80 flex-1" : "progress h-3 w-full max-w-80 flex-1"}
            value={Math.min(memoryUsed, keyboard.macroMemory)}
            max={Math.max(keyboard.macroMemory, 1)}
          />
          <div className="flex basis-full items-center gap-1 sm:basis-auto">
            <span className={overBudget ? "text-xs text-error" : "text-xs text-brand-on-surface-variant"}>
              {t("macroMemoryUsed", { used: memoryUsed, total: keyboard.macroMemory })}
            </span>
            <HelpIcon text={t("macroMemoryHelp")} />
          </div>
        </div>
      </div>
      <MacroKeycap3D label={String(active)} />
      {/* Slot selector as a wrapping grid so devices exposing many macro slots
          (some boards report 100+) flow into multiple rows instead of an
          endless single-row horizontal scroll. `auto-fill` keeps a consistent
          cell width and packs as many columns per row as the container allows. */}
      <div
        ref={stripRef}
        role="tablist"
        aria-label={t("macroSlots")}
        className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(4.5rem,1fr))]"
      >
        {edited.map((macro, i) => {
          const configured = macro.length > 0;
          const isActive = i === active;
          // When collapsed, only surface slots that have been used, keeping the
          // active slot visible so the selection always stays represented.
          if (collapsed && !configured && !isActive) return null;
          const dirty = slotChangedFlags[i] ?? false;
          return (
            <button
              key={i}
              type="button"
              role="tab"
              data-active={isActive}
              aria-selected={isActive}
              onClick={() => setActive(i)}
              className={`btn btn-sm relative isolate justify-start gap-1.5 ${
                isActive ? "btn-primary" : "btn-outline border-base-300"
              }`}
              aria-label={`${configured ? "● " : ""}M${i}${dirty ? "*" : ""}`}
            >
              {/* Inset translucent fill marking inactive-but-configured slots,
                  mirroring LayerTabs. */}
              {configured && !isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -z-10 rounded-[inherit] bg-brand-secondary/15"
                />
              )}
              <Icon icon="mdi:script-text-outline" className="h-4 w-4 shrink-0" />
              <span>
                {i}
                {dirty ? "*" : ""}
              </span>
              {configured && !isActive && (
                <span className="ml-auto inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />
              )}
            </button>
          );
        })}
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-square text-brand-on-surface-variant"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("macroShowAllSlots") : t("macroShowUsedSlots")}
          title={collapsed ? t("macroShowAllSlots") : t("macroShowUsedSlots")}
        >
          <Icon
            icon={collapsed ? "mdi:dots-horizontal" : "mdi:chevron-double-left"}
            className="h-5 w-5 shrink-0"
          />
        </button>
      </div>
      <div className="rounded-box border border-base-300 bg-base-100 p-6 min-h-90">
        <div key={active} className="tab-panel-appear flex flex-col gap-4">
          {/* `relative` is load-bearing: it makes this the rows' offsetParent
              so the FLIP pass measures them against the list, not the page. */}
          <div className="relative flex flex-col gap-2">
            {actions.length === 0 && (
              <p className="text-xs text-brand-on-surface-variant">{t("macroEmpty")}</p>
            )}
            {actions.map((action, idx) => (
              <MacroActionRow
                key={rowIds[idx]}
                action={action}
                registerRow={(el) => {
                  // Only the element map is touched here. React detaches this
                  // callback (el === null) on every render because its identity
                  // changes, so clearing the recorded position here would erase
                  // the FLIP's "before" state right before it is read.
                  const id = rowIds[idx];
                  if (el) rowElsRef.current.set(id, el);
                  else rowElsRef.current.delete(id);
                }}
                onChange={(next) => updateAction(idx, next)}
                onRemove={() => removeAction(idx)}
                isDragging={dragIndex === idx}
                onDragStartRow={() => setDrag(idx)}
                onDragEndRow={() => setDrag(null)}
                onDragOverRow={(e) => handleRowDragOver(e, idx)}
                onDropRow={() => setDrag(null)}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => addAction({ kind: "text", text: "" })}
              >
                {t("macroAddText")}
              </button>
              <AddActionButton kind="tap" label={t("macroAddTap")} onAdd={addAction} />
              <AddActionButton kind="down" label={t("macroAddDown")} onAdd={addAction} />
              <AddActionButton kind="up" label={t("macroAddUp")} onAdd={addAction} />
              {supportsDelay && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={() => addAction({ kind: "delay", ms: 0 })}
                >
                  {t("macroAddDelay")}
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={!hasChanges || overBudget || saving || currentBuffer === null}
                onClick={() => void handleSaveClick()}
              >
                {saving ? t("macroSaving") : t("save")}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={!hasChanges || saving}
                onClick={revert}
              >
                {t("revert")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {unlocking && (
        <UnlockDialog
          keyboard={keyboard}
          onUnlocked={() => {
            setUnlocking(false);
            void commitSave();
          }}
          onCancel={() => setUnlocking(false)}
        />
      )}
    </div>
  );
}
