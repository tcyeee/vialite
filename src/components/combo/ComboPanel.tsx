import { useState, type SVGProps } from "react";
import { useI18n } from "../../contexts/i18n.tsx";
import { KeycapFace } from "../keymap/KeycapFace.tsx";
import type { ComboEntry, Keyboard } from "../../protocol/keyboard.ts";
import { useToast } from "../../contexts/toast.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { KeySlot } from "../common/KeySlot.tsx";

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
  /** Renders already flipped to the editor face, for a freshly added (still-unused) entry. */
  startInEditMode?: boolean;
  /** Called when leaving edit mode via the "done" button, so the parent can drop an unused slot. */
  onCollapse?: () => void;
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
  startInEditMode,
  onCollapse,
}: PreviewCardProps) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(!!startInEditMode);
  const editable = !!onSave;

  const closeEdit = () => {
    setFlipped(false);
    onCollapse?.();
  };

  const setKeyAt = (i: number, id: string) => {
    const keys = [...entry.keys] as ComboEntry["keys"];
    keys[i] = id;
    onSave?.({ keys });
  };

  return (
    <div className="group/card relative my-2 w-80" style={{ perspective: "1200px" }}>
      {editable && !flipped && (
        <div className="absolute -top-3 left-1/2 z-10 flex origin-top -translate-x-1/2 gap-1 rounded-full bg-neutral-900 px-2 py-1 opacity-0 shadow-lg transition-all duration-200 group-hover/card:-translate-y-2.5 group-hover/card:scale-[1.6] group-hover/card:opacity-100">
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("edit")}
            onClick={() => setFlipped(true)}
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs px-2 text-white hover:bg-white/20 hover:text-white"
            title={t("delete")}
            onClick={() => {
              if (window.confirm(t("comboDeleteConfirm"))) {
                onDelete?.();
              }
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className="grid h-[16.5rem] transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        <div
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="card relative overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-[#73575E] bg-size-[4.95em_4.95em] text-brand-background"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
              COMBO
            </span>
          </div>
          <div className="card-body relative flex flex-col pb-3">
            <div className="mb-4 font-mono text-4xl font-bold tracking-tight">CB-{index}</div>
            <div className="grid grid-cols-2 gap-y-3">
              {entry.keys.map((qmkId, i) => (
                <div key={i}>
                  <div className="text-xs opacity-20 uppercase">{t("comboKeyN", { n: i + 1 })}</div>
                  <div className="text-xl font-bold">
                    <KeycapFace qmkId={qmkId} className="whitespace-pre-line" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto pt-3 text-center text-sm tracking-widest opacity-40">
              → <KeycapFace qmkId={entry.output} className="whitespace-pre-line" />
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card overflow-hidden border-2 border-dashed border-brand-outline/50 bg-white"
          >
            <div className="card-body gap-1.5 px-4 pt-4 pb-2">
              <div className="mb-1 flex items-center justify-between">
                <div className="dropdown">
                  <div
                    tabIndex={0}
                    role="button"
                    className="flex cursor-pointer items-center gap-0.5 text-lg font-bold tracking-tight text-neutral-900 hover:text-primary"
                    title={t("comboRenumber")}
                  >
                    CB-{index}
                    <ChevronDownIcon className="h-4 w-4 opacity-60" />
                  </div>
                  <div
                    tabIndex={0}
                    className="dropdown-content z-20 mt-1 grid max-h-72 w-72 grid-cols-5 gap-1.5 overflow-y-auto rounded-box border border-base-300 bg-base-100 p-3 shadow-lg"
                  >
                    {Array.from({ length: comboCount }).map((_, n) => {
                      const current = n === index;
                      const occupied = !current && usedIndices.has(n);
                      return (
                        <button
                          key={n}
                          type="button"
                          disabled={occupied}
                          onClick={(e) => {
                            e.currentTarget.blur();
                            if (!current) onMove?.(n);
                          }}
                          className={`btn btn-sm ${
                            current ? "btn-primary" : occupied ? "btn-ghost opacity-30" : "btn-ghost"
                          }`}
                        >
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm text-neutral-500" onClick={closeEdit}>
                  {t("done")}
                </button>
              </div>

              <label className="fieldset-label text-xs text-neutral-400">{t("comboOutput")}</label>
              <div className="mb-1.5">
                <KeySlot
                  qmkId={entry.output}
                  onChange={(id) => onSave?.({ output: id })}
                  className={`btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line ${
                    entry.output !== "KC_NO" ? "btn-soft" : "btn-dash"
                  }`}
                />
              </div>

              {/* Same 2x2 arrangement as the front face's grid, so a field's position doesn't
                  move when the card flips between display and edit state. */}
              <div className="grid grid-cols-2 gap-2">
                {entry.keys.map((qmkId, i) => (
                  <div key={i}>
                    <label className="fieldset-label text-xs text-neutral-400">{t("comboKeyN", { n: i + 1 })}</label>
                    <KeySlot
                      qmkId={qmkId}
                      onChange={(id) => setKeyAt(i, id)}
                      className={`btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line ${
                        qmkId !== "KC_NO" ? "btn-soft" : "btn-dash"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
    </svg>
  );
}

function PencilIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m16.5 3.5 4 4L7 21l-4.5 1L3.5 17.5 16.5 3.5Z" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V4h6v3m-8 0 .8 12.4A2 2 0 0 0 9.8 21h4.4a2 2 0 0 0 2-1.6L17 7" />
    </svg>
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
  /** Index of a freshly added, still-unused slot being edited; shown even though it's not "used" yet. */
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

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

  /** Move an entry to a different (free) slot number: write it to the new slot, clear the old one. */
  const moveTo = async (fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    const src = keyboard.comboEntries[fromIdx];
    try {
      await keyboard.setCombo(toIdx, { ...src, keys: [...src.keys] as ComboEntry["keys"] });
      if (isUsed(src)) {
        await keyboard.setCombo(fromIdx, { keys: ["KC_NO", "KC_NO", "KC_NO", "KC_NO"], output: "KC_NO" });
      }
      setAddingIndex(toIdx);
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const usedIndices = new Set(keyboard.comboEntries.flatMap((e, i) => (isUsed(e) ? [i] : [])));

  const handleAdd = () => {
    const freeIdx = keyboard.comboEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("comboFull"));
      return;
    }
    setAddingIndex(freeIdx);
  };

  const visibleIndices = keyboard.comboEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.comboEntries[i]) || i === addingIndex);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <progress className="progress h-3 w-80" value={usedCount} max={Math.max(keyboard.comboCount, 1)} />
        <span className="text-xs text-brand-on-surface-variant">
          {t("comboUsed", { used: usedCount, total: keyboard.comboCount })}
        </span>
        <HelpIcon text={t("comboUsedHelp")} />
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
          {t("comboAdd")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {visibleIndices.length === 0 ? (
          <p className="text-sm text-brand-on-surface-variant">{t("comboEmpty")}</p>
        ) : (
          visibleIndices.map((i) => (
            <ComboPreviewCard
              key={i}
              index={i}
              entry={keyboard.comboEntries[i]}
              comboCount={keyboard.comboCount}
              usedIndices={usedIndices}
              onSave={(patch) => void updateAt(i, patch)}
              onDelete={() => clearAt(i)}
              onMove={(toIdx) => void moveTo(i, toIdx)}
              startInEditMode={i === addingIndex}
              onCollapse={i === addingIndex ? () => setAddingIndex(null) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
