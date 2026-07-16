import { useState } from "react";
import {
  KEYCODE_CATEGORIES,
  isBasicQmkId,
  label as kcLabel,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import { CATEGORY_KEYS, deviceCategories } from "../common/KeycodePicker.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { QuickConfig104, QUICK_CONFIG_QMK_IDS } from "./QuickConfig104.tsx";

/** Categories hidden from the inline homepage picker. */
const HIDDEN_CATEGORIES: ReadonlySet<string> = new Set([
  "ISO/International",
  "Navigation",
  "Shifted",
  "Numpad",
]);

/** Name of the tab that folds Fn keys, Media and Mouse into one. */
const MERGED_NAME = "Fn/Media/Mouse";
/** Source categories merged under {@link MERGED_NAME}, in list order. */
const MERGE_SOURCES: ReadonlySet<string> = new Set(["Fn keys", "Media", "Mouse"]);

/** Name of the tab that folds the Macros list and the device's Tap Dance slots into one. */
const MACRO_TD_NAME = "Macros/Tap Dance";

/** A labelled block of keycodes rendered within a tab. */
interface KeycodeGroup {
  /** Translation key for the group heading; omit for an unlabelled block. */
  titleKey?: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
  /** Render the entries in a fixed 4-column grid rather than a flowing wrap. */
  grid?: boolean;
}

interface VisibleCategory {
  name: string;
  /** Flat entry list (unlabelled tabs). */
  entries: KeycodeDef[];
  /** When present, the tab renders these labelled sub-groups instead of {@link entries}. */
  groups?: KeycodeGroup[];
}

const entriesOf = (name: string): KeycodeDef[] =>
  KEYCODE_CATEGORIES.find((c) => c.name === name)?.entries ?? [];

/**
 * Split the flat "Layers" list into one labelled block per layer-switch
 * function (MO, TG, …), with anything else (FN_MO13/FN_MO23) trailing under a
 * catch-all "Other" heading.
 */
function layerGroups(): KeycodeGroup[] {
  const src = entriesOf("Layers");
  const fns: [string, MessageKey, MessageKey][] = [
    ["MO", "groupLayerMO", "groupLayerMOHelp"],
    ["TG", "groupLayerTG", "groupLayerTGHelp"],
    ["TT", "groupLayerTT", "groupLayerTTHelp"],
    ["OSL", "groupLayerOSL", "groupLayerOSLHelp"],
    ["TO", "groupLayerTO", "groupLayerTOHelp"],
    ["DF", "groupLayerDF", "groupLayerDFHelp"],
  ];
  const groups: KeycodeGroup[] = fns
    .map(([fn, titleKey, helpKey]) => ({
      titleKey,
      helpKey,
      entries: src.filter((e) => e.qmkId.startsWith(`${fn}(`)),
    }))
    .filter((g) => g.entries.length > 0);
  const rest = src.filter((e) => !fns.some(([fn]) => e.qmkId.startsWith(`${fn}(`)));
  if (rest.length > 0)
    groups.push({ titleKey: "groupLayerOther", helpKey: "groupLayerOtherHelp", entries: rest });
  return groups;
}

/**
 * Split the flat "Quantum" list into one-shot mods, held modifiers, mod-tap,
 * layer-tap, and everything else — partitioned by qmk_id shape.
 */
function quantumGroups(): KeycodeGroup[] {
  const src = entriesOf("Quantum");
  const isOSM = (id: string) => id.startsWith("OSM(");
  const isModTap = (id: string) => /_T\(kc\)$/.test(id);
  const isLayerTap = (id: string) => /^LT\d+\(/.test(id);
  const isMod = (id: string) =>
    !isOSM(id) && !isModTap(id) && !isLayerTap(id) && id.endsWith("(kc)");
  const blocks: [MessageKey, MessageKey, (id: string) => boolean][] = [
    ["groupQuantumOSM", "groupQuantumOSMHelp", isOSM],
    ["groupQuantumMods", "groupQuantumModsHelp", isMod],
    ["groupQuantumModTap", "groupQuantumModTapHelp", isModTap],
    ["groupQuantumLayerTap", "groupQuantumLayerTapHelp", isLayerTap],
  ];
  const groups: KeycodeGroup[] = blocks
    .map(([titleKey, helpKey, pred]) => ({
      titleKey,
      helpKey,
      entries: src.filter((e) => pred(e.qmkId)),
    }))
    .filter((g) => g.entries.length > 0);
  const rest = src.filter(
    (e) => !blocks.some(([, , pred]) => pred(e.qmkId)),
  );
  if (rest.length > 0)
    groups.push({ titleKey: "groupQuantumOther", helpKey: "groupQuantumOtherHelp", entries: rest });
  return groups;
}

/**
 * Visible tabs for the inline picker: hidden categories dropped, and the three
 * small Fn/Media/Mouse groups collapsed into a single {@link MERGED_NAME} tab
 * placed where the first of them (Fn keys) would have appeared. That merged tab
 * lays its keys out in three labelled sub-groups: the F13–F24 keys in a 3×4
 * grid, the mouse keys, then everything else.
 */
const VISIBLE_CATEGORIES = (() => {
  const out: VisibleCategory[] = [];
  let mergedAdded = false;
  for (const c of KEYCODE_CATEGORIES) {
    if (HIDDEN_CATEGORIES.has(c.name)) continue;
    if (MERGE_SOURCES.has(c.name)) {
      if (!mergedAdded) {
        mergedAdded = true;
        out.push({
          name: MERGED_NAME,
          entries: [],
          groups: [
            { titleKey: "groupFnKeys", entries: entriesOf("Fn keys"), grid: true },
            { titleKey: "groupMouse", entries: entriesOf("Mouse") },
            { titleKey: "groupOther", entries: entriesOf("Media") },
          ],
        });
      }
      continue;
    }
    out.push({
      name: c.name,
      entries: c.entries,
      groups:
        c.name === "Layers"
          ? layerGroups()
          : c.name === "Quantum"
            ? quantumGroups()
            : undefined,
    });
  }
  return out;
})();

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
  const [active, setActive] = useState(VISIBLE_CATEGORIES[0].name);
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

  // Device-specific tabs (custom keycodes, tap dance) are appended live so they
  // appear only when a keyboard exposing them is connected. Tap Dance isn't a
  // tab of its own: it's folded into the Macros tab as a labelled sub-group (so
  // one "Macros / Tap Dance" tab covers both), mirroring the Fn/Media/Mouse
  // merge. When the device has no tap-dance slots the Macros tab stays as-is.
  const device = deviceCategories();
  const tapDance = device.find((c) => c.name === "Tap Dance" && c.entries.length > 0);
  const otherDevice = device.filter((c) => c.name !== "Tap Dance");
  const base = tapDance
    ? VISIBLE_CATEGORIES.map((c): VisibleCategory =>
        c.name === "Macros"
          ? {
              name: MACRO_TD_NAME,
              entries: [],
              groups: [
                { titleKey: "groupMacros", entries: c.entries },
                { titleKey: "groupTapDance", entries: tapDance.entries },
              ],
            }
          : c,
      )
    : VISIBLE_CATEGORIES;
  const allCategories: VisibleCategory[] = [...base, ...otherDevice];
  const activeCat = allCategories.find((c) => c.name === active) ?? allCategories[0];
  const isBasic = activeCat.name === "Basic";
  const entries = isBasic
    ? activeCat.entries.filter((e) => !QUICK_CONFIG_QMK_IDS.has(e.qmkId))
    : activeCat.entries;

  const keyButton = (entry: KeycodeDef) => (
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
  );

  return (
    <div>
      <div role="tablist" className="tabs tabs-box w-fit">
        {allCategories.map((cat) => (
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
          <QuickConfig104
            scale={1.2}
            className="qc-compact-icons"
            onPick={(id) => pick({ qmkId: id, label: kcLabel(id) })}
          />
        </div>
      )}
      {activeCat.groups
        ? activeCat.groups.map((group) => (
            <div key={group.titleKey ?? ""} className="mt-3">
              {group.titleKey && (
                <h4 className="mb-1 flex items-center gap-1 text-sm font-semibold">
                  <span className="opacity-70">{t(group.titleKey)}</span>
                  {group.helpKey && <HelpIcon text={t(group.helpKey)} />}
                </h4>
              )}
              {group.grid ? (
                <div className="grid w-fit grid-cols-4 gap-1">
                  {group.entries.map(keyButton)}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1">{group.entries.map(keyButton)}</div>
              )}
            </div>
          ))
        : entries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">{entries.map(keyButton)}</div>
          )}
    </div>
  );
}
