import { useState, type SVGProps } from "react";
import { type MessageKey, useI18n } from "../../i18n.tsx";
import { label as kcLabel } from "../../protocol/keycodes.ts";
import type { Keyboard, TapDanceEntry } from "../../protocol/keyboard.ts";
import { useToast } from "../../toast.tsx";
import { KeySlot } from "../common/KeySlot.tsx";

const PREVIEW_STATES: { labelKey: MessageKey; field: keyof TapDanceEntry }[] = [
  { labelKey: "tapDanceOnTap", field: "onTap" },
  { labelKey: "tapDanceOnHold", field: "onHold" },
  { labelKey: "tapDanceOnDoubleTap", field: "onDoubleTap" },
  { labelKey: "tapDanceOnTapHold", field: "onTapHold" },
];

interface PreviewCardProps {
  index: number;
  entry: TapDanceEntry;
  /** Present only for already-configured entries — enables the hover toolbar + flip-to-edit. */
  onSave?: (patch: Partial<TapDanceEntry>) => void;
  onDelete?: () => void;
  /** Renders already flipped to the editor face, for a freshly added (still-unused) entry. */
  startInEditMode?: boolean;
  /** Called when leaving edit mode via the "done" button, so the parent can drop an unused slot. */
  onCollapse?: () => void;
}

/**
 * Summary of one tap dance entry. When `onSave`/`onDelete` are given, hovering reveals an
 * Edit/Delete toolbar; Edit flips the card (CSS 3D transform) to reveal an inline editor on
 * the back face, so editing happens in place instead of in a separate form.
 */
