import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  KEYCODE_CATEGORIES,
  customKeycodeDefs,
  deserialize,
  isBasicQmkId,
  label as kcLabel,
  serialize,
  tapDanceKeycodeDefs,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import { EVENT_CODE_TO_QMK } from "../keymap/keyEventMap.ts";
import { QuickConfig104, QUICK_CONFIG_QMK_IDS } from "../keymap/QuickConfig104.tsx";

/** Maps KEYCODE_CATEGORIES names (defined in keycodes.ts) to translation keys. */
export const CATEGORY_KEYS: Record<string, MessageKey> = {
  Basic: "categoryBasic",
  Numpad: "categoryNumpad",
  Navigation: "categoryNavigation",
  Shifted: "categoryShifted",
  "ISO/International": "categoryIso",
  "Fn keys": "categoryFn",
  Layers: "categoryLayers",
  Quantum: "categoryQuantum",
  Macros: "categoryMacros",
  Media: "categoryMedia",
  Mouse: "categoryMouse",
  Lighting: "categoryLighting",
  "Fn/Media/Mouse": "categoryFnMediaMouse",
  Custom: "categoryCustom",
  "Tap Dance": "categoryTapDance",
  "Macros/Tap Dance": "categoryMacrosTapDance",
};

/** Categories hidden from the advanced picker (both browse and search). */
const HIDDEN_CATEGORIES: ReadonlySet<string> = new Set(["ISO/International", "Numpad", "Shifted"]);
const VISIBLE_CATEGORIES = KEYCODE_CATEGORIES.filter((c) => !HIDDEN_CATEGORIES.has(c.name));

/**
 * Categories that only exist once a keyboard is connected: its custom keycodes
 * (Bluetooth switches, etc.) and tap-dance slots. Read live from the keycode
 * registry so they reflect whichever device is attached, and omitted entirely
 * when the device defines none.
 */
export function deviceCategories(): { name: string; entries: KeycodeDef[] }[] {
  const out: { name: string; entries: KeycodeDef[] }[] = [];
  const custom = customKeycodeDefs();
  if (custom.length > 0) out.push({ name: "Custom", entries: [...custom] });
  const tapDance = tapDanceKeycodeDefs();
  if (tapDance.length > 0) out.push({ name: "Tap Dance", entries: [...tapDance] });
  return out;
}

interface Props {
  onPick: (qmkId: string) => void;
  onClose: () => void;
}

