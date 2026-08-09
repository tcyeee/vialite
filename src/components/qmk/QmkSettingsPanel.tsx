import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@iconify/react";
import { useI18n, type MessageKey, type Translate } from "../../contexts/i18n.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { ComboSettings } from "./ComboSettings.tsx";
import { GraveEscapeSettings } from "./GraveEscapeSettings.tsx";
import { MagicSettings } from "./MagicSettings.tsx";
import { MouseKeySettings } from "./MouseKeySettings.tsx";
import { OneShotSettings } from "./OneShotSettings.tsx";
import { TapHoldSettings } from "./TapHoldSettings.tsx";
import { QmkSettingsToc } from "./QmkSettingsToc.tsx";
import { useWriteError } from "../../hooks/useWriteError.ts";

interface Props {
  keyboard: Keyboard;
  /**
   * Reports the titleKeys of every section actually rendered (in DOM order), so a sidebar table
   * of contents can be built without duplicating each section's own visibility logic.
   */
  onSectionsChange?: (sections: MessageKey[]) => void;
  /** Called whenever the number of not-yet-written QMK-setting edits changes. */
  onPendingCountChange?: (count: number) => void;
  /**
   * Set by a parent that wants to navigate away while edits are still pending — the panel then
   * shows a "save/discard/cancel" dialog and reports the outcome via `onLeaveResolved` instead of
   * the parent navigating immediately.
   */
  leaveRequested?: boolean;
  onLeaveResolved?: (shouldLeave: boolean) => void;
}

