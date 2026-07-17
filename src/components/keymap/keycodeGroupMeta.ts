import type { MessageKey } from "../../contexts/i18n.tsx";

/**
 * Project-owned metadata for keycode sub-groups within a top-level category.
 * This is the single source of truth for each group's classification (`match`),
 * heading (`titleKey`) and description (`helpKey`), shared by the quick-config
 * tabs ({@link ../KeycodeTabs}) and the cascade selector
 * ({@link ./KeycodeCascadeSelector}) so both classify + describe identically
 * instead of each maintaining its own copy. Descriptions stay as i18n
 * `MessageKey`s (a UI concern) rather than living in the framework-agnostic
 * `protocol/keycodes.ts`.
 *
 * Groups within one category are mutually exclusive by construction; a group
 * whose `match` returns `true` for everything acts as a catch-all and must come
 * last (or be applied only to the leftovers).
 */
export interface KeycodeGroupMeta {
  /** Stable identity for the group (used as a column key / lookup handle). */
  key: string;
  /** Translation key for the group heading (e.g. "MO · Momentary"). */
  titleKey: MessageKey;
  /** Translation key for the group's description shown as help / info copy. */
  helpKey: MessageKey;
  /** Whether a keycode belongs to this group. */
  match: (qmkId: string) => boolean;
}

// --- Layers ----------------------------------------------------------------

/** Layer-switch groups, one per function; a `FN(n)` keycode belongs to the
 *  group whose `fn` prefixes it. */
export const LAYER_GROUPS: KeycodeGroupMeta[] = (
  [
    ["MO", "groupLayerMO", "groupLayerMOHelp"],
    ["TG", "groupLayerTG", "groupLayerTGHelp"],
    ["TT", "groupLayerTT", "groupLayerTTHelp"],
    ["OSL", "groupLayerOSL", "groupLayerOSLHelp"],
    ["TO", "groupLayerTO", "groupLayerTOHelp"],
    ["DF", "groupLayerDF", "groupLayerDFHelp"],
  ] satisfies [string, MessageKey, MessageKey][]
).map(([fn, titleKey, helpKey]) => ({
  key: fn,
  titleKey,
  helpKey,
  match: (id: string) => id.startsWith(`${fn}(`),
}));

/** Catch-all for layer keycodes matching no {@link LAYER_GROUPS} fn (e.g.
 *  FN_MO13 / FN_MO23). */
export const LAYER_GROUP_OTHER: KeycodeGroupMeta = {
  key: "layerOther",
  titleKey: "groupLayerOther",
  helpKey: "groupLayerOtherHelp",
  match: () => true,
};

// --- Quantum ---------------------------------------------------------------

const isOSM = (id: string) => id.startsWith("OSM(");
const isModTap = (id: string) => /_T\(kc\)$/.test(id);
const isLayerTap = (id: string) => /^LT\d+\(/.test(id);
const isMod = (id: string) =>
  !isOSM(id) && !isModTap(id) && !isLayerTap(id) && id.endsWith("(kc)");

/**
 * Quantum groups partitioned by qmk_id shape. Mutually exclusive; anything none
 * of these match is a "misc" leftover (see {@link QUANTUM_GROUP_MISC}). Order is
 * the cascade selector's display order.
 */
export const QUANTUM_GROUPS: KeycodeGroupMeta[] = [
  { key: "mods", titleKey: "groupQuantumMods", helpKey: "groupQuantumModsHelp", match: isMod },
  { key: "modtap", titleKey: "groupQuantumModTap", helpKey: "groupQuantumModTapHelp", match: isModTap },
  { key: "layertap", titleKey: "groupQuantumLayerTap", helpKey: "groupQuantumLayerTapHelp", match: isLayerTap },
  { key: "osm", titleKey: "groupQuantumOSM", helpKey: "groupQuantumOSMHelp", match: isOSM },
];

/** Catch-all for Quantum keycodes matching none of {@link QUANTUM_GROUPS}. */
export const QUANTUM_GROUP_MISC: KeycodeGroupMeta = {
  key: "quantumMisc",
  titleKey: "groupQuantumMisc",
  helpKey: "groupQuantumOtherHelp",
  match: () => true,
};
