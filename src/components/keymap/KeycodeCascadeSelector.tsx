import { useEffect, useMemo, useRef, useState } from "react";
import {
  KEYCODE_CATEGORIES,
  label as kcLabel,
  type KeycodeDef,
} from "../../protocol/keycodes.ts";
import { useI18n, type MessageKey } from "../../contexts/i18n.tsx";
import type { Keyboard, TapDanceEntry } from "../../protocol/keyboard.ts";
import type { MacroAction } from "../../protocol/macro.ts";
import {
  BASIC_GROUPS,
  CATEGORY_DESC,
  CATEGORY_KEYS,
  CLEAR_LABELS,
  KEYCODE_HELP,
  LAYER_GROUPS,
  LAYER_GROUP_OTHER,
  QUANTUM_GROUPS,
  QUANTUM_GROUP_MISC,
  deviceCategories,
  type KeycodeGroupMeta,
} from "./keycodeMeta.ts";

interface Props {
  /**
   * Assign the picked keycode. Routed through KeycodeTabs' own `pick`, so masked
   * templates (LCTL_T(kc), …) still open the "pick inner key" flow there.
   */
  onPick: (entry: KeycodeDef) => void;
  /** Connected device, for macro / tap-dance previews shown in the info panel. */
  keyboard: Keyboard;
}

/** One category column entry: its display name and the keycodes under it. */
interface Category {
  name: string;
  entries: KeycodeDef[];
}

/** Tap-dance action fields, in the order the preview lists them. */
const TD_FIELDS: { key: MessageKey; field: keyof TapDanceEntry }[] = [
  { key: "tapDanceOnTap", field: "onTap" },
  { key: "tapDanceOnHold", field: "onHold" },
  { key: "tapDanceOnDoubleTap", field: "onDoubleTap" },
  { key: "tapDanceOnTapHold", field: "onTapHold" },
];

/** Macro slot index for an `M0`..`M15` keycode, or null for anything else. */
const macroIndex = (qmkId: string): number | null => {
  const m = /^M(\d+)$/.exec(qmkId);
  return m ? Number(m[1]) : null;
};

/** Tap-dance slot index for a `TD(n)` keycode, or null for anything else. */
const tapDanceIndex = (qmkId: string): number | null => {
  const m = /^TD\((\d+)\)$/.exec(qmkId);
  return m ? Number(m[1]) : null;
};

const tapDanceConfigured = (e: TapDanceEntry | undefined): boolean =>
  !!e &&
  (e.onTap !== "KC_NO" ||
    e.onHold !== "KC_NO" ||
    e.onDoubleTap !== "KC_NO" ||
    e.onTapHold !== "KC_NO");

/** Readable one-line label for a keycode (collapsing the two-line keycap form). */
const kcText = (qmkId: string): string => kcLabel(qmkId).split("\n").join(" ");

/**
 * A middle-column item: either a keycode committed directly, or a group that
 * expands into a sub-column, pushing the info panel to the 4th level. Groups
 * carry a `titleKey` (sourced from {@link ./keycodeMeta}) plus an optional
 * description key; layer groups additionally set each entry's `arg` (the target
 * layer index) for the sub-column label.
 */
type MiddleItem =
  | { kind: "leaf"; entry: KeycodeDef }
  | {
      kind: "group";
      key: string;
      titleKey?: MessageKey;
      /** i18n key for the group's description, shown as the info panel's
       *  per-key blurb (e.g. a layer/quantum group's help copy). */
      descKey?: MessageKey;
      entries: { entry: KeycodeDef; arg?: string }[];
    };

type MiddleGroup = Extract<MiddleItem, { kind: "group" }>;

/**
 * A cascade sub-category of a top-level category. `match` decides which keycodes
 * fall under it; list order is the render order. The label + description come
 * from the group's i18n keys. `layerArg` marks groups whose sub-entries are
 * labelled by their `FN(n)` layer index.
 */
interface SubGrouping {
  key: string;
  titleKey?: MessageKey;
  descKey?: MessageKey;
  match: (qmkId: string) => boolean;
  layerArg?: boolean;
}

/** Map shared group metadata to a cascade sub-grouping (label + description from
 *  the same i18n keys the quick-config tabs use). */
const fromMeta = (m: KeycodeGroupMeta, layerArg = false): SubGrouping => ({
  key: m.key,
  titleKey: m.titleKey,
  descKey: m.helpKey,
  match: m.match,
  layerArg,
});

