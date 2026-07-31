import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { KEYCODE_CATEGORIES, label as kcLabel, type KeycodeDef } from "../../../protocol/keycodes.ts";
import { useI18n } from "../../../contexts/i18n.tsx";
import type { Keyboard } from "../../../protocol/keyboard.ts";
import {
  CATEGORY_DESC,
  CLEAR_LABELS,
  KEYCODE_HELP,
  deviceCategories,
  catLabel as catLabelOf,
  entryLabel as entryLabelOf,
  qualifiedLabel,
} from "./keycodeMeta.ts";
import {
  buildMiddle,
  macroIndex,
  tapDanceConfigured,
  tapDanceIndex,
  type Category,
  type MiddleGroup,
} from "./cascadeGrouping.ts";
import { CascadeColumns } from "./CascadeColumns.tsx";
import { CascadeInfoPanel } from "./CascadeInfoPanel.tsx";

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
  /** Restricts every category's listed entries to those passing this predicate
   *  (categories left empty are dropped); the two clear keycodes (KC_NO/KC_TRNS)
   *  are unaffected. Used to scope a picker down to a subset of the full
   *  catalogue — e.g. the combo editor's "regular key" field excludes bare
   *  modifiers and masked Quantum templates, which it offers through a
   *  dedicated modifier picker instead. See {@link ../combo/ComboPanel}. */
  entryFilter?: (entry: KeycodeDef) => boolean;
  /** Context-menu mode: render only the popover (no trigger button), positioned
   *  `fixed` at this viewport point and auto-opened. Used by the keyboard
   *  layout's right-click assign; a fresh object each open re-seeds/reopens it. */
  anchor?: { x: number; y: number } | null;
  /** Dismissal callback (outside-click / Escape / after a pick). Required
   *  companion to {@link Props.anchor} so the parent can unmount the popover. */
  onClose?: () => void;
}

/** Info-panel width in px, matching its `w-52` class (kept in sync by hand — it
 *  feeds the fits-on-the-right test, which runs before the panel is laid out). */
const INFO_PANEL_W = 208;

/** How long the pointer must rest on a described keycode before the info panel
 *  opens — long enough that scrubbing through a column doesn't flash it. */
