import { useState } from "react";
import {
  KEYCODE_CATEGORIES,
  isBasicQmkId,
  label as kcLabel,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import type { Keyboard } from "../../protocol/keyboard.ts";
import { CATEGORY_KEYS, CLEAR_LABELS, deviceCategories } from "../common/KeycodePicker.tsx";
import { HelpIcon } from "../common/HelpIcon.tsx";
import { QuickConfig104, QUICK_CONFIG_QMK_IDS } from "./QuickConfig104.tsx";
import { MacroTapDanceCards } from "./MacroTapDanceCards.tsx";
import { KeycodeCascadeSelector } from "./KeycodeCascadeSelector.tsx";
import { LayerCategoryCards } from "./LayerCategoryCards.tsx";
import { FnMediaMouseCards } from "./FnMediaMouseCards.tsx";
import { QuantumCards } from "./QuantumCards.tsx";

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

/** Name of the tab that folds Lighting and the device's Custom keycodes into one. */
const KEYBOARD_FN_NAME = "Keyboard Function";

/**
 * qmk_id → i18n key describing each Lighting keycode's concrete function, shown
 * as a HelpIcon tooltip on the key in the "Keyboard Function" tab. Custom
 * keycodes get their help text from the device-provided `title` instead.
 */
const LIGHTING_HELP: Record<string, MessageKey> = {
  BL_TOGG: "lightBlTogg",
  BL_STEP: "lightBlStep",
  BL_BRTG: "lightBlBrtg",
  BL_ON: "lightBlOn",
  BL_OFF: "lightBlOff",
  BL_INC: "lightBlInc",
  BL_DEC: "lightBlDec",
  RGB_TOG: "lightRgbTog",
  RGB_MOD: "lightRgbMod",
  RGB_RMOD: "lightRgbRmod",
  RGB_HUI: "lightRgbHui",
  RGB_HUD: "lightRgbHud",
  RGB_SAI: "lightRgbSai",
  RGB_SAD: "lightRgbSad",
  RGB_VAI: "lightRgbVai",
  RGB_VAD: "lightRgbVad",
  RGB_SPI: "lightRgbSpi",
  RGB_SPD: "lightRgbSpd",
  RGB_M_P: "lightRgbMP",
  RGB_M_B: "lightRgbMB",
  RGB_M_R: "lightRgbMR",
  RGB_M_SW: "lightRgbMSw",
  RGB_M_SN: "lightRgbMSn",
  RGB_M_K: "lightRgbMK",
  RGB_M_X: "lightRgbMX",
  RGB_M_G: "lightRgbMG",
  RGB_M_T: "lightRgbMT",
};

/** A labelled block of keycodes rendered within a tab. */
interface KeycodeGroup {
  /** Translation key for the group heading; omit for an unlabelled block. */
  titleKey?: MessageKey;
  /** Translation key for a hover help tooltip shown next to the heading. */
  helpKey?: MessageKey;
  entries: KeycodeDef[];
  /** Render the entries in a fixed 4-column grid rather than a flowing wrap. */
  grid?: boolean;
  /**
   * When present, the card body splits {@link entries} into labelled sections
   * (used by the Quantum "Other" card to fold One-Shot Mods in as a section).
   */
  sections?: { titleKey: MessageKey; helpKey?: MessageKey; entries: KeycodeDef[] }[];
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
 * Used/total slot counts and the "编辑" jump target for one Combo Keys card,
 * keyed off the sub-group's heading (Macros vs Tap Dance).
 */
function comboMeta(
  keyboard: Keyboard,
  titleKey: MessageKey,
  onNavigate: (target: ComboEditTarget) => void,
): { used: number; total: number; onEdit: () => void } {
  if (titleKey === "groupTapDance") {
    const used = keyboard.tapDanceEntries.filter(
      (e) =>
        e.onTap !== "KC_NO" ||
        e.onHold !== "KC_NO" ||
        e.onDoubleTap !== "KC_NO" ||
        e.onTapHold !== "KC_NO",
    ).length;
    return { used, total: keyboard.tapDanceCount, onEdit: () => onNavigate("tapdance") };
  }
  const used = keyboard.macros.filter((m) => m.length > 0).length;
  return { used, total: keyboard.macroCount, onEdit: () => onNavigate("macro") };
}

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
  // One-Shot Mods and everything that fits no other block are folded into a
  // single "Other" card, shown as two labelled sections inside that card.
  const osm = src.filter((e) => isOSM(e.qmkId));
  const misc = src.filter(
    (e) => !isOSM(e.qmkId) && !blocks.some(([, , pred]) => pred(e.qmkId)),
  );
  const otherSections = [
    osm.length > 0 && { titleKey: "groupQuantumOSM" as MessageKey, helpKey: "groupQuantumOSMHelp" as MessageKey, entries: osm },
    misc.length > 0 && { titleKey: "groupQuantumMisc" as MessageKey, helpKey: "groupQuantumOtherHelp" as MessageKey, entries: misc },
  ].filter((s): s is { titleKey: MessageKey; helpKey: MessageKey; entries: KeycodeDef[] } => Boolean(s));
  if (otherSections.length > 0)
    groups.push({
      titleKey: "groupQuantumOther",
      helpKey: "groupQuantumOtherHelp",
      entries: [...osm, ...misc],
      sections: otherSections,
    });
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
            { titleKey: "groupMedia", entries: entriesOf("Media") },
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

/** Editor pages the Combo Keys cards can jump to via their hover "编辑" action. */
export type ComboEditTarget = "macro" | "tapdance" | "combo";

interface Props {
  onPick: (qmkId: string) => void;
  /** Connected device, for the Combo Keys cards' used/total slot counts. */
  keyboard: Keyboard;
  /** Navigate to a dedicated editor page (the cards' "编辑" action). */
  onNavigate: (target: ComboEditTarget) => void;
}

/**
 * Inline, tabbed keycode palette shown below the keyboard once a key/encoder is
 * selected. Each tab is one KEYCODE_CATEGORIES group (Basic, Media, …). The
 * Basic tab leads with the physical 104-key board (same as the modal picker)
 * and hides those keys from the flat list to avoid duplication. Masked
 * templates (Layer-Tap, Mod-Tap, …) set a pending state and wait for the user
 * to click an inner basic key, mirroring KeycodePicker's flow.
 */
export function KeycodeTabs({ onPick, keyboard, onNavigate }: Props) {
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
  const custom = device.find((c) => c.name === "Custom" && c.entries.length > 0);
  // Custom keycodes are folded into the "Keyboard Function" tab (below), so keep
  // only any other future device categories to append separately.
  const otherDevice = device.filter((c) => c.name !== "Tap Dance" && c.name !== "Custom");
  // Lighting and the device's Custom keycodes share one "Keyboard Function" tab,
  // shown as two labelled sections (灯光 / 自定义). Custom only exists once a
  // device exposing it is connected, so its section is dropped when absent.
  const keyboardFnGroups: KeycodeGroup[] = [
    { titleKey: "categoryLighting", entries: entriesOf("Lighting") },
    ...(custom ? [{ titleKey: "categoryCustom" as MessageKey, entries: custom.entries }] : []),
  ];
  const base = VISIBLE_CATEGORIES.map((c): VisibleCategory => {
    // Fold the device's Tap Dance slots into the Macros tab as a sub-group.
    if (tapDance && c.name === "Macros") {
      return {
        name: MACRO_TD_NAME,
        entries: [],
        groups: [
          { titleKey: "groupMacros", entries: c.entries },
          { titleKey: "groupTapDance", entries: tapDance.entries },
        ],
      };
    }
    // Rename Lighting to the merged "Keyboard Function" tab and attach the
    // Lighting + Custom sub-groups.
    if (c.name === "Lighting") {
      return { name: KEYBOARD_FN_NAME, entries: [], groups: keyboardFnGroups };
    }
    return c;
  });
  const ordered: VisibleCategory[] = [...base, ...otherDevice];
  // Place the Combo Keys (Macros / Tap Dance) tab immediately after the
  // Function (Fn/Media/Mouse) tab.
  const macroIdx = ordered.findIndex((c) => c.name === MACRO_TD_NAME || c.name === "Macros");
  const fnIdx = ordered.findIndex((c) => c.name === MERGED_NAME);
  if (macroIdx !== -1 && fnIdx !== -1 && macroIdx !== fnIdx + 1) {
    const [macro] = ordered.splice(macroIdx, 1);
    ordered.splice(ordered.findIndex((c) => c.name === MERGED_NAME) + 1, 0, macro);
  }
  const allCategories: VisibleCategory[] = ordered;
  const activeCat = allCategories.find((c) => c.name === active) ?? allCategories[0];
  const isBasic = activeCat.name === "Basic";
  const entries = isBasic
    ? activeCat.entries.filter(
        (e) => !QUICK_CONFIG_QMK_IDS.has(e.qmkId) && !CLEAR_LABELS[e.qmkId],
      )
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

  // Lighting and Custom tabs share a uniform tile: fixed height, a soft
  // translucent border and fill instead of btn-outline's solid currentColor
  // border, so the flat list reads as one consistent grid.
  const tileButton = (entry: KeycodeDef) => (
    <button
      key={entry.qmkId}
      className={`btn btn-sm h-14 min-w-[4.5rem] whitespace-pre-line border border-base-content/15 bg-base-content/[0.04] py-1 font-normal normal-case leading-tight hover:border-base-content/30 hover:bg-base-content/10${
        entry.masked ? " italic" : ""
      }`}
      title={entry.title ?? entry.qmkId}
      onClick={() => pick(entry)}
    >
      {entry.label || entry.qmkId}
    </button>
  );

  // Concrete-function help text for a "Keyboard Function" key: the Lighting
  // description table, or a custom keycode's device-provided title. Returns null
  // when no meaningful description exists (so no help icon is shown).
  const helpText = (entry: KeycodeDef): string | null => {
    const key = LIGHTING_HELP[entry.qmkId];
    if (key) return t(key);
    if (entry.title && entry.title !== entry.label) return entry.title;
    return null;
  };

  // A tile with a corner HelpIcon describing its concrete function. Falls back
  // to a plain tile when no description is available. The help badge stops click
  // propagation so hovering for help never assigns the keycode.
  const tileWithHelp = (entry: KeycodeDef) => {
    const help = helpText(entry);
    if (!help) return tileButton(entry);
    return (
      <div key={entry.qmkId} className="relative">
        {tileButton(entry)}
        <span
          className="absolute right-0.5 top-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <HelpIcon text={help} />
        </span>
      </div>
    );
  };

  // The merged "Keyboard Function" tab renders its grouped keys with the uniform
  // tile look (soft translucent border/fill) plus a per-key help badge.
  const isTileGroups = activeCat.name === KEYBOARD_FN_NAME;
  const groupButton = activeCat.name === KEYBOARD_FN_NAME ? tileWithHelp : keyButton;
  const groupGap = isTileGroups ? "gap-2" : "gap-1";

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
      {isBasic && (
        // KC_NO / KC_TRNS aren't physical keys on the 104 board; surface them as
        // two plainly-labelled buttons (清空按键 / 设置为穿透) with explanatory
        // tooltips instead of the raw id / "▽" glyph the flat list would show.
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(CLEAR_LABELS).map(([qmkId, { label, title }]) => (
            <button
              key={qmkId}
              className="btn btn-sm h-auto min-h-8 min-w-12 py-1 font-normal normal-case leading-tight"
              title={t(title)}
              onClick={() => pick({ qmkId, label: kcLabel(qmkId) })}
            >
              {t(label)}
            </button>
          ))}
        </div>
      )}
      {activeCat.name === MACRO_TD_NAME && activeCat.groups ? (
        <>
        <KeycodeCascadeSelector onPick={pick} keyboard={keyboard} />
        <MacroTapDanceCards
          groups={[
            ...activeCat.groups.map((g) => ({
              titleKey: g.titleKey!,
              entries: g.entries,
              ...comboMeta(keyboard, g.titleKey!, onNavigate),
            })),
            // Combo is a third, non-expandable info card — combos apply on
            // creation with no key binding, so it has no keycodes to assign.
            // Shown only when the device exposes combo slots.
            ...(keyboard.comboCount > 0
              ? [
                  {
                    titleKey: "groupCombo" as MessageKey,
                    entries: [],
                    used: keyboard.comboEntries.filter(
                      (e) => e.output !== "KC_NO" || e.keys.some((k) => k !== "KC_NO"),
                    ).length,
                    total: keyboard.comboCount,
                    onEdit: () => onNavigate("combo"),
                    info: true,
                  },
                ]
              : []),
          ]}
          onPick={pick}
        />
        </>
      ) : activeCat.name === "Layers" && activeCat.groups ? (
        <LayerCategoryCards
          groups={activeCat.groups.map((g) => ({
            titleKey: g.titleKey!,
            helpKey: g.helpKey,
            entries: g.entries,
          }))}
          onPick={pick}
        />
      ) : activeCat.name === MERGED_NAME && activeCat.groups ? (
        <FnMediaMouseCards
          groups={activeCat.groups.map((g) => ({
            titleKey: g.titleKey!,
            helpKey: g.helpKey,
            entries: g.entries,
          }))}
          onPick={pick}
        />
      ) : activeCat.name === "Quantum" && activeCat.groups ? (
        <QuantumCards
          groups={activeCat.groups.map((g) => ({
            titleKey: g.titleKey!,
            helpKey: g.helpKey,
            entries: g.entries,
            sections: g.sections,
          }))}
          onPick={pick}
        />
      ) : activeCat.groups
        ? activeCat.groups.map((group) => (
            <div key={group.titleKey ?? ""} className="mt-3">
              {group.titleKey && (
                <h4 className="mb-1 flex items-center gap-1 text-sm font-semibold">
                  <span className="opacity-70">{t(group.titleKey)}</span>
                  {group.helpKey && <HelpIcon text={t(group.helpKey)} />}
                </h4>
              )}
              {group.grid ? (
                <div className={`grid w-fit grid-cols-4 ${groupGap}`}>
                  {group.entries.map(groupButton)}
                </div>
              ) : (
                <div className={`flex flex-wrap ${groupGap}`}>
                  {group.entries.map(groupButton)}
                </div>
              )}
            </div>
          ))
        : entries.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">{entries.map(keyButton)}</div>
          )}
    </div>
  );
}