/** Basic → letters / numbers / symbols / F-keys / editing / mods. Unmatched
 *  keycodes (KC_NO/KC_TRNS) stay as leaves pinned above the groups. */
const BASIC_SUBCATS: SubGrouping[] = BASIC_GROUPS.map((m) => fromMeta(m));
/** Layers → MO/TG/… groups (+ Other catch-all); sub-entries are layer indices. */
const LAYER_SUBCATS: SubGrouping[] = [...LAYER_GROUPS, LAYER_GROUP_OTHER].map((m) =>
  fromMeta(m, true),
);
/** Quantum → held-mods / mod-tap / layer-tap / one-shot (+ misc catch-all). */
const QUANTUM_SUBCATS: SubGrouping[] = [...QUANTUM_GROUPS, QUANTUM_GROUP_MISC].map((m) =>
  fromMeta(m),
);

/** Top-level categories subdivided into a middle-column sub-category table. */
const CATEGORY_SUBGROUPS: Record<string, SubGrouping[]> = {
  Basic: BASIC_SUBCATS,
  Layers: LAYER_SUBCATS,
  Quantum: QUANTUM_SUBCATS,
};

/** Layer index for a `FN(n)` keycode, else undefined (e.g. FN_MO13). */
const layerArgOf = (qmkId: string): string | undefined =>
  /^[A-Z]+\((\d+)\)$/.exec(qmkId)?.[1];

/** Bucket entries by a sub-category table: unmatched entries become leaves (kept
 *  in order, pinned on top), groups render in table order. */
const groupBySubcats = (entries: KeycodeDef[], subs: SubGrouping[]): MiddleItem[] => {
  const leaves: MiddleItem[] = [];
  const groups = new Map<string, MiddleGroup>();
  for (const entry of entries) {
    const sub = subs.find((s) => s.match(entry.qmkId));
    if (!sub) {
      leaves.push({ kind: "leaf", entry });
      continue;
    }
    let g = groups.get(sub.key);
    if (!g) {
      g = {
        kind: "group",
        key: sub.key,
        titleKey: sub.titleKey,
        descKey: sub.descKey,
        entries: [],
      };
      groups.set(sub.key, g);
    }
    g.entries.push({ entry, arg: sub.layerArg ? layerArgOf(entry.qmkId) : undefined });
  }
  const ordered = subs
    .map((s) => groups.get(s.key))
    .filter((g): g is MiddleGroup => g !== undefined);
  return [...leaves, ...ordered];
};

/** Middle-column items for a category: subdivided by its sub-category table if
 *  it has one, else a flat list of leaves. */
const buildMiddle = (category: string | null, entries: KeycodeDef[]): MiddleItem[] => {
  const subs = category ? CATEGORY_SUBGROUPS[category] : undefined;
  return subs
    ? groupBySubcats(entries, subs)
    : entries.map((entry) => ({ kind: "leaf", entry }));
};

/** First keycode a category will describe: its first leaf, or a group's first
 *  sub-entry. Used to seed the info panel so it's never blank. */
const firstDescribable = (
  items: MiddleItem[],
): { group: string | null; qmkId: string | null } => {
  const first = items[0];
  if (!first) return { group: null, qmkId: null };
  if (first.kind === "leaf") return { group: null, qmkId: first.entry.qmkId };
  return { group: first.key, qmkId: first.entries[0]?.entry.qmkId ?? null };
};

/** Locate a keycode within pre-built middle items (which group it belongs to). */
const locate = (
  items: MiddleItem[],
  qmkId: string,
): { group: string | null; qmkId: string } | null => {
  for (const it of items) {
    if (it.kind === "leaf") {
      if (it.entry.qmkId === qmkId) return { group: null, qmkId };
    } else if (it.entries.some((e) => e.entry.qmkId === qmkId)) {
      return { group: it.key, qmkId };
    }
  }
  return null;
};

/**
 * Full keycode catalogue as a three-level cascade: the left column lists every
 * category (Basic, Fn keys, Layers, Quantum, Media, Mouse, Lighting, plus the
 * connected device's Custom / Tap Dance), the middle column lists that
 * category's keycodes, and the right column is a read-only info panel describing
 * the active keycode — a function blurb, a live macro / tap-dance preview, and
 * the raw encoding. Selecting a keycode commits it via {@link Props.onPick} and
 * closes the popover.
 *
 * Closing is driven by a document pointer-down listener (not focus/blur, whose
 * relatedTarget is unreliable across browsers); the active category is seeded on
 * open so the right column is never empty.
 */