function TapDancePreviewCard({ index, entry, onSave, onDelete, startInEditMode, onCollapse }: PreviewCardProps) {
  const { t } = useI18n();
  const [flipped, setFlipped] = useState(!!startInEditMode);
  const editable = !!onSave;

  const closeEdit = () => {
    setFlipped(false);
    onCollapse?.();
  };

  return (
    <div className="group/card relative my-2 w-80" style={{ perspective: "1200px" }}>
      {editable && !flipped && (
        <div className="absolute -top-3 left-1/2 z-10 flex origin-top -translate-x-1/2 gap-1 rounded-full bg-neutral-900 px-2 py-1 opacity-0 shadow-lg transition-all duration-200 group-hover/card:scale-[1.6] group-hover/card:opacity-100">
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
              if (window.confirm(t("tapDanceDeleteConfirm"))) {
                onDelete?.();
              }
            }}
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div
        className="grid transition-transform duration-500"
        style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : undefined }}
      >
        <div
          style={{ backfaceVisibility: "hidden", gridArea: "1 / 1" }}
          className="card relative overflow-hidden bg-[radial-gradient(circle_at_bottom_left,#ffffff08_35%,transparent_36%),radial-gradient(circle_at_top_right,#ffffff08_35%,transparent_36%)] bg-brand-primary bg-size-[4.95em_4.95em] text-brand-background"
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden select-none">
            <span className="-rotate-12 text-6xl font-black tracking-widest whitespace-nowrap opacity-5">
              TAP DANCE
            </span>
          </div>
          <div className="card-body relative">
            <div className="mb-6 font-mono text-4xl font-bold tracking-tight">TD-{index}</div>
            <div className="mb-4 text-lg tracking-widest opacity-40">
              {t("tapDanceTermMs", { ms: entry.tappingTerm })}
            </div>
            <div className="grid grid-cols-2 gap-y-3">
              {PREVIEW_STATES.map(({ labelKey, field }) => (
                <div key={field}>
                  <div className="text-xs opacity-20 uppercase">{t(labelKey)}</div>
                  <div className="whitespace-pre-line">
                    {kcLabel(entry[field] as string)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {editable && (
          <div
            style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", gridArea: "1 / 1" }}
            className="card border-2 border-dashed border-brand-outline/50 bg-white"
          >
            <div className="card-body gap-1.5 p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-lg font-bold tracking-tight text-neutral-900">TD-{index}</span>
                <button type="button" className="btn btn-ghost btn-sm text-neutral-500" onClick={closeEdit}>
                  {t("done")}
                </button>
              </div>

              <label className="fieldset-label text-xs text-neutral-400">{t("tapDanceTappingTerm")}</label>
              <div className="mb-1.5 flex items-center gap-1.5">
                <input
                  type="number"
                  className="input input-sm w-28"
                  min={0}
                  max={10000}
                  value={entry.tappingTerm}
                  onChange={(e) => onSave?.({ tappingTerm: Number(e.target.value) })}
                />
                <span className="text-xs text-neutral-500">{t("msUnit")}</span>
              </div>

              {/* Same 2x2 arrangement as the front face's grid, so a field's position doesn't
                  move when the card flips between display and edit state. */}
              <div className="grid grid-cols-2 gap-2">
                {PREVIEW_STATES.map(({ labelKey, field }) => {
                  const configured = (entry[field] as string) !== "KC_NO";
                  return (
                    <div key={field}>
                      <label className="fieldset-label text-xs text-neutral-400">{t(labelKey)}</label>
                      <KeySlot
                        qmkId={entry[field] as string}
                        onChange={(id) => onSave?.({ [field]: id } as Partial<TapDanceEntry>)}
                        className={`btn btn-sm min-h-9 w-full flex-wrap py-0.5 text-xs whitespace-pre-line ${
                          configured ? "btn-soft" : "btn-dash"
                        }`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
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

const isUsed = (e: TapDanceEntry) =>
  e.onTap !== "KC_NO" || e.onHold !== "KC_NO" || e.onDoubleTap !== "KC_NO" || e.onTapHold !== "KC_NO";

export function TapDancePanel({ keyboard, onChange }: Props) {
  const { t } = useI18n();
  const { showToast } = useToast();
  /** Index of a freshly added, still-unused slot being edited; shown even though it's not "used" yet. */
  const [addingIndex, setAddingIndex] = useState<number | null>(null);

  if (keyboard.tapDanceCount === 0) {
    return <p className="text-brand-on-surface-variant">{t("tapDanceNone")}</p>;
  }

  const usedCount = keyboard.tapDanceEntries.filter(isUsed).length;

  const updateAt = async (idx: number, patch: Partial<TapDanceEntry>) => {
    try {
      await keyboard.setTapDance(idx, { ...keyboard.tapDanceEntries[idx], ...patch });
    } catch (err) {
      showToast(err instanceof Error ? err.message : String(err));
    } finally {
      onChange();
    }
  };

  const clearAt = (idx: number) =>
    void updateAt(idx, { onTap: "KC_NO", onHold: "KC_NO", onDoubleTap: "KC_NO", onTapHold: "KC_NO", tappingTerm: 200 });

  const handleAdd = () => {
    const freeIdx = keyboard.tapDanceEntries.findIndex((e) => !isUsed(e));
    if (freeIdx === -1) {
      showToast(t("tapDanceFull"));
      return;
    }
    setAddingIndex(freeIdx);
  };

  const visibleIndices = keyboard.tapDanceEntries
    .map((_, i) => i)
    .filter((i) => isUsed(keyboard.tapDanceEntries[i]) || i === addingIndex);

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-md text-xs text-brand-on-surface-variant">{t("tapDanceHint")}</p>
      <div className="flex items-center gap-3">
        <progress className="progress w-40" value={usedCount} max={Math.max(keyboard.tapDanceCount, 1)} />
        <span className="text-xs text-brand-on-surface-variant">
          {t("tapDanceUsed", { used: usedCount, total: keyboard.tapDanceCount })}
        </span>
        <button type="button" className="btn btn-primary btn-sm" onClick={handleAdd}>
          {t("tapDanceAdd")}
        </button>
      </div>
      <div className="flex flex-wrap gap-4">
        {visibleIndices.length === 0 ? (
          <p className="text-sm text-brand-on-surface-variant">{t("tapDanceEmpty")}</p>
        ) : (
          visibleIndices.map((i) => (
            <TapDancePreviewCard
              key={i}
              index={i}
              entry={keyboard.tapDanceEntries[i]}
              onSave={(patch) => void updateAt(i, patch)}
              onDelete={() => clearAt(i)}
              startInEditMode={i === addingIndex}
              onCollapse={i === addingIndex ? () => setAddingIndex(null) : undefined}
            />
          ))
        )}
      </div>
    </div>
  );
}