const INFO_DELAY_MS = 500;

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
 *
 * The catalogue/grouping logic lives in `cascadeGrouping.ts`, and the popover's
 * two heaviest render blocks are split out as `CascadeColumns` (the selection
 * columns) and `CascadeInfoPanel` (the read-only description card) — this
 * component owns the state machine (open/hover/position) they're driven by.
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
  entryFilter,
}: Props) {
  const menuMode = anchor !== null;
  const { t } = useI18n();
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
  // Whether the popover has already been placed for the *current* open, i.e. the
  // initial clamp is done. Only then is the position transition enabled, so the
  // popover appears at its final spot but animates any later re-clamp (drilling
  // in widens it and can push it left off the viewport's right edge).
  const placedRef = useRef(false);
  // The selection-columns card, measured to decide which side the info panel
  // opens on, and whether it fits to the right at all.
  const columnsRef = useRef<HTMLDivElement>(null);
  const [infoFlip, setInfoFlip] = useState(false);

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
  // The two clear keycodes are promoted out of Basic to the top of the category
  // column (see the popover), so strip them from their category's entries to
  // avoid listing them twice.
  const categories = useMemo<Category[]>(
    () =>
      [...KEYCODE_CATEGORIES, ...deviceCategories()]
        .map((c) => ({
          name: c.name,
          entries: c.entries.filter((e) => !CLEAR_LABELS[e.qmkId] && (!entryFilter || entryFilter(e))),
        }))
        .filter((c) => c.entries.length > 0),
    [entryFilter],
  );

  // KC_NO ("清空") / KC_TRNS ("穿透"), in CLEAR_LABELS order — the two actions
  // pinned above the categories as first-level items.
  const clearEntries = useMemo<KeycodeDef[]>(() => {
    const all = KEYCODE_CATEGORIES.flatMap((c) => c.entries);
    return Object.keys(CLEAR_LABELS)
      .map((id) => all.find((e) => e.qmkId === id))
      .filter((e): e is KeycodeDef => e !== undefined);
  }, []);

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

  const heading = t("cascadeSelectorHeading");
  const placeholder = placeholderProp ?? t("cascadeSelectorPlaceholder");

  const catLabel = (name: string) => catLabelOf(t, name);
  const entryLabel = (entry: KeycodeDef) => entryLabelOf(t, entry);

  const activeEntries = categories.find((c) => c.name === activeCat)?.entries ?? [];
  // The promoted clear keycodes belong to no category, so fall back to them for
  // the info panel when one of the pinned items is hovered.
  const activeEntry =
    activeEntries.find((e) => e.qmkId === activeEntryId) ??
    clearEntries.find((e) => e.qmkId === activeEntryId) ??
    null;

  // The info panel only opens once the pointer has rested on a described keycode
  // for a beat, so sweeping down a column doesn't strobe a panel on every row.
  // Once open it stays open and just swaps content — only leaving the described
  // items entirely closes it (and then it fades out rather than vanishing).
  const [infoShown, setInfoShown] = useState(false);
  const hasInfo = activeEntry !== null;
  useEffect(() => {
    if (!hasInfo) {
      setInfoShown(false);
      return;
    }
    if (infoShown) return;
    const id = window.setTimeout(() => setInfoShown(true), INFO_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [hasInfo, infoShown]);
  // Keep the last described keycode around so the panel still has something to
  // render while it animates out, after `activeEntry` has already gone null.
  const lastInfoEntry = useRef<KeycodeDef | null>(null);
  if (activeEntry) lastInfoEntry.current = activeEntry;
  const infoEntry = activeEntry ?? lastInfoEntry.current;

  // Middle column for the active category, with layer keycodes folded into
  // groups, plus the currently-expanded group's sub-column (if any).
  const activeMiddle = useMemo(() => buildMiddle(activeCat, activeEntries), [activeCat, activeEntries]);
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
    // Scoped to *this* picker's (possibly filtered) categories, so a trigger never names a
    // category the popover doesn't offer.
    return qualifiedLabel(t, pickedId, categories);
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
    if (!open) {
      placedRef.current = false;
      return;
    }
    if (!basePoint) return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 8;
    const left = Math.max(margin, Math.min(basePoint.x, window.innerWidth - rect.width - margin));
    const top = Math.max(margin, Math.min(basePoint.y, window.innerHeight - rect.height - margin));
    setMenuPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    // Runs before paint, so the initial placement commits together with the
    // transition being switched on — the popover never animates in from the raw
    // click point, only subsequent re-clamps animate.
    placedRef.current = true;
    // Re-clamp as the user drills in: revealing the middle / sub columns widens
    // the popover, which could otherwise grow past the viewport's right edge.
    // (The info panel is out of flow and doesn't count here — it flips sides
    // instead; see the layout effect below.)
  }, [open, basePoint, activeCat, activeGroupKey, activeEntryId]);

  // Side the info panel opens on: to the right of the selection columns by
  // default, flipped to their left when the viewport's right edge would clip it
  // — but only if the left side actually has room, otherwise flipping would just
  // move the clipping to the other edge. Re-run as the user drills in, since
  // each revealed column pushes the columns card's right edge further right.
  useLayoutEffect(() => {
    if (!open) return;
    const el = columnsRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // w-52 panel + its 8px gap + an 8px viewport margin.
    const needed = INFO_PANEL_W + 8 + 8;
    const fitsRight = rect.right + needed <= window.innerWidth;
    const fitsLeft = rect.left - needed >= 0;
    setInfoFlip(!fitsRight && fitsLeft);
  }, [open, menuPos, basePoint, activeCat, activeGroupKey, activeEntryId]);

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
  // Reads `infoEntry`, not `activeEntry`, so the copy survives the fade-out.
  const keyDesc = (() => {
    if (!infoEntry) return null;
    const clear = CLEAR_LABELS[infoEntry.qmkId];
    if (clear) return t(clear.title);
    const help = KEYCODE_HELP[infoEntry.qmkId];
    if (help) return t(help);
    if (infoEntry.title && infoEntry.title !== infoEntry.label) return infoEntry.title;
    if (activeGroup?.descKey) return t(activeGroup.descKey);
    return null;
  })();
  // Category-level blurb ("其他/分类说明"): a general description of the active
  // category, shown last as supplementary context — never in place of `keyDesc`.
  const catDesc = (() => {
    const cat = activeCat ? CATEGORY_DESC[activeCat] : undefined;
    return cat ? t(cat) : null;
  })();

  // Middle-column group label: its i18n title, or the raw key as a last resort.
  const groupLabel = (g: MiddleGroup): string => (g.titleKey ? t(g.titleKey) : g.key);
  // Sub-column item label: a layer index for layer groups, else the key's label.
  const subItemLabel = (sub: { entry: KeycodeDef; arg?: string }): string =>
    sub.arg !== undefined
      ? t("cascadeSubLayerN", { n: sub.arg })
      : entryLabel(sub.entry).split("\n").join(" ");

  // The popover is always `fixed`, anchored at the click point (menu mode) or
  // below the trigger; the layout effect above clamps it into the viewport
  // (falling back to the raw base point for the first, pre-measure paint).
  const menuStyle: CSSProperties = {
    left: menuPos?.left ?? basePoint?.x ?? 0,
    top: menuPos?.top ?? basePoint?.y ?? 0,
  };

  // Smooth out the re-clamp that happens when drilling in widens the popover past
  // the viewport edge and shifts it left; the first placement is exempt (see
  // `placedRef`), and reduced-motion users get the instant jump.
  const menuMotion = placedRef.current
    ? "motion-safe:transition-[left,top] motion-safe:duration-200 motion-safe:ease-out"
    : "";

  const popover = open && (
    // The popover paints its own base-100 surfaces, so it must also set its own
    // foreground — it can be embedded in a context with an inherited text color
    // (e.g. the Quantum cards' light-on-dark cards), which would otherwise leave
    // it white-on-white.
    <div
      ref={popoverRef}
      className={`fixed z-50 flex flex-col gap-1 text-base-content ${menuMotion}`}
      style={menuStyle}
      // Auto-collapse the drilled-in columns back to the category column when
      // the pointer leaves the popover (React onMouseLeave doesn't fire while
      // moving between the popover's own columns, only on a real exit).
      onMouseLeave={collapse}
    >
      <div className="relative flex items-start">
        <CascadeColumns
          columnsRef={columnsRef}
          clearEntries={clearEntries}
          categories={categories}
          activeCat={activeCat}
          activeEntryId={activeEntryId}
          pickedId={pickedId}
          activeMiddle={activeMiddle}
          activeGroup={activeGroup}
          activeGroupKey={activeGroupKey}
          catLabel={catLabel}
          entryLabel={entryLabel}
          groupLabel={groupLabel}
          subItemLabel={subItemLabel}
          isConfigured={isConfigured}
          onHoverClear={(qmkId) => {
            setActiveCat(null);
            setActiveGroupKey(null);
            setActiveEntryId(qmkId);
          }}
          onHoverSub={setActiveEntryId}
          selectCat={selectCat}
          seed={seed}
          commit={commit}
        />
        {infoEntry && (
          <CascadeInfoPanel
            infoEntry={infoEntry}
            infoShown={infoShown}
            infoFlip={infoFlip}
            keyDesc={keyDesc}
            catDesc={catDesc}
            keyboard={keyboard}
          />
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
