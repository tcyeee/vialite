import { useState } from "react";
import {
  KEYCODE_CATEGORIES,
  isBasicQmkId,
  label as kcLabel,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { useI18n } from "../../contexts/i18n.tsx";
import { CATEGORY_KEYS } from "../common/KeycodePicker.tsx";
import { QuickConfig104, QUICK_CONFIG_QMK_IDS } from "./QuickConfig104.tsx";

interface Props {
  onPick: (qmkId: string) => void;
}

/**
 * Inline, tabbed keycode palette shown below the keyboard once a key/encoder is
 * selected. Each tab is one KEYCODE_CATEGORIES group (Basic, Media, …). The
 * Basic tab leads with the physical 104-key board (same as the modal picker)
 * and hides those keys from the flat list to avoid duplication. Masked
 * templates (Layer-Tap, Mod-Tap, …) set a pending state and wait for the user
 * to click an inner basic key, mirroring KeycodePicker's flow.
 */
export function KeycodeTabs({ onPick }: Props) {
  const { t } = useI18n();
  const [active, setActive] = useState(KEYCODE_CATEGORIES[0].name);
  const [pending, setPending] = useState<KeycodeDef | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const pick = (entry: KeycodeDef) => {
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
      setPending(null);
      return;
    }
    onPick(entry.qmkId);
  };

  const activeCat = KEYCODE_CATEGORIES.find((c) => c.name === active) ?? KEYCODE_CATEGORIES[0];
  const isBasic = activeCat.name === "Basic";
  const entries = isBasic
    ? activeCat.entries.filter((e) => !QUICK_CONFIG_QMK_IDS.has(e.qmkId))
    : activeCat.entries;

  return (
    <div>
      <div role="tablist" className="tabs tabs-box">
        {KEYCODE_CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            role="tab"
            className={`tab${cat.name === activeCat.name ? " tab-active" : ""}`}
            onClick={() => setActive(cat.name)}
          >
            {CATEGORY_KEYS[cat.name] ? t(CATEGORY_KEYS[cat.name]) : cat.name}
          </button>
        ))}
      </div>
      {pending && (
        <div className="alert alert-info alert-soft mt-3 flex items-center py-1 text-sm">
          <span>{t("pickInnerKey", { template: pending.qmkId.replace("kc", "…") })}</span>
          <button className="btn btn-xs ml-auto" onClick={() => setPending(null)}>
            {t("cancel")}
          </button>
        </div>
      )}
      {hint && (
        <div className="alert alert-warning alert-soft mt-3 py-1 text-sm">
          <span>{hint}</span>
        </div>
      )}
      {isBasic && (
        <div className="mt-3 overflow-x-auto pb-1">
          <QuickConfig104 scale={1.2} onPick={(id) => pick({ qmkId: id, label: kcLabel(id) })} />
        </div>
      )}
      {entries.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {entries.map((entry) => (
            <button
              key={entry.qmkId}
              className={`btn btn-sm btn-outline h-auto min-h-8 min-w-12 whitespace-pre-line py-1 font-normal normal-case leading-tight${
                entry.masked ? " italic" : ""
              }`}
              title={entry.qmkId}
              onClick={() => pick(entry)}
            >
              {entry.label || entry.qmkId}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
