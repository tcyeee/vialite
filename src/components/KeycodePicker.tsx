import { useCallback, useEffect, useMemo, useState } from "react";
import {
  KEYCODE_CATEGORIES,
  deserialize,
  isBasicQmkId,
  label as kcLabel,
  serialize,
  type KeycodeDef,
} from "../protocol/keycodes.ts";
import { EVENT_CODE_TO_QMK } from "./keyEventMap.ts";

interface Props {
  onPick: (qmkId: string) => void;
  onClose: () => void;
}

export function KeycodePicker({ onPick, onClose }: Props) {
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
          setHint(`${entry.qmkId} cannot be nested inside ${pending.qmkId}; pick a basic key`);
          return;
        }
        onPick(pending.qmkId.replace("kc", entry.qmkId));
        return;
      }
      onPick(entry.qmkId);
    },
    [pending, onPick],
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
          setHint(`no keycode mapping for "${e.code}"`);
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
  }, [listening, pending, onClose, pickByQmkId]);

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

  return (
    <div className="picker-overlay" onClick={onClose}>
      <div className="picker" onClick={(e) => e.stopPropagation()}>
        <div className="picker-toolbar">
          <input
            type="search"
            placeholder="Search keycodes…"
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            className={listening ? "listen-toggle active" : "listen-toggle"}
            title="Press a key on your active keyboard to assign it"
            onClick={() => {
              setListening((v) => !v);
              setHint(null);
            }}
          >
            {listening ? "Listening… (Esc to stop)" : "Assign by keypress"}
          </button>
        </div>
        <div className="picker-anykey">
          <input
            type="text"
            placeholder="Any key: e.g. LT(2,KC_A), LCTL(KC_C), 0x5c00"
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
          <button onClick={submitAny}>Set</button>
        </div>
        {anyError && <p className="picker-error">{anyError}</p>}
        {pending && (
          <div className="picker-pending">
            <span>{pending.qmkId.replace("kc", "…")} — now pick the inner key</span>
            <button onClick={() => setPending(null)}>Cancel</button>
          </div>
        )}
        {hint && <p className="picker-error">{hint}</p>}
        {categories.map((category) => (
          <section key={category.name}>
            <h4>{category.name}</h4>
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
        {categories.length === 0 && <p>No keycodes match “{query}”.</p>}
      </div>
    </div>
  );
}
