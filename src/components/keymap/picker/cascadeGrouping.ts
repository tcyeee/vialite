// Pure category/grouping logic for KeycodeCascadeSelector — no component
// state, no JSX. Extracted so the selector's state machine isn't buried
// under catalogue bookkeeping.

import { label as kcLabel, type KeycodeDef } from "../../../protocol/keycodes.ts";
import type { TapDanceEntry } from "../../../protocol/keyboard.ts";
import type { MessageKey } from "../../../contexts/i18n.tsx";
import {
  BASIC_GROUPS,
  LAYER_GROUPS,
  LAYER_GROUP_OTHER,
  QUANTUM_GROUPS,
  QUANTUM_GROUP_MISC,
  type KeycodeGroupMeta,
} from "./keycodeMeta.ts";

/** One category column entry: its display name and the keycodes under it. */
export interface Category {
  name: string;
  entries: KeycodeDef[];
}

/**
 * A middle-column item: either a keycode committed directly, or a group that
 * expands into a sub-column, pushing the info panel to the 4th level. Groups
 * carry a `titleKey` (sourced from {@link ./keycodeMeta}) plus an optional
 * description key; layer groups additionally set each entry's `arg` (the
 * target layer index) for the sub-column label.
 */
export type MiddleItem =
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

export type MiddleGroup = Extract<MiddleItem, { kind: "group" }>;

/**
 * A cascade sub-category of a top-level category. `match` decides which
 * keycodes fall under it; list order is the render order. The label +
 * description come from the group's i18n keys. `layerArg` marks groups whose
 * sub-entries are labelled by their `FN(n)` layer index.
 */
interface SubGrouping {
  key: string;
  titleKey?: MessageKey;
  descKey?: MessageKey;
  match: (qmkId: string) => boolean;
  layerArg?: boolean;
}

/** Map shared group metadata to a cascade sub-grouping (label + description
 *  from the same i18n keys the quick-config tabs use). */
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
const layerArgOf = (qmkId: string): string | undefined => /^[A-Z]+\((\d+)\)$/.exec(qmkId)?.[1];

/** Bucket entries by a sub-category table: unmatched entries become leaves
 *  (kept in order, pinned on top), groups render in table order. */
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

/** Middle-column items for a category: subdivided by its sub-category table
 *  if it has one, else a flat list of leaves. */
export const buildMiddle = (category: string | null, entries: KeycodeDef[]): MiddleItem[] => {
  const subs = category ? CATEGORY_SUBGROUPS[category] : undefined;
  return subs
    ? groupBySubcats(entries, subs)
    : entries.map((entry) => ({ kind: "leaf", entry }));
};

/** Macro slot index for an `M0`..`M15` keycode, or null for anything else. */
export const macroIndex = (qmkId: string): number | null => {
  const m = /^M(\d+)$/.exec(qmkId);
  return m ? Number(m[1]) : null;
};

/** Tap-dance slot index for a `TD(n)` keycode, or null for anything else. */
export const tapDanceIndex = (qmkId: string): number | null => {
  const m = /^TD\((\d+)\)$/.exec(qmkId);
  return m ? Number(m[1]) : null;
};

export const tapDanceConfigured = (e: TapDanceEntry | undefined): boolean =>
  !!e &&
  (e.onTap !== "KC_NO" ||
    e.onHold !== "KC_NO" ||
    e.onDoubleTap !== "KC_NO" ||
    e.onTapHold !== "KC_NO");

/** Readable one-line label for a keycode (collapsing the two-line keycap form). */
export const kcText = (qmkId: string): string => kcLabel(qmkId).split("\n").join(" ");