/** One row of a daisyUI `list`: icon + label(/description) on the left, a control on the right. */
export function SettingsRow({
  icon,
  label,
  badge,
  description,
  help,
  control,
  disabled = false,
  className = "",
  labelClassName = "",
  collapsed,
}: {
  icon: ReactNode;
  label: string;
  /** Optional inline tag rendered right of the label (e.g. a "Beta" badge). */
  badge?: ReactNode;
  description?: string;
  /** Optional help text; renders a "?" HelpIcon with this tooltip next to the label. */
  help?: string;
  control: ReactNode;
  /** Grey the row and show a not-allowed cursor when the setting is inert. */
  disabled?: boolean;
  /** Extra classes on the row element (e.g. `settings-row-collapse`). */
  className?: string;
  /** Extra classes on the label `<span>` (e.g. `whitespace-nowrap`). */
  labelClassName?: string;
  /**
   * When set, the row animates its height in/out (see `.settings-row-collapse`)
   * instead of unmounting, and is taken out of the tab order while collapsed.
   * Leave undefined for rows that are always visible.
   */
  collapsed?: boolean;
}) {
  return (
    <li
      className={`list-row items-center ${disabled ? "cursor-not-allowed opacity-40" : ""} ${
        collapsed === undefined ? "" : "settings-row-collapse"
      } ${className}`}
      {...(collapsed === undefined ? {} : { "data-open": String(!collapsed) })}
      inert={collapsed === true}
    >
      <div className="btn btn-circle btn-ghost pointer-events-none text-brand-on-surface">{icon}</div>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium text-brand-on-surface ${labelClassName}`}>{label}</span>
          {badge}
          {help && <HelpIcon text={help} />}
        </div>
        {description && <div className="truncate text-xs opacity-60">{description}</div>}
      </div>
      {control}
    </li>
  );
}

/**
 * One field within some QMK Settings qsid (see `Keyboard.getQmkSettingBit`/
 * `getQmkSettingValue`). Each field names its own qsid — unlike Magic/Grave
 * Escape, a single tab like Tap-Hold spans several unrelated qsids, one per
 * field or small group of fields.
 */
export type QmkSettingField =
  | { type: "boolean"; qsid: number; bit: number; labelKey: MessageKey; helpKey?: MessageKey }
  | { type: "integer"; qsid: number; min: number; max: number; labelKey: MessageKey; unitKey: MessageKey; helpKey?: MessageKey };

/**
 * A field the user has edited but not yet confirmed. Edits to `QmkSettingField`s
 * are staged here instead of being written to the keyboard immediately; only a
 * section's own "Confirm changes" dialog (or the page-leave dialog) actually
 * calls into `Keyboard`, via `QmkPendingContextValue.commit`.
 */
interface PendingQmkChange {
  key: string;
  labelKey: MessageKey;
  unitKey?: MessageKey;
  committedValue: number | boolean;
  pendingValue: number | boolean;
  apply: () => Promise<void>;
}

function pendingChangeKey(field: QmkSettingField): string {
  return field.type === "boolean" ? `${field.qsid}:bit:${field.bit}` : `${field.qsid}:value`;
}

function formatPendingValue(t: Translate, change: PendingQmkChange, value: number | boolean): string {
  if (typeof value === "boolean") {
    return value ? t("qmkValueOn") : t("qmkValueOff");
  }
  return change.unitKey ? `${value} ${t(change.unitKey)}` : `${value}`;
}

interface QmkPendingContextValue {
  pending: Map<string, PendingQmkChange>;
  stage: (change: PendingQmkChange) => void;
  /** Drops the given keys from `pending` without writing them — used by a section's Cancel button. */
  discard: (keys: string[]) => void;
  /** Writes the given keys' changes to the keyboard, then drops them from `pending`. */
  commit: (keys: string[]) => Promise<void>;
}

const QmkPendingContext = createContext<QmkPendingContextValue>({
  pending: new Map(),
  stage: () => {},
  discard: () => {},
  commit: async () => {},
});

/** A small "N pending" ring + Cancel/Confirm pair, shown after a section's title once it has edits. */
function SectionPendingControls({
  keys,
  onOpenConfirm,
}: {
  keys: string[];
  onOpenConfirm: () => void;
}) {
  const { t } = useI18n();
  const { discard } = useContext(QmkPendingContext);
  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => discard(keys)}>
        {t("cancel")}
      </button>
      <button type="button" className="btn btn-primary btn-sm" onClick={onOpenConfirm}>
        {t("qmkConfirmChanges")}
      </button>
    </div>
  );
}

/** Lists `keys`' pending changes and, on confirm, writes them all via `commit`. Shared by sections and the page-leave dialog. */
function PendingChangesModal({
  keys,
  changes,
  onCancel,
  onConfirmed,
}: {
  keys: string[];
  changes: PendingQmkChange[];
  onCancel: () => void;
  onConfirmed: () => void;
}) {
  const { t } = useI18n();
  const { commit } = useContext(QmkPendingContext);
  const [applying, setApplying] = useState(false);

  const confirm = async () => {
    setApplying(true);
    try {
      await commit(keys);
    } finally {
      setApplying(false);
      onConfirmed();
    }
  };

  return (
    <div className="modal modal-open">
      <div className="modal-box">
        <h3 className="text-lg font-bold text-brand-on-surface">{t("qmkConfirmModalTitle")}</h3>
        <p className="py-2 text-sm text-brand-on-surface-variant">{t("qmkConfirmModalHint")}</p>
        <ul className="list rounded-box border border-brand-outline/30">
          {changes.map((change) => (
            <li key={change.key} className="list-row items-center py-2">
              <div className="min-w-0 text-sm text-brand-on-surface">{t(change.labelKey)}</div>
              <div className="text-sm text-brand-on-surface-variant">
                {formatPendingValue(t, change, change.committedValue)} → {formatPendingValue(t, change, change.pendingValue)}
              </div>
            </li>
          ))}
        </ul>
        <div className="modal-action">
          <button type="button" className="btn" onClick={onCancel} disabled={applying}>
            {t("cancel")}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => void confirm()} disabled={applying}>
            {t("qmkConfirmApply")}
          </button>
        </div>
      </div>
      <button type="button" className="modal-backdrop" aria-label={t("cancel")} onClick={onCancel} />
    </div>
  );
}

/**
 * A titled `list` of QMK Settings fields; renders (and only renders) when at
 * least one field's qsid is supported by the connected device — mirrors
 * vial-gui's "don't bother creating tabs that would be empty" rule. Fields
 * whose qsid isn't supported are skipped individually. Edits are staged via
 * `QmkPendingContext` rather than written straight to the keyboard: a dirty
 * field gets an aura ring on the card, and the title row grows Cancel/Confirm
 * buttons that discard or (via a summary dialog) commit just this section's
 * edits.
 */
export function QmkSettingsSection({
  keyboard,
  titleKey,
  fields,
  icon,
}: {
  keyboard: Keyboard;
  titleKey: MessageKey;
  fields: QmkSettingField[];
  icon: ReactNode;
}) {
  const { t } = useI18n();
  const { pending, stage } = useContext(QmkPendingContext);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const supported = fields.filter((f) => keyboard.supportsQmkSetting(f.qsid));
  if (supported.length === 0) {
    return null;
  }

  const sectionKeys = supported.map(pendingChangeKey);
  const sectionPendingKeys = sectionKeys.filter((key) => pending.has(key));
  const sectionDirty = sectionPendingKeys.length > 0;

  return (
    <section id={titleKey} data-qmk-toc>
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-brand-on-surface-variant">{t(titleKey)}</h2>
        {sectionDirty && <SectionPendingControls keys={sectionPendingKeys} onOpenConfirm={() => setConfirmOpen(true)} />}
      </div>
      <ul
        className={
          sectionDirty
            ? "list rounded-box border border-brand-outline/30 shadow-[0_0_20px_-4px] shadow-warning/70 ring-2 ring-warning transition-shadow"
            : "list rounded-box border border-brand-outline/30 transition-shadow"
        }
      >
        {supported.map((field, i) => {
          const key = pendingChangeKey(field);
          const staged = pending.get(key);
          const committedValue =
            field.type === "boolean" ? keyboard.getQmkSettingBit(field.qsid, field.bit) : (keyboard.getQmkSettingValue(field.qsid) ?? field.min);
          const displayValue = staged ? staged.pendingValue : committedValue;

          return (
            <SettingsRow
              key={i}
              icon={icon}
              label={t(field.labelKey)}
              help={field.helpKey ? t(field.helpKey) : undefined}
              control={
                field.type === "boolean" ? (
                  <input
                    type="checkbox"
                    className="toggle mr-2"
                    checked={displayValue as boolean}
                    onChange={(e) =>
                      stage({
                        key,
                        labelKey: field.labelKey,
                        committedValue,
                        pendingValue: e.target.checked,
                        apply: () => keyboard.setQmkSettingBit(field.qsid, field.bit, e.target.checked),
                      })
                    }
                    aria-label={t(field.labelKey)}
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      className="input input-sm w-24"
                      min={field.min}
                      max={field.max}
                      value={displayValue as number}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (!Number.isNaN(v)) {
                          const clamped = Math.min(field.max, Math.max(field.min, v));
                          stage({
                            key,
                            labelKey: field.labelKey,
                            unitKey: field.unitKey,
                            committedValue,
                            pendingValue: clamped,
                            apply: () => keyboard.setQmkSettingValue(field.qsid, clamped),
                          });
                        }
                      }}
                      aria-label={t(field.labelKey)}
                    />
                    <span className="w-12 shrink-0 text-xs text-brand-on-surface-variant">{t(field.unitKey)}</span>
                  </div>
                )
              }
            />
          );
        })}
      </ul>
      {confirmOpen && (
        <PendingChangesModal
          keys={sectionPendingKeys}
          changes={sectionPendingKeys.map((key) => pending.get(key)).filter((c): c is PendingQmkChange => c !== undefined)}
          onCancel={() => setConfirmOpen(false)}
          onConfirmed={() => setConfirmOpen(false)}
        />
      )}
    </section>
  );
}

export function QmkSettingsPanel({
  keyboard,
  onSectionsChange,
  onPendingCountChange,
  leaveRequested,
  onLeaveResolved,
}: Props) {
  const { t } = useI18n();
  const onWriteError = useWriteError();
  const containerRef = useRef<HTMLDivElement>(null);
  const [pending, setPending] = useState<Map<string, PendingQmkChange>>(new Map());
  // Same list that's reported upward via onSectionsChange, kept here so the sidebar TOC can be
  // rendered from it (see the DOM scan below).
  const [sections, setSections] = useState<MessageKey[]>([]);
  const [leaveApplying, setLeaveApplying] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetApplying, setResetApplying] = useState(false);
  // A board with no QMK Settings qsids at all still gets the whole page,
  // greyed out and inert behind an explanatory banner — mirrors RgbPanel's
  // treatment of a board with no VialRGB lighting (see `supportsVialRgb`).
  // Every *Settings section below already renders null when its own qsids
  // aren't supported, so in this state they contribute nothing visible;
  // the banner is what actually tells the user why the page looks empty.
  const supported = keyboard.supportsQmkSettings;

  // Scan for whichever sections actually rendered (some hide themselves when the connected
  // keyboard doesn't expose their qsid) instead of re-deriving each section's own visibility rule.
  // Runs on every render (no dep array) — both consumers bail out when the list is unchanged, so
  // this settles instead of looping.
  useLayoutEffect(() => {
    const ids = Array.from(containerRef.current?.querySelectorAll<HTMLElement>("[data-qmk-toc]") ?? []).map(
      (el) => el.id as MessageKey,
    );
    setSections((prev) => (prev.length === ids.length && prev.every((id, i) => id === ids[i]) ? prev : ids));
    onSectionsChange?.(ids);
  });

  useEffect(() => {
    onPendingCountChange?.(pending.size);
  }, [pending, onPendingCountChange]);

  const stage = (change: PendingQmkChange) => {
    setPending((prev) => {
      const next = new Map(prev);
      if (change.pendingValue === change.committedValue) {
        next.delete(change.key);
      } else {
        next.set(change.key, change);
      }
      return next;
    });
  };

  const discard = (keys: string[]) => {
    setPending((prev) => {
      const next = new Map(prev);
      keys.forEach((key) => next.delete(key));
      return next;
    });
  };

  const commit = async (keys: string[]) => {
    const changes = keys.map((key) => pending.get(key)).filter((c): c is PendingQmkChange => c !== undefined);
    // Written so far, so a failure part-way through a batch only clears what actually reached
    // the device — the rest stay pending, still showing the user what didn't land. Without the
    // catch the rejection escaped the modal's `finally` entirely and vanished into an unhandled
    // promise, which is how a failed write ended up looking like nothing happening at all.
    const written: string[] = [];
    try {
      for (const change of changes) {
        await change.apply();
        written.push(change.key);
      }
    } catch (err) {
      onWriteError(err);
    }
    setPending((prev) => {
      const next = new Map(prev);
      written.forEach((key) => next.delete(key));
      return next;
    });
  };

  const resetAll = async () => {
    setResetApplying(true);
    try {
      await keyboard.resetLayoutOptions();
      await keyboard.resetQmkSettings();
    } catch (err) {
      onWriteError(err);
    } finally {
      setResetApplying(false);
      setResetConfirmOpen(false);
      setPending(new Map());
    }
  };

  return (
    <QmkPendingContext.Provider value={{ pending, stage, discard, commit }}>
      {/* 左侧目录 + 右侧设置内容。目录只列出实际渲染出来的分区(见上面的 DOM 扫描),
          所以键盘不支持某个 qsid 时,那一项也不会出现在目录里。 */}
      <div className="flex items-start gap-8">
        {/* 左侧栏吸顶铺满视口高度,「全部重置」用 mt-auto 顶到栏底;没有任何分区可列时
            (键盘不支持 QMK Settings)不撑高,否则空荡荡的一栏会凭空给页面加出滚动条。 */}
        <div
          className={`sticky top-6 flex w-48 shrink-0 flex-col ${
            sections.length > 0 ? "h-[calc(100vh-3rem)]" : ""
          }`}
        >
          {sections.length > 0 && <QmkSettingsToc sections={sections} />}
          <div className="mt-auto pt-4">
            <button
              type="button"
              className="btn btn-outline btn-sm w-full gap-1.5"
              onClick={() => setResetConfirmOpen(true)}
              disabled={!supported}
            >
              <Icon icon="mdi:restore" className="h-4 w-4" />
              {t("resetAllShort")}
            </button>
          </div>
        </div>
        <div ref={containerRef} className="flex min-w-0 flex-1 flex-col gap-10">
          {!supported && (
            <div role="alert" className="alert alert-warning">
              <Icon icon="mdi:alert-outline" className="h-5 w-5 shrink-0" />
              <span>{t("qmkSettingsUnsupported")}</span>
            </div>
          )}
          <div
            className={supported ? "flex flex-col gap-10" : "flex flex-col gap-10 select-none opacity-40"}
            inert={!supported}
            aria-disabled={!supported}
          >
            <MagicSettings keyboard={keyboard} />
            <GraveEscapeSettings keyboard={keyboard} />
            <TapHoldSettings keyboard={keyboard} />
            <ComboSettings keyboard={keyboard} />
            <OneShotSettings keyboard={keyboard} />
            <MouseKeySettings keyboard={keyboard} />
          </div>
        </div>
      </div>
      {resetConfirmOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold text-brand-on-surface">{t("resetAllSettings")}</h3>
            <p className="py-2 text-sm text-brand-on-surface-variant">{t("resetAllSettingsConfirm")}</p>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => setResetConfirmOpen(false)} disabled={resetApplying}>
                {t("cancel")}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => void resetAll()} disabled={resetApplying}>
                {t("qmkConfirmApply")}
              </button>
            </div>
          </div>
          <button
            type="button"
            className="modal-backdrop"
            aria-label={t("cancel")}
            onClick={() => setResetConfirmOpen(false)}
          />
        </div>
      )}
      {leaveRequested && pending.size > 0 && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-bold text-brand-on-surface">{t("qmkLeaveTitle")}</h3>
            <p className="py-2 text-sm text-brand-on-surface-variant">{t("qmkLeaveHint")}</p>
            <div className="modal-action">
              <button type="button" className="btn" onClick={() => onLeaveResolved?.(false)} disabled={leaveApplying}>
                {t("cancel")}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={leaveApplying}
                onClick={() => {
                  setPending(new Map());
                  onLeaveResolved?.(true);
                }}
              >
                {t("qmkLeaveDiscard")}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={leaveApplying}
                onClick={async () => {
                  setLeaveApplying(true);
                  try {
                    await commit(Array.from(pending.keys()));
                  } finally {
                    setLeaveApplying(false);
                    onLeaveResolved?.(true);
                  }
                }}
              >
                {t("qmkLeaveSave")}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" aria-label={t("cancel")} onClick={() => onLeaveResolved?.(false)} />
        </div>
      )}
    </QmkPendingContext.Provider>
  );
}