export function KeycodeCascadeSelector({ onPick, keyboard }: Props) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  // The keycode the info panel describes (hovered/seeded in the right column).
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  // The expanded middle-column group (e.g. "MO"), or null when a leaf is active.
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // All non-empty categories: the static tables plus whatever the attached
  // device exposes (Custom keycodes, Tap Dance). Recomputed each render is
  // cheap; device categories reflect the currently-connected keyboard.
  const categories = useMemo<Category[]>(
    () =>
      [...KEYCODE_CATEGORIES, ...deviceCategories()].filter(
        (c) => c.entries.length > 0,
      ),
    [],
  );

  // Live macro action lists for the connected device; the getter re-decodes the
  // raw buffer each access, so read it once per render and share.
  const macros = keyboard.macros;

  // Whether an M{n} / TD(n) entry has user-set content, for the green status dot.
  const isConfigured = (qmkId: string): boolean => {
    const mi = macroIndex(qmkId);
    if (mi !== null) return (macros[mi]?.length ?? 0) > 0;
    const ti = tapDanceIndex(qmkId);
    if (ti !== null) return tapDanceConfigured(keyboard.tapDanceEntries[ti]);
    return false;
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const zh = lang === "zh";
  const heading = zh ? "按键选择器（级联）" : "Keycode Selector (cascade)";
  const placeholder = zh ? "选择按键" : "Pick a keycode";

  const catLabel = (name: string) => (CATEGORY_KEYS[name] ? t(CATEGORY_KEYS[name]) : name);
  // The two "clear" keycodes (KC_NO / KC_TRNS) get plain translated labels
  // instead of their raw id / "▽" glyph, matching the picker.
  const entryLabel = (entry: KeycodeDef) => {
    const clear = CLEAR_LABELS[entry.qmkId];
    if (clear) return t(clear.label);
    return entry.label || entry.qmkId;
  };

  const activeEntries =
    categories.find((c) => c.name === activeCat)?.entries ?? [];
  const activeEntry = activeEntries.find((e) => e.qmkId === activeEntryId) ?? null;

  // Middle column for the active category, with layer keycodes folded into
  // groups, plus the currently-expanded group's sub-column (if any).
  const activeMiddle = useMemo(
    () => buildMiddle(activeCat, activeEntries),
    [activeCat, activeEntries],
  );
  const activeGroup =
    (activeMiddle.find(
      (it) => it.kind === "group" && it.key === activeGroupKey,
    ) as MiddleGroup | undefined) ?? null;

  // Point the info panel at a keycode, expanding/collapsing the sub-column to
  // match whichever group (if any) that keycode lives in.
  const seed = (loc: { group: string | null; qmkId: string | null }) => {
    setActiveGroupKey(loc.group);
    setActiveEntryId(loc.qmkId);
  };

  // Switch the middle column's category and seed the info panel with its first
  // keycode so the panel is never blank on category change.
  const selectCat = (name: string) => {
    setActiveCat(name);
    seed(firstDescribable(buildMiddle(name, categories.find((c) => c.name === name)?.entries ?? [])));
  };

  const pickedLabel = (() => {
    if (!pickedId) return placeholder;
    for (const c of categories) {
      const e = c.entries.find((x) => x.qmkId === pickedId);
      if (e) return `${catLabel(c.name)} / ${entryLabel(e)}`;
    }
    return pickedId;
  })();

  const openMenu = () => {
    // Seed the active column from the current pick's category, else the first.
    const cat =
      (pickedId &&
        categories.find((c) => c.entries.some((e) => e.qmkId === pickedId))?.name) ||
      categories[0]?.name ||
      null;
    setActiveCat(cat);
    // Seed the info panel with the current pick if it's in this category (and
    // expand its group), else the category's first describable keycode.
    const items = buildMiddle(cat, categories.find((c) => c.name === cat)?.entries ?? []);
    seed((pickedId ? locate(items, pickedId) : null) ?? firstDescribable(items));
    setOpen(true);
  };

  const commit = (entry: KeycodeDef) => {
    setPickedId(entry.qmkId);
    onPick(entry);
    setOpen(false);
  };

  // Per-key description ("按键说明"): a Basic clear key's own copy, a per-keycode
  // description from the shared registry (e.g. Lighting keys), a custom keycode's
  // device-provided title, or the active group's shared description (e.g. a layer
  // group's MO/TG/… help). Describes the *selected keycode*, not its category —
  // the category blurb is shown separately (see `catDesc`).
  const keyDesc = (() => {
    if (!activeEntry) return null;
    const clear = CLEAR_LABELS[activeEntry.qmkId];
    if (clear) return t(clear.title);
    const help = KEYCODE_HELP[activeEntry.qmkId];
    if (help) return t(help);
    if (activeEntry.title && activeEntry.title !== activeEntry.label) return activeEntry.title;
    if (activeGroup?.descKey) return t(activeGroup.descKey);
    return null;
  })();
  // Category-level blurb ("其他/分类说明"): a general description of the active
  // category, shown last as supplementary context — never in place of `keyDesc`.
  const catDesc = (() => {
    const cat = activeCat ? CATEGORY_DESC[activeCat] : undefined;
    return cat ? t(cat) : null;
  })();

  const activeMacroIdx = activeEntry ? macroIndex(activeEntry.qmkId) : null;
  const activeTapDanceIdx = activeEntry ? tapDanceIndex(activeEntry.qmkId) : null;

  const macroActionKind = (a: MacroAction): string => {
    if (a.kind === "text") return t("macroActionText");
    if (a.kind === "delay") return t("macroActionDelay");
    return { tap: t("macroActionTap"), down: t("macroActionDown"), up: t("macroActionUp") }[a.kind];
  };
  const macroActionValue = (a: MacroAction): string => {
    if (a.kind === "text") return a.text;
    if (a.kind === "delay") return `${a.ms} ms`;
    return a.keycodes.map(kcText).join(" + ");
  };

  // Middle-column group label: its i18n title, or the raw key as a last resort.
  const groupLabel = (g: MiddleGroup): string => (g.titleKey ? t(g.titleKey) : g.key);
  // Sub-column item label: a layer index for layer groups, else the key's label.
  const subItemLabel = (sub: { entry: KeycodeDef; arg?: string }): string =>
    sub.arg !== undefined
      ? zh
        ? `第 ${sub.arg} 层`
        : `Layer ${sub.arg}`
      : entryLabel(sub.entry).split("\n").join(" ");

  return (
    <div className="mt-3">
      <h4 className="mb-1 text-sm font-semibold opacity-70">{heading}</h4>
      <div ref={rootRef} className="relative w-64">
        <button
          type="button"
          className="btn btn-sm w-full justify-between font-normal normal-case"
          onClick={() => (open ? setOpen(false) : openMenu())}
        >
          <span className={pickedId ? "" : "opacity-50"}>{pickedLabel}</span>
          <span className="opacity-50">▾</span>
        </button>
        {open && (
          <div className="absolute left-0 top-full z-10 mt-1 flex items-start gap-2">
            {/* Selection columns (category / middle / sub) grouped into one card. */}
            <div className="flex overflow-hidden rounded-box bg-base-100 shadow ring-1 ring-base-content/10">
            <ul className="menu menu-sm max-h-72 w-36 flex-nowrap overflow-y-auto border-r border-base-content/10 p-1">
              {categories.map((c) => (
                <li key={c.name}>
                  <button
                    type="button"
                    className={`flex justify-between ${
                      activeCat === c.name ? "menu-active" : ""
                    }`}
                    onMouseEnter={() => selectCat(c.name)}
                    onClick={() => selectCat(c.name)}
                  >
                    <span className="truncate">{catLabel(c.name)}</span>
                    <span className="opacity-50">›</span>
                  </button>
                </li>
              ))}
            </ul>
            <ul className="menu menu-sm max-h-72 w-44 flex-nowrap overflow-y-auto p-1">
              {activeMiddle.map((item) =>
                item.kind === "leaf" ? (
                  <li key={item.entry.qmkId}>
                    <button
                      type="button"
                      className={`justify-start ${item.entry.masked ? "italic" : ""} ${
                        pickedId === item.entry.qmkId ? "menu-active" : ""
                      }`}
                      title={item.entry.title ?? item.entry.qmkId}
                      onMouseEnter={() => seed({ group: null, qmkId: item.entry.qmkId })}
                      onClick={() => commit(item.entry)}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        {/* Secondary dot marks macro / tap-dance slots the user has set. */}
                        {isConfigured(item.entry.qmkId) && (
                          <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-brand-secondary" />
                        )}
                        <span className="truncate">{entryLabel(item.entry)}</span>
                      </span>
                    </button>
                  </li>
                ) : (
                  <li key={`group:${item.key}`}>
                    <button
                      type="button"
                      className={`flex justify-between ${
                        activeGroupKey === item.key ? "menu-active" : ""
                      }`}
                      onMouseEnter={() =>
                        seed({ group: item.key, qmkId: item.entries[0]?.entry.qmkId ?? null })
                      }
                      onClick={() =>
                        seed({ group: item.key, qmkId: item.entries[0]?.entry.qmkId ?? null })
                      }
                    >
                      <span className="truncate">{groupLabel(item)}</span>
                      <span className="opacity-50">›</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
            {/* Sub-column: parameterised variants of the expanded group (e.g. the
                target layer for MO/TG/…). Only rendered when a group is active,
                pushing the info panel to the 4th level. */}
            {activeGroup && (
              <ul className="menu menu-sm max-h-72 w-32 flex-nowrap overflow-y-auto border-l border-base-content/10 p-1">
                {activeGroup.entries.map((sub) => (
                  <li key={sub.entry.qmkId}>
                    <button
                      type="button"
                      className={`justify-start ${sub.entry.masked ? "italic" : ""} ${
                        activeEntryId === sub.entry.qmkId ? "menu-active" : ""
                      }`}
                      title={sub.entry.title ?? sub.entry.qmkId}
                      onMouseEnter={() => setActiveEntryId(sub.entry.qmkId)}
                      onClick={() => commit(sub.entry)}
                    >
                      <span className="truncate">{subItemLabel(sub)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            </div>
            {/* Info panel: a read-only, standalone card describing the active
                keycode — a function blurb, a macro / tap-dance preview, and the
                raw encoding. Visually detached (own gap + rounded corners) from
                the selection columns; not selectable, purely informational. */}
            <div className="max-h-72 w-52 overflow-y-auto rounded-box bg-base-100 p-3 shadow ring-1 ring-base-content/10">
              {activeEntry ? (
                <div className="flex flex-col gap-3">
                  {/* 1. Keycode encoding — always first. */}
                  <div>
                    <div className="mb-1 text-xs opacity-50">{zh ? "按键编码" : "Keycode"}</div>
                    <div className="font-mono text-sm break-all">{activeEntry.qmkId}</div>
                  </div>
                  {/* 2. Per-key description. */}
                  {keyDesc && (
                    <div>
                      <div className="mb-1 text-xs opacity-50">{zh ? "按键说明" : "Description"}</div>
                      <div className="text-xs leading-relaxed opacity-80">{keyDesc}</div>
                    </div>
                  )}
                  {/* 3. Macro / tap-dance content. */}
                  {activeMacroIdx !== null && (
                    <div>
                      <div className="mb-1 text-xs opacity-50">{t("cascadeMacroContents")}</div>
                      {(macros[activeMacroIdx]?.length ?? 0) === 0 ? (
                        <div className="text-xs opacity-40">{t("cascadeNotConfigured")}</div>
                      ) : (
                        <div className="flex flex-col gap-1 text-xs">
                          {macros[activeMacroIdx].map((a, i) => (
                            <div key={i} className="flex items-start gap-1">
                              <span className="badge badge-ghost badge-xs shrink-0">
                                {macroActionKind(a)}
                              </span>
                              <span className="break-all">{macroActionValue(a)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {activeTapDanceIdx !== null && (
                    <div>
                      <div className="mb-1 text-xs opacity-50">{t("cascadeTapDanceActions")}</div>
                      {(() => {
                        const e = keyboard.tapDanceEntries[activeTapDanceIdx];
                        if (!tapDanceConfigured(e)) {
                          return <div className="text-xs opacity-40">{t("cascadeNotConfigured")}</div>;
                        }
                        return (
                          <div className="flex flex-col gap-0.5 text-xs">
                            {TD_FIELDS.filter((f) => (e[f.field] as string) !== "KC_NO").map((f) => (
                              <div key={f.field} className="flex justify-between gap-2">
                                <span className="opacity-50">{t(f.key)}</span>
                                <span className="font-medium">{kcText(e[f.field] as string)}</span>
                              </div>
                            ))}
                            <div className="mt-0.5 text-right opacity-40">
                              {t("tapDanceTermMs", { ms: e.tappingTerm })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                  {/* 4. Other info: the category-level blurb. */}
                  {catDesc && (
                    <div>
                      <div className="mb-1 text-xs opacity-50">{zh ? "分类说明" : "Category"}</div>
                      <div className="text-xs leading-relaxed opacity-80">{catDesc}</div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs opacity-40">
                  {zh ? "悬停查看编码" : "Hover to inspect"}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
