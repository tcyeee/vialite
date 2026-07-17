import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
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
   * Assign the picked keycode. Masked Quantum templates (LCTL_T(kc), …) are
   * never emitted verbatim: picking one commits a concrete keycode with its
   * inner key defaulted to KC_NO (e.g. LCTL_T(KC_NO)), which the user edits
   * afterwards — so `onPick` only ever receives concrete keycodes.
   */
  onPick: (entry: KeycodeDef) => void;
  /** Connected device, for macro / tap-dance previews shown in the info panel.
   *  Optional: when absent (e.g. embedded in a plain slot field) the info panel
   *  simply omits the live macro / tap-dance previews. */
  keyboard?: Keyboard;
  /** Current keycode, used to seed the trigger label so an existing value shows
   *  through (e.g. a tap-dance slot's current key) instead of the placeholder. */
  value?: string;
  /** Trigger text shown before anything is picked (overrides the default). */
  placeholder?: string;
  /** Force the trigger's text, replacing the "category / label" form derived from
   *  the picked keycode. Parent-controlled, so it also sidesteps the internal
   *  picked-id going stale when a pick maps back to the same {@link Props.value}
   *  (e.g. a slot that represents KC_NO as "unset" — see {@link ../common/KeySlot}).
   *  An empty string renders the trigger blank. */
  triggerLabel?: string;
  /** Keep the picked keycode as the trigger label after committing. Set false for
   *  momentary "add" triggers that should always read as their placeholder. */
  keepPicked?: boolean;
  /** Inline field styling: drop the heading + fixed width so the trigger sits in
   *  a row of controls (macro action rows, tap-dance / combo slots). */
  compact?: boolean;
  /** Stretch the trigger to its container's width. Compact triggers otherwise
   *  size to their label (macro rows sit them in a row of buttons), which would
   *  collapse a slot field whose label is empty — see {@link ../common/KeySlot}. */
  fullWidth?: boolean;
  /** Extra classes for the trigger button (e.g. to match a slot's sizing). */
  triggerClassName?: string;
  /** Drop the trigger's "▾" dropdown caret. Set for slots whose face is a keycap
   *  glyph, where a second small triangle next to KC_TRNS's "▽" reads as part of
   *  the keycode — see {@link ../common/KeySlot}. */
  hideCaret?: boolean;
  /** Context-menu mode: render only the popover (no trigger button), positioned
   *  `fixed` at this viewport point and auto-opened. Used by the keyboard
   *  layout's right-click assign; a fresh object each open re-seeds/reopens it. */
  anchor?: { x: number; y: number } | null;
  /** Dismissal callback (outside-click / Escape / after a pick). Required
   *  companion to {@link Props.anchor} so the parent can unmount the popover. */
  onClose?: () => void;
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
export function KeycodeCascadeSelector({
  onPick,
  keyboard,
  value,
  placeholder: placeholderProp,
  triggerLabel,
  keepPicked = true,
  compact = false,
  fullWidth = false,
  triggerClassName,
  hideCaret = false,
  anchor = null,
  onClose,
}: Props) {
  const menuMode = anchor !== null;
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  // The keycode the info panel describes (hovered/seeded in the right column).
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  // The expanded middle-column group (e.g. "MO"), or null when a leaf is active.
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(value ?? null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // The popover element (for measuring), the viewport point it starts from (the
  // right-click point in menu mode, just below the trigger otherwise), and its
  // clamped position (null until the layout effect measures it, then falls back
  // to the raw base point).
  const popoverRef = useRef<HTMLDivElement>(null);
  const [basePoint, setBasePoint] = useState<{ x: number; y: number } | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(null);

  // Trigger mode: the popover is portalled to the body and positioned `fixed`,
  // so an ancestor's `overflow-hidden` or transform (e.g. the tap-dance / combo
  // cards, which clip and 3D-flip their contents) can't clip or mis-anchor it.
  // Read the trigger's viewport rect as the popover's starting point.
  const triggerPoint = () => {
    const r = triggerRef.current?.getBoundingClientRect();
    return r ? { x: r.left, y: r.bottom + 4 } : null;
  };

  // Close the popover; in menu mode this also tells the parent to unmount us.
  const close = () => {
    setOpen(false);
    onClose?.();
  };

  // Collapse back to the top level (category column only), discarding the
  // revealed middle / sub columns and the info panel. Used both to seed a fresh
  // open and to auto-collapse when the pointer leaves the popover.
  const collapse = () => {
    setActiveCat(null);
    setActiveGroupKey(null);
    setActiveEntryId(null);
  };

  // Keep the trigger label in sync with a parent-controlled value.
  useEffect(() => {
    setPickedId(value ?? null);
  }, [value]);

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
  // raw buffer each access, so read it once per render and share. Empty when no
  // device is attached (picker context).
  const macros = keyboard?.macros ?? [];

  // Whether an M{n} / TD(n) entry has user-set content, for the green status dot.
  const isConfigured = (qmkId: string): boolean => {
    const mi = macroIndex(qmkId);
    if (mi !== null) return (macros[mi]?.length ?? 0) > 0;
    const ti = tapDanceIndex(qmkId);
    if (ti !== null && keyboard) return tapDanceConfigured(keyboard.tapDanceEntries[ti]);
    return false;
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      // The popover is portalled out of `rootRef`, so it needs its own hit test.
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
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
  const placeholder = placeholderProp ?? (zh ? "选择按键" : "Pick a keycode");

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

  // Reveal the middle column for a category, but keep its groups collapsed (no
  // sub-column) — the user drills into a group on demand. No entry is described
  // yet: the info panel stays hidden until the pointer is over an actual level-2+
  // item (a middle-column entry / group or a sub-column entry).
  const selectCat = (name: string) => {
    setActiveCat(name);
    setActiveGroupKey(null);
    setActiveEntryId(null);
  };

  const pickedLabel = (() => {
    if (triggerLabel !== undefined) return triggerLabel;
    if (!pickedId) return placeholder;
    for (const c of categories) {
      const e = c.entries.find((x) => x.qmkId === pickedId);
      if (e) return `${catLabel(c.name)} / ${entryLabel(e)}`;
    }
    return pickedId;
  })();

  const openMenu = () => {
    // Open collapsed at the top level: show only the category column and let the
    // user drill in (hover a category → middle column, hover a group →
    // sub-column), like a standard cascade selector, instead of pre-expanding
    // every level at once.
    collapse();
    setBasePoint(menuMode ? anchor : triggerPoint());
    setMenuPos(null);
    setOpen(true);
  };

  // Menu mode: (re)open whenever the anchor point changes (the parent passes a
  // fresh object per right-click). Runs post-render, so the `openMenu` const is
  // initialised by the time this fires.
  useEffect(() => {
    if (!anchor) return;
    openMenu();
    // Keyed on the anchor object identity only; openMenu reads current state.
  }, [anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Trigger mode: a `fixed` popover doesn't follow the trigger, so re-read the
  // trigger's rect while scrolling / resizing to keep the two together.
  useEffect(() => {
    if (menuMode || !open) return;
    const track = () => setBasePoint(triggerPoint());
    window.addEventListener("scroll", track, true);
    window.addEventListener("resize", track);
    return () => {
      window.removeEventListener("scroll", track, true);
      window.removeEventListener("resize", track);
    };
  }, [menuMode, open]);

  // After the popover renders, clamp it into the viewport — shifting by only the
  // overflow (never flipping the whole panel past the base point), so in menu
  // mode the category column stays under the pointer and the cascade reads
  // left→right.
  useLayoutEffect(() => {
    if (!open || !basePoint) return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(basePoint.x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(basePoint.y, window.innerHeight - rect.height - margin));
    setMenuPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    // Re-clamp as the user drills in: revealing the middle / sub columns and the
    // info panel widens the popover, which could otherwise grow past the
    // viewport's right edge.
  }, [open, basePoint, activeCat, activeGroupKey, activeEntryId]);

  const emit = (entry: KeycodeDef) => {
    if (keepPicked) setPickedId(entry.qmkId);
    onPick(entry);
    close();
  };

  const commit = (entry: KeycodeDef) => {
    // Quantum masked templates (Mod-Tap, Layer-Tap, held-mods, …) no longer
    // demand an inner-key sub-pick: commit them with the inner key defaulted to
    // KC_NO (e.g. LCTL_T(KC_NO)) so the key drops in immediately and the user
    // edits the inner key afterwards. Emitting a concrete keycode here also
    // means no parent ever needs to run its own inner-key flow.
    if (entry.masked) {
      const finalId = entry.qmkId.replace("kc", "KC_NO");
      emit({ qmkId: finalId, label: kcLabel(finalId) });
      return;
    }
    emit(entry);
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

  // The popover is always `fixed`, anchored at the click point (menu mode) or
  // below the trigger; the layout effect above clamps it into the viewport
  // (falling back to the raw base point for the first, pre-measure paint).
  const menuStyle: CSSProperties = {
    left: menuPos?.left ?? basePoint?.x ?? 0,
    top: menuPos?.top ?? basePoint?.y ?? 0,
  };

  const popover = open && (
    // The popover paints its own base-100 surfaces, so it must also set its own
    // foreground — it can be embedded in a context with an inherited text color
    // (e.g. the Quantum cards' light-on-dark cards), which would otherwise leave
    // it white-on-white.
    <div
      ref={popoverRef}
      className="fixed z-50 flex flex-col gap-1 text-base-content"
      style={menuStyle}
      // Auto-collapse the drilled-in columns back to the category column when
      // the pointer leaves the popover (React onMouseLeave doesn't fire while
      // moving between the popover's own columns, only on a real exit).
      onMouseLeave={collapse}
    >
            <div className="flex items-start gap-2">
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
            {/* Middle column: revealed only once a category is active, so opening
                shows just the category column (progressive left→right drill-in). */}
            {activeCat !== null && (
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
            )}
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
                the selection columns; not selectable, purely informational.
                Only shown while the pointer is over a level-2+ item (a described
                keycode) — hovering just a category leaves it hidden. */}
            {activeEntry && (
            <div className="max-h-72 w-52 overflow-y-auto rounded-box bg-base-100 p-3 shadow ring-1 ring-base-content/10">
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
                  {activeTapDanceIdx !== null && keyboard && (
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
            </div>
            )}
            </div>
          </div>
    );

  // Menu mode: just the anchored popover (no trigger/heading), inside a ref
  // wrapper so the outside-click handler can tell inside from outside.
  if (menuMode) {
    return <div ref={rootRef}>{popover}</div>;
  }

  return (
    <div className={compact ? "" : "mt-3"}>
      {!compact && <h4 className="mb-1 text-sm font-semibold opacity-70">{heading}</h4>}
      <div
        ref={rootRef}
        className={`relative ${compact ? (fullWidth ? "block w-full" : "inline-block") : "w-64"}`}
      >
        <button
          ref={triggerRef}
          type="button"
          className={
            triggerClassName ??
            `btn btn-sm justify-between font-normal normal-case ${compact ? "" : "w-full"}`
          }
          onClick={() => (open ? close() : openMenu())}
        >
          <span className={pickedId ? "" : "opacity-50"}>{pickedLabel}</span>
          {!hideCaret && <span className="opacity-50">▾</span>}
        </button>
        {/* Portalled to the body: the trigger can sit inside a clipping /
            transformed ancestor (the tap-dance & combo editor cards), which
            would otherwise cut the popover off at the card's edge. */}
        {popover && createPortal(popover, document.body)}
      </div>
    </div>
  );
}
