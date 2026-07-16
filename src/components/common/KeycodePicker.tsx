import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  KEYCODE_CATEGORIES,
  deserialize,
  isBasicQmkId,
  label as kcLabel,
  serialize,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import { EVENT_CODE_TO_QMK } from "../keymap/keyEventMap.ts";

/** Maps KEYCODE_CATEGORIES names (defined in keycodes.ts) to translation keys. */
const CATEGORY_KEYS: Record<string, MessageKey> = {
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
};

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
    if (!q) {
      return KEYCODE_CATEGORIES;
    }
    return KEYCODE_CATEGORIES.map((cat) => ({
      name: cat.name,
      entries: cat.entries.filter(
        (e) => e.qmkId.toLowerCase().includes(q) || e.label.toLowerCase().includes(q),
      ),
    })).filter((cat) => cat.entries.length > 0);
  }, [q]);

  return createPortal(
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-toolbar">
          <input
            type="search"
            placeholder={t("searchPlaceholder")}
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={listening ? "listen-toggle active" : "listen-toggle"}
            title={t("listenTooltip")}
            onClick={() => {
              setListening((v) => !v);
              setHint(null);
            }}
          >
            {listening ? t("listening") : t("assignByKeypress")}
          </button>
        </div>
        <div className="picker-anykey">
          <input
            type="text"
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
          <button onClick={submitAny}>{t("set")}</button>
        </div>
        {anyError && <p className="picker-error">{anyError}</p>}
        {pending && (
          <div className="picker-pending">
            <span>{t("pickInnerKey", { template: pending.qmkId.replace("kc", "…") })}</span>
            <button onClick={() => setPending(null)}>{t("cancel")}</button>
          </div>
        )}
        {hint && <p className="picker-error">{hint}</p>}
        {categories.map((category) => (
          <section key={category.name}>
            <h4>{CATEGORY_KEYS[category.name] ? t(CATEGORY_KEYS[category.name]) : category.name}</h4>
            <div className="picker-grid">
              {category.entries.map((entry) => (
                <button
                  key={entry.qmkId}
                  className={entry.masked ? "masked" : undefined}
                  title={entry.qmkId}
                  onClick={() => pick(entry)}
                >
                  {entry.label || entry.qmkId}
                </button>
              ))}
            </div>
          </section>
        ))}
        {categories.length === 0 && <p>{t("noMatch", { query })}</p>}
      </div>
    </div>,
    document.body,
  );
}