export function KeycodePicker({ onPick, onClose }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  // Masked template (e.g. "LCTL_T(kc)") waiting for its inner basic key.
  const [pending, setPending] = useState<KeycodeDef | null>(null);
  const [listening, setListening] = useState(false);
  const [anyValue, setAnyValue] = useState("");
  const [anyError, setAnyError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const pick = useCallback(
    (entry: KeycodeDef) => {
      setHint(null);
      if (entry.masked) {
        setPending(entry);
        return;
      }
      if (pending) {
        if (!isBasicQmkId(entry.qmkId)) {
          setHint(t("cannotNest", { qmkId: entry.qmkId, template: pending.qmkId }));
          return;
        }
        onPick(pending.qmkId.replace("kc", entry.qmkId));
        return;
      }
      onPick(entry.qmkId);
    },
    [pending, onPick, t],
  );

  const pickByQmkId = useCallback(
    (qmkId: string) => {
      pick({ qmkId, label: kcLabel(qmkId) });
    },
    [pick],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (listening) {
        e.preventDefault();
        e.stopPropagation();
        if (e.code === "Escape") {
          setListening(false);
          return;
        }
        const qmkId = EVENT_CODE_TO_QMK[e.code];
        if (qmkId) {
          pickByQmkId(qmkId);
        } else {
          setHint(t("noKeyMapping", { code: e.code }));
        }
        return;
      }
      if (e.key === "Escape") {
        if (pending) {
          setPending(null);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handler, true);
    return () => document.removeEventListener("keydown", handler, true);
  }, [listening, pending, onClose, pickByQmkId, t]);

  const submitAny = () => {
    const text = anyValue.trim();
    if (!text) {
      return;
    }
    try {
      const code = deserialize(text);
      setAnyError(null);
      // Normalize to the canonical qmk_id so the keymap stores a value that
      // round-trips through serialize().
      onPick(serialize(code));
    } catch (err) {
      setAnyError(err instanceof Error ? err.message : String(err));
    }
  };

  const q = query.trim().toLowerCase();
  const categories = useMemo(() => {
    const all = [...VISIBLE_CATEGORIES, ...deviceCategories()];
    // When the 104-key board is visible (no active search), hide the keys it
    // already exposes so the category lists don't duplicate them.
    if (!q) {
      return all
        .map((cat) => ({
          name: cat.name,
          entries: cat.entries.filter((e) => !QUICK_CONFIG_QMK_IDS.has(e.qmkId)),
        }))
        .filter((cat) => cat.entries.length > 0);
    }
    return all
      .map((cat) => ({
        name: cat.name,
        entries: cat.entries.filter(
          (e) =>
            e.qmkId.toLowerCase().includes(q) ||
            e.label.toLowerCase().includes(q) ||
            (e.title?.toLowerCase().includes(q) ?? false),
        ),
      }))
      .filter((cat) => cat.entries.length > 0);
  }, [q]);

  return createPortal(
    <div className="modal modal-open">
      <div className="modal-box max-w-5xl">
        <div className="mb-2 flex gap-2">
          <input
            type="search"
            className="input input-sm flex-1"
            placeholder={t("searchPlaceholder")}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={`btn btn-sm ${listening ? "btn-error" : "btn-ghost"}`}
            title={t("listenTooltip")}
            onClick={() => {
              setListening((v) => !v);
              setHint(null);
            }}
          >
            {listening ? t("listening") : t("assignByKeypress")}
          </button>
          <button className="btn btn-sm btn-circle btn-ghost" aria-label={t("cancel")} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="join mb-2 flex w-full">
          <input
            type="text"
            className="input input-sm join-item flex-1"
            placeholder={t("anyKeyPlaceholder")}
            value={anyValue}
            onChange={(e) => {
              setAnyValue(e.target.value);
              setAnyError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                submitAny();
              }
            }}
          />
          <button className="btn btn-sm btn-primary join-item" onClick={submitAny}>
            {t("set")}
          </button>
        </div>
        {anyError && (
          <div className="alert alert-error alert-soft mb-2 py-1 text-sm">
            <span>{anyError}</span>
          </div>
        )}
        {pending && (
          <div className="alert alert-info alert-soft mb-2 flex items-center py-1 text-sm">
            <span>{t("pickInnerKey", { template: pending.qmkId.replace("kc", "…") })}</span>
            <button className="btn btn-xs ml-auto" onClick={() => setPending(null)}>
              {t("cancel")}
            </button>
          </div>
        )}
        {hint && (
          <div className="alert alert-warning alert-soft mb-2 py-1 text-sm">
            <span>{hint}</span>
          </div>
        )}
        {!q && (
          <section>
            <h4 className="mt-3 mb-1 text-sm font-semibold opacity-70">{t("quickConfigTitle")}</h4>
            <div className="overflow-x-auto pb-1">
              <QuickConfig104 onPick={pickByQmkId} />
            </div>
          </section>
        )}
        {categories.map((category) => (
          <section key={category.name}>
            <h4 className="mt-3 mb-1 text-sm font-semibold opacity-70">
              {CATEGORY_KEYS[category.name] ? t(CATEGORY_KEYS[category.name]) : category.name}
            </h4>
            <div className="flex flex-wrap gap-1">
              {category.entries.map((entry) => (
                <button
                  key={entry.qmkId}
                  className={`btn btn-sm btn-outline h-auto min-h-8 min-w-12 whitespace-pre-line py-1 font-normal normal-case leading-tight${
                    entry.masked ? " italic" : ""
                  }`}
                  title={entry.title ?? entry.qmkId}
                  onClick={() => pick(entry)}
                >
                  {entry.label || entry.qmkId}
                </button>
              ))}
            </div>
          </section>
        ))}
        {categories.length === 0 && <p className="text-sm">{t("noMatch", { query })}</p>}
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>,
    document.body,
  );
}
